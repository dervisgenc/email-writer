#!/bin/sh
# Installs the Writehand helper app on macOS and Linux, for the current user only.
#
#   Install:    curl -fsSL https://github.com/dervisgenc/email-writer/releases/latest/download/install.sh | sh
#   Uninstall:  curl -fsSL https://github.com/dervisgenc/email-writer/releases/latest/download/install.sh | sh -s -- uninstall
#
# Options after `sh -s --` go to `writehand install` (for example --extension-id=ID) or to
# `writehand uninstall` (--delete-data). The script downloads this computer's program and the
# release's SHA256SUMS, stops unless the SHA-256 matches, unpacks the program into a temporary
# folder and lets it install itself into ~/.local/share/writehand. No administrator rights.
# WRITEHAND_DOWNLOAD_BASE replaces the download address (CI uses a local folder).
set -eu

base="${WRITEHAND_DOWNLOAD_BASE:-https://github.com/dervisgenc/email-writer/releases/latest/download}"

fail() {
  printf 'Writehand: %s\n' "$1" >&2
  exit 1
}

# Removal needs no download: the installed program removes itself and its registrations.
if [ "${1:-}" = uninstall ]; then
  shift
  program="$HOME/.local/share/writehand/writehand"
  [ -x "$program" ] || fail "the helper app is not installed ($program not found)."
  exec "$program" uninstall "$@" </dev/null
fi

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) fail "this system ($(uname -s)) is not supported. On Windows, use install.ps1." ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) fail "this processor ($(uname -m)) is not supported." ;;
esac
# A terminal running under Rosetta reports x86_64 on Apple silicon; install the native program.
if [ "$os" = darwin ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = 1 ]; then
  arch=arm64
fi

command -v curl >/dev/null 2>&1 || fail "curl is required."
archive="writehand-$os-$arch.tar.gz"
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT
trap 'exit 1' INT TERM

download() {
  curl -fsSL --retry 2 -o "$temporary/$1" "$base/$1" || fail "could not download $base/$1"
}
printf 'Downloading %s…\n' "$archive"
download "$archive"
download SHA256SUMS

# Each SHA256SUMS line is "<sha256>  <file name>".
expected="$(awk -v name="$archive" '$2 == name || $2 == "*" name { print $1 }' "$temporary/SHA256SUMS")"
[ -n "$expected" ] || fail "SHA256SUMS lists no checksum for $archive."
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$temporary/$archive" | awk '{ print $1 }')"
else
  actual="$(shasum -a 256 "$temporary/$archive" | awk '{ print $1 }')"
fi
[ "$actual" = "$expected" ] || fail "the checksum of $archive does not match SHA256SUMS. Nothing was installed."

tar -xzf "$temporary/$archive" -C "$temporary"
# The program copies itself into place and registers itself with the browsers.
"$temporary/writehand" install "$@" </dev/null

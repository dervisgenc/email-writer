// Sets the release version in the root package.json, the only place the version is kept:
// the extension manifest and the helper app take it from there at build time. Also opens
// the version's section in CHANGELOG.md. Tagging (vX.Y.Z) and pushing stay with the maintainer.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packagePath = resolve(root, 'package.json');
const changelogPath = resolve(root, 'CHANGELOG.md');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const next = process.argv[2] ?? '';
if (!/^\d+\.\d+\.\d+$/.test(next)) fail('Usage: pnpm release:version <x.y.z>');

const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
const parts = (version) => version.split('.').map(Number);
const [a, b] = [parts(next), parts(manifest.version)];
const order = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
if (order < 0) fail(`${next} is lower than the current version ${manifest.version}.`);

const changelog = readFileSync(changelogPath, 'utf8');
if (changelog.includes(`## [${next}]`)) fail(`CHANGELOG.md already has a section for ${next}.`);
const unreleased = '## [Unreleased]\n';
if (!changelog.includes(unreleased)) fail('CHANGELOG.md has no "## [Unreleased]" section.');

// The changes collected under Unreleased become this version's notes.
const date = new Date().toISOString().slice(0, 10);
writeFileSync(changelogPath, changelog.replace(unreleased, `${unreleased}\n## [${next}] - ${date}\n`));
manifest.version = next;
writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Version ${next} set in package.json and CHANGELOG.md. Next steps:
  1. Review CHANGELOG.md, then commit: git commit -am "chore: release v${next}"
  2. Tag and push: git tag v${next} && git push origin v${next}
  3. Check the draft release that the release workflow creates, then publish it.`);

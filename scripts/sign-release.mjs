// Writes SHA256SUMS for every file in a release folder and signs it with Ed25519:
//   node scripts/sign-release.mjs <folder>              signs with WRITEHAND_RELEASE_SIGNING_KEY (PEM)
//   node scripts/sign-release.mjs <folder> --unsigned   checksums only (tests without the secret)
// The signature (SHA256SUMS.sig, base64) is checked against the public key the helper app
// carries, so a secret that does not match the committed key fails here, before publishing.
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const [folder, flag] = process.argv.slice(2);
if (!folder || (flag !== undefined && flag !== '--unsigned')) {
  console.error('Usage: node scripts/sign-release.mjs <folder> [--unsigned]');
  process.exit(1);
}

const names = readdirSync(folder)
  .filter((name) => !name.startsWith('SHA256SUMS') && statSync(join(folder, name)).isFile())
  .sort();
const sums = names
  .map(
    (name) =>
      `${createHash('sha256')
        .update(readFileSync(join(folder, name)))
        .digest('hex')}  ${name}\n`,
  )
  .join('');
writeFileSync(join(folder, 'SHA256SUMS'), sums);
console.log(`SHA256SUMS: ${names.length} files`);
if (flag === '--unsigned') process.exit(0);

const secret = process.env.WRITEHAND_RELEASE_SIGNING_KEY;
if (!secret) {
  console.error('WRITEHAND_RELEASE_SIGNING_KEY is not set.');
  process.exit(1);
}
const signature = sign(null, Buffer.from(sums), createPrivateKey(secret));
const { ed25519PublicKey } = JSON.parse(
  readFileSync(join(root, 'apps/ai-companion/release-key.json'), 'utf8'),
);
const publicKey = createPublicKey({
  key: Buffer.from(ed25519PublicKey, 'base64'),
  format: 'der',
  type: 'spki',
});
if (!verify(null, Buffer.from(sums), publicKey, signature)) {
  console.error('The signing key does not match apps/ai-companion/release-key.json.');
  process.exit(1);
}
writeFileSync(join(folder, 'SHA256SUMS.sig'), `${signature.toString('base64')}\n`);
console.log('SHA256SUMS.sig: signed and verified against the helper app’s public key');

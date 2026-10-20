// Creates the Ed25519 key pair that signs releases. The public key goes into the repository
// (apps/ai-companion/release-key.json), where the helper app reads it to verify updates. The
// private key is written only to the file you name, outside the repository, and belongs in the
// GitHub secret WRITEHAND_RELEASE_SIGNING_KEY:
//   node scripts/generate-release-key.mjs ~/writehand-release-signing-key.pem
//   gh secret set WRITEHAND_RELEASE_SIGNING_KEY < ~/writehand-release-signing-key.pem
// Replacing the key means older helper apps can no longer verify (and install) new releases.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const target = process.argv[2] ? resolve(process.argv[2]) : '';
if (!target) {
  console.error('Usage: node scripts/generate-release-key.mjs <private key file outside the repository>');
  process.exit(1);
}
if (!relative(root, target).startsWith('..')) {
  console.error('Refusing to write the private key inside the repository.');
  process.exit(1);
}
if (existsSync(target)) {
  console.error(`${target} already exists; choose another file.`);
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
writeFileSync(target, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
const ed25519PublicKey = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
writeFileSync(
  resolve(root, 'apps/ai-companion/release-key.json'),
  `${JSON.stringify({ ed25519PublicKey }, null, 2)}\n`,
);
console.log(`Private key: ${target} (keep a backup in a password manager)
Public key written to apps/ai-companion/release-key.json; commit it.
Add the secret: gh secret set WRITEHAND_RELEASE_SIGNING_KEY < ${target}`);

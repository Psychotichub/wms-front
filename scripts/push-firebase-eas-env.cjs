/**
 * Upload Firebase Android + iOS config files to EAS as file-type environment variables
 * for every default environment (development, preview, production).
 *
 * Run from repo root: npm run eas:env:firebase --prefix frontend
 * Or:           cd frontend && npm run eas:env:firebase
 *
 * Requires: google-services.json and GoogleService-Info.plist in frontend/
 * Requires: eas login, and a linked EAS project (app.config.js extra.eas.projectId).
 *
 * Uses visibility "sensitive" so paths resolve during local `eas build` / fingerprint
 * (secret file vars are not visible to EAS CLI — see Expo env docs).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envs = ['development', 'preview', 'production'];
const files = [
  { name: 'GOOGLE_SERVICES_JSON', file: 'google-services.json' },
  { name: 'GOOGLE_SERVICES_PLIST', file: 'GoogleService-Info.plist' }
];

for (const { file } of files) {
  const fp = path.join(root, file);
  if (!fs.existsSync(fp)) {
    console.error(`Missing ${file} in ${root}. Download from Firebase Console (Project settings → Your apps).`);
    process.exit(1);
  }
}

const easBin = 'npx --yes eas-cli';

for (const env of envs) {
  for (const { name, file } of files) {
    const rel = `./${file}`;
    const cmd = [
      easBin,
      'env:create',
      '--scope',
      'project',
      '--name',
      name,
      '--type',
      'file',
      '--visibility',
      'sensitive',
      '--force',
      '--non-interactive',
      '--value',
      rel,
      '--environment',
      env
    ].join(' ');

    console.log(`\n→ ${env} / ${name}\n`);
    execSync(cmd, { stdio: 'inherit', cwd: root, shell: true });
  }
}

console.log('\nDone. File vars use sensitive visibility so EAS CLI can resolve them before upload (avoids gitignored path warnings).\n');

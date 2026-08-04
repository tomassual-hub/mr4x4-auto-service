// Rebuilds the signed Android TWA (Trusted Web Activity) APK/AAB via
// Bubblewrap, driven by env vars so it can run unattended in CI (see
// .github/workflows/build-android.yml) as well as locally.
//
// `bubblewrap init` is interactive (it prompts to confirm the manifest it
// detected) and there's no terminal attached in CI to answer that, so this
// generates the project the same way `init` does internally -- via
// Bubblewrap's own generator functions -- and writes the manifest-checksum
// file itself, which is what lets the later `bubblewrap build` step skip its
// own "did the manifest change?" confirmation prompt.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ANDROID_DIR = path.join(ROOT, 'android-app');

const MANIFEST_URL = process.env.ANDROID_MANIFEST_URL
  || 'https://tomassual-hub.github.io/servispro/manifest.json';
const PACKAGE_ID = process.env.ANDROID_PACKAGE_ID || 'io.github.tomassual_hub.twa';
const KEYSTORE_PATH = process.env.ANDROID_KEYSTORE_PATH
  || path.join(ANDROID_DIR, 'signing.keystore');
const KEY_ALIAS = process.env.ANDROID_KEY_ALIAS || 'my-key-alias';
const VERSION_CODE = process.env.ANDROID_VERSION_CODE;
const PROJECT_DIR = process.env.ANDROID_PROJECT_DIR
  || path.join(os.tmpdir(), 'servispro-twa');

if(!VERSION_CODE) throw new Error('ANDROID_VERSION_CODE env var is required (must strictly increase each build).');
if(!process.env.BUBBLEWRAP_KEYSTORE_PASSWORD || !process.env.BUBBLEWRAP_KEY_PASSWORD){
  throw new Error('BUBBLEWRAP_KEYSTORE_PASSWORD and BUBBLEWRAP_KEY_PASSWORD must be set before running this script.');
}
if(!fs.existsSync(KEYSTORE_PATH)) throw new Error(`Keystore not found at ${KEYSTORE_PATH}`);

// Bubblewrap's own first run is an interactive wizard asking where the
// JDK/Android SDK live -- write its config directly instead of going through
// that, using whatever this CI job already set up (setup-java + the manual
// SDK cmdline-tools install).
const jdkPath = process.env.JAVA_HOME;
const androidSdkPath = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
if(!jdkPath) throw new Error('JAVA_HOME must be set (e.g. via actions/setup-java).');
if(!androidSdkPath) throw new Error('ANDROID_SDK_ROOT or ANDROID_HOME must be set.');

const bubblewrapConfigDir = path.join(os.homedir(), '.bubblewrap');
fs.mkdirSync(bubblewrapConfigDir, { recursive: true });
fs.writeFileSync(
  path.join(bubblewrapConfigDir, 'config.json'),
  JSON.stringify({ jdkPath, androidSdkPath }),
);

const core = require('@bubblewrap/core');
const cliRoot = path.dirname(require.resolve('@bubblewrap/cli/package.json'));
const { generateTwaProject, generateManifestChecksumFile } = require(path.join(cliRoot, 'dist/lib/cmds/shared.js'));
const { TwaManifest, TwaGenerator } = core;

const nullPrompt = { printMessage: (m) => console.log(String(m)) };

async function main(){
  fs.mkdirSync(PROJECT_DIR, { recursive: true });

  const twaManifest = await TwaManifest.fromWebManifest(MANIFEST_URL);

  // Pin identity to match the app already on staff phones -- Android treats
  // a package-id/signing-key change as a different app, not an update,
  // regardless of what else changed in the manifest.
  twaManifest.packageId = PACKAGE_ID;
  twaManifest.signingKey = { path: KEYSTORE_PATH, alias: KEY_ALIAS };
  twaManifest.appVersionCode = parseInt(VERSION_CODE, 10);
  twaManifest.appVersionName = String(VERSION_CODE);

  console.log(`Building ${PACKAGE_ID} versionCode=${VERSION_CODE} from ${MANIFEST_URL}`);

  const twaGenerator = new TwaGenerator();
  await twaManifest.saveToFile(path.join(PROJECT_DIR, 'twa-manifest.json'));
  await generateTwaProject(nullPrompt, twaGenerator, PROJECT_DIR, twaManifest);
  await generateManifestChecksumFile(path.join(PROJECT_DIR, 'twa-manifest.json'), PROJECT_DIR);

  console.log(`Project generated at ${PROJECT_DIR}, running gradle build...`);
  execFileSync('node', [path.join(cliRoot, 'bin', 'bubblewrap.js'), 'build'], {
    cwd: PROJECT_DIR,
    stdio: 'inherit',
    env: process.env,
  });

  fs.copyFileSync(path.join(PROJECT_DIR, 'app-release-signed.apk'), path.join(ANDROID_DIR, 'ServisPro.apk'));
  fs.copyFileSync(path.join(PROJECT_DIR, 'app-release-bundle.aab'), path.join(ANDROID_DIR, 'ServisPro.aab'));
  console.log(`Copied signed APK/AAB into ${ANDROID_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

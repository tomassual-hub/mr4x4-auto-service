# ServisPro — Android APK

Generated via [PWABuilder](https://www.pwabuilder.com) from the live site
at `https://tomassual-hub.github.io/servispro/`, then signed so
it installs directly — no Play Store needed.

**2026-08-04 automation**: every push to `master` now rebuilds and
re-signs the APK/AAB automatically once the site finishes deploying (see
`.github/workflows/build-android.yml`) and publishes them as a
[GitHub Release](../../releases) tagged `android-vNNN` — no manual
Bubblewrap run needed anymore. **`ServisPro.apk`/`ServisPro.aab` in this
folder are the last *manually* built copies (2026-08-03, versionCode 2)**
and will lag behind; grab the newest signed build from the
[Releases page](../../releases) instead. They're left here as a stable
fallback direct-download link, not because they're current.

**2026-08-03 rebuild** (versionCode 2): regenerated with
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) directly
against the live manifest, reusing the same `signing.keystore` (same
`sha256_cert_fingerprints` as `assetlinks.json` — confirmed with
`apksigner verify`), so it installs as a normal update over the
existing app rather than a conflicting one. This picked up everything
shipped since the last build: the ServisPro rebrand cleanup and the
native bottom-sheet mobile nav (previously the app still had `Mr4x4`
strings baked in and the old sidebar-drawer nav).

A JDK, the Android SDK build-tools, and Bubblewrap are now installed
on this machine (Bubblewrap config at `~/.bubblewrap/config.json`), so
future rebuilds don't need PWABuilder's website — see "Rebuilding
locally with Bubblewrap" below.

⚠️ **Signing identity rotated 2026-07-31** — the previous keystore +
password had been sitting in plain text in a folder that left the
machine, so it's treated as compromised. This is a completely fresh
keystore; it shares no identity with the old one. Staff on the old
build must **uninstall it before installing this one** (Android refuses
to "update" over a different signature) — see "How staff install it"
below. The retired keystore/APK were deleted, not archived.

⚠️ **If the site's URL ever changes again** (moving hosts, custom domain,
etc.), this APK will need rebuilding the same way — a TWA's package
identity is derived from the domain it wraps, so Android treats a
same-app-different-domain rebuild as a totally different app, not an
update. Staff would need to uninstall the old one and install the new one
fresh; a fresh keystore from that rebuild is fine to use since the old
one's identity doesn't carry forward across a domain change anyway.

## Files

- **`ServisPro.apk`** — the file to share and install. Send this one via
  WhatsApp/email/USB to any Android phone.
- **`ServisPro.aab`** — Android App Bundle, only needed if this ever gets
  uploaded to the Google Play Store instead of sideloaded directly. Not
  used for the WhatsApp/email install flow below.
- **`signing.keystore`** + **`signing-key-info.txt`** — the signing
  identity used for this APK/AAB. **Keep both somewhere safe and
  private** (a password manager, not a plain folder that might get
  zipped/shared/backed up wholesale) — `signing-key-info.txt` contains
  the keystore password in plain text. You only need these again if you
  rebuild a future version of the app *at the same URL* and want Android
  to recognize it as an *update* rather than a conflicting app (Android
  checks the signature, not just the name). Don't commit these to a
  public repo or share them outside the shop — already gitignored, never
  tracked.
- **`assetlinks.json`** — hosted at
  `https://tomassual-hub.github.io/servispro/.well-known/assetlinks.json`
  so the installed app opens with zero browser UI (no address bar
  sliver at the top). Without it the app still installs and works, just
  shows a thin URL bar like a stripped-down browser tab. **Must match
  the `sha256_cert_fingerprints` of whichever keystore signed the APK
  currently being distributed** — the deployed copy is updated
  automatically as part of the site's own build, not this folder.

## How staff install it

Android blocks installs from outside the Play Store by default, so:

1. If they have an older version installed, **uninstall it first**
   (Settings → Apps → ServisPro / Mr 4x4 Auto Service → Uninstall) —
   only needed when the signing identity changed (see the warning at
   the top); a same-key rebuild would "update" over it instead.
2. Send `ServisPro.apk` to their phone (WhatsApp, email, etc.)
3. Open the file from Downloads/notifications
4. Android will prompt **"Install unknown apps"** — allow it for that app
   (WhatsApp, Files, or whichever app they opened it from)
5. Tap **Install**

Every time you rebuild a new version, it'll ask the same "unknown
sources" question again on first install — that's normal.

## Important limits

- This wraps your **live website** — the phone still needs internet to
  actually use the app day-to-day (same as the PWA "Add to Home Screen"
  install). It does **not** make the app itself work offline any more
  than the PWA version already does.
- If you rebuild this later (new icon, new manifest info, etc.) **without**
  reusing `signing.keystore`, Android will treat it as a totally different
  app and refuse to "update" over the old install — staff would need to
  uninstall the old one first. Reuse the keystore to avoid that (as long
  as the URL hasn't changed — see the warning at the top) *and* as long
  as that keystore hasn't been compromised the way the previous one was.

## Rebuilding locally with Bubblewrap

This is now automated in CI (see above) — you shouldn't normally need
this. Kept for manual rebuilds/debugging on this machine specifically.

Whenever the site changes and you want the APK to match (new branding,
new manifest fields, etc.):

```
bubblewrap update --appVersionCode=<next number>   # inside the project dir, see below
bubblewrap build
```

The generated Android project (not part of this repo — it's a scratch
build folder, not source) lives at `C:\bw-build\servispro-twa` on this
machine. `twa-manifest.json` there already points `signingKey` at this
folder's `signing.keystore`. Set these before running `build` so it
signs non-interactively instead of prompting:

```
$env:BUBBLEWRAP_KEYSTORE_PASSWORD = "<see signing-key-info.txt>"
$env:BUBBLEWRAP_KEY_PASSWORD = "<see signing-key-info.txt>"
```

Bump `appVersionCode` each rebuild (Play Store requires strictly
increasing version codes if this ever gets published there; sideloaded
installs don't strictly require it, but it's the correct habit). Then
copy the two output files here:

```
cp app-release-signed.apk  <repo>/android-app/ServisPro.apk
cp app-release-bundle.aab  <repo>/android-app/ServisPro.aab
```

**Windows-specific gotchas hit setting this up**, already fixed in the
installed copy (`%APPDATA%\npm\node_modules\@bubblewrap\cli\node_modules\@bubblewrap\core\dist\lib\`)
so you shouldn't hit them again unless Bubblewrap gets reinstalled/updated:
- `GradleWrapper.js` invoked bare `gradlew.bat` — this sandbox's `cmd.exe`
  doesn't resolve an unqualified command from cwd, so it's patched to
  `.\gradlew.bat`.
- `JarSigner.js` invoked bare `jarsigner` relying on PATH — same issue,
  patched to call the full `<javaHome>/bin/jarsigner.exe` path.
- The JDK installed via winget lands under `C:\Program Files\...`, and
  Bubblewrap's Windows `apksigner` invocation doesn't quote that path,
  so a space in `Program Files` broke it. Fixed with a directory
  junction: `C:\jdk17` → the real JDK install, referenced from
  `~/.bubblewrap/config.json` instead of the spaced path.

## iOS

There's no equivalent `.ipa` file possible here — Apple requires building
and signing on macOS with Xcode plus a paid Apple Developer account
($99/year), and even then, direct sideloading (no App Store, no
TestFlight) isn't really practical without extra tooling and re-signing
every 7 days on a free account. iOS staff should keep using "Add to Home
Screen" in Safari, which already installs and works like a real app.

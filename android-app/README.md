# Mr 4x4 Auto Service — Android APK

Generated via [PWABuilder](https://www.pwabuilder.com) from the live site
at `https://tomassual-hub.github.io/mr4x4-auto-service/`, then signed so
it installs directly — no Play Store needed.

⚠️ **If the site's URL ever changes again** (moving hosts, custom domain,
etc.), this APK will need rebuilding the same way — a TWA's package
identity is derived from the domain it wraps, so Android treats a
same-app-different-domain rebuild as a totally different app, not an
update. Staff would need to uninstall the old one and install the new one
fresh; a fresh keystore from that rebuild is fine to use since the old
one's identity doesn't carry forward across a domain change anyway.

## Files

- **`Mr 4x4 Auto Service.apk`** — the file to share and install. Send this
  one via WhatsApp/email/USB to any Android phone.
- **`signing.keystore`** + **`signing-key-info.txt`** — the signing
  identity used for this APK. **Keep both somewhere safe and private** —
  `signing-key-info.txt` contains the keystore password in plain text.
  You only need these again if you rebuild a future version of the app
  *at the same URL* and want Android to recognize it as an *update*
  rather than a conflicting app (Android checks the signature, not just
  the name). Don't commit these to a public repo or share them outside
  the shop — already gitignored, never tracked.
- **`assetlinks.json`** — hosted at
  `https://tomassual-hub.github.io/mr4x4-auto-service/.well-known/assetlinks.json`
  so the installed app opens with zero browser UI (no address bar
  sliver at the top). Without it the app still installs and works, just
  shows a thin URL bar like a stripped-down browser tab.

## How staff install it

Android blocks installs from outside the Play Store by default, so:

1. Send `Mr 4x4 Auto Service.apk` to their phone (WhatsApp, email, etc.)
2. Open the file from Downloads/notifications
3. Android will prompt **"Install unknown apps"** — allow it for that app
   (WhatsApp, Files, or whichever app they opened it from)
4. Tap **Install**

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
  as the URL hasn't changed — see the warning at the top).

## iOS

There's no equivalent `.ipa` file possible here — Apple requires building
and signing on macOS with Xcode plus a paid Apple Developer account
($99/year), and even then, direct sideloading (no App Store, no
TestFlight) isn't really practical without extra tooling and re-signing
every 7 days on a free account. iOS staff should keep using "Add to Home
Screen" in Safari, which already installs and works like a real app.

# Mr 4x4 Auto Service — Android APK

⚠️ **This APK points at the OLD site (`joyful-mochi-c1582a.netlify.app`).
The live site moved to GitHub Pages
(`https://tomassual-hub.github.io/mr4x4-auto-service/`) — this APK needs
rebuilding against the new URL, and because a TWA's package identity is
derived from the domain it wraps, Android will treat the rebuilt version
as a completely different app (not an in-place update). Staff will need
to uninstall this one and install the new one fresh. See "Rebuilding for
the new URL" below.**

Originally generated via [PWABuilder](https://www.pwabuilder.com) from
the live site, then signed so it installs directly — no Play Store
needed.

## Rebuilding for the new URL

1. Go to [pwabuilder.com](https://www.pwabuilder.com), enter
   `https://tomassual-hub.github.io/mr4x4-auto-service/`, let it analyze.
2. Generate an Android package — this time it'll assign a *new* package
   name (tied to the new domain), so `signing.keystore` from before
   doesn't carry forward the "same app" identity anyway; a fresh keystore
   from that download is fine to use.
3. Download, replace the files in this folder with the new ones.
4. Update `assetlinks.json` below (new package name + new fingerprint)
   and get it hosted at
   `https://tomassual-hub.github.io/mr4x4-auto-service/.well-known/assetlinks.json`
   (GitHub Pages serves whatever's committed to the repo at that path —
   ask Claude to wire it in like before).
5. Send the new APK to staff; they uninstall the old one first.

## Files

- **`Mr 4x4 Auto Service.apk`** — the file to share and install. Send this
  one via WhatsApp/email/USB to any Android phone.
- **`signing.keystore`** + **`signing-key-info.txt`** — the signing
  identity used for this APK. **Keep both somewhere safe and private** —
  `signing-key-info.txt` contains the keystore password in plain text.
  You only need these again if you rebuild a future version of the app and
  want Android to recognize it as an *update* rather than a conflicting
  app (Android checks the signature, not just the name). Don't commit
  these to a public repo or share them outside the shop.
- **`Mr 4x4 Auto Service.aab`** *(in the original PWABuilder download, not
  copied here)* — only needed if you ever submit to the Google Play Store
  proper. Not used for direct install.
- **`assetlinks.json`** — optional. If you want the installed app to open
  with zero browser UI (no address bar sliver at the top), host this file
  at `https://tomassual-hub.github.io/mr4x4-auto-service/.well-known/assetlinks.json`
  (stale for the old Netlify domain right now — see the rebuild note
  above). Skippable — without it the app still installs and works, just
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
  uninstall the old one first. Reuse the keystore to avoid that.

## iOS

There's no equivalent `.ipa` file possible here — Apple requires building
and signing on macOS with Xcode plus a paid Apple Developer account
($99/year), and even then, direct sideloading (no App Store, no
TestFlight) isn't really practical without extra tooling and re-signing
every 7 days on a free account. iOS staff should keep using "Add to Home
Screen" in Safari, which already installs and works like a real app.

# Working agreement for this repo

- **Auto-commit and push.** Once a change is made and verified (typecheck +
  build + `npm test` all pass, and any UI change has been visually checked),
  commit and push to `master` without asking first or waiting for the user
  to say "commit dan push" — and don't ask "should I commit and push now?"
  either, just do it and report what was pushed. Split unrelated changes
  into separate commits the same way past commits in this repo do. Still
  don't push if tests are failing or verification wasn't done.
- `master` is production: a push triggers CI (typecheck/build/test, then
  GitHub Pages deploy), and on success the Android workflow auto-builds,
  signs, and publishes a new APK/AAB release. So a push here is a real
  deploy, not just saving work — verify before pushing, not after.
- Still ask first for anything actually destructive or hard to reverse
  (force-push, `git reset --hard`, deleting branches, touching secrets) —
  this only pre-authorizes the normal commit-and-push loop.

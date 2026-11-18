# Limbus Browser (personal build)

Update source for a personal Limbus Company themed browser (Electron). The browser checks the latest
**Release** of this repository for `limbus-app.zip` and `limbus-app.json`, verifies the SHA-256, and
installs it on the next restart (rolling back automatically if the new version fails to start).

- `app/` the browser program (without `node_modules`; run `npm install --omit=dev` inside it)
- `hub/` the start-page hub (tier list, Identities, team builder, tracker)
- `tools/release.sh VERSION "notes"` builds `limbus-app.zip` + `limbus-app.json`

No personal data lives here. Fan project, not affiliated with Project Moon.

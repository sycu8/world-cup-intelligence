# Mobile store submission — PitchIntel

Native iOS and Android apps wrap the PitchIntel web client (Capacitor) and load data from the production API at `https://wcstat.orangecloud.vn`.

| Item | Value |
|------|--------|
| App name | PitchIntel |
| Bundle / application ID | `vn.orangecloud.pitchintel` |
| Privacy policy URL | https://wcstat.orangecloud.vn/privacy |
| Category | Sports |
| Price | Free |
| Gambling / betting | **No** — analytics only; disclaimers in-app |

---

## Build workflow

```bash
# 1. Web bundle for native shells
npm run build:mobile

# 2. Sync into Android / iOS projects
npm run mobile:sync

# 3. Regenerate icons/splash (after changing mobile/store-assets/icon.png)
npm run mobile:assets
```

### Android (Google Play)

Requires JDK 17+ and Android SDK (API 36).

```bash
chmod +x scripts/mobile-android-release.sh
# Optional: KEYSTORE_PASSWORD=... KEY_PASSWORD=... 
./scripts/mobile-android-release.sh
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

Signing: copy `android/keystore.properties.example` → `android/keystore.properties` and point to your upload keystore. **Never commit real passwords.**

Play Console checklist:

- [ ] Upload **AAB** (not APK)
- [ ] **Privacy policy URL**: https://wcstat.orangecloud.vn/privacy
- [ ] **Data safety**: no account, no payment, optional device storage (favorites in WebView localStorage), server logs (IP/UA) for API
- [ ] **Target audience**: not designed for children under 13
- [ ] **Ads**: No
- [ ] **In-app purchases**: No
- [ ] **Content rating**: Sports information; no simulated gambling
- [ ] Store listing text: see `mobile/store-listing.md`

### iOS (App Store)

Requires **macOS**, Xcode 15+, Apple Developer account.

```bash
chmod +x scripts/mobile-ios-release.sh
./scripts/mobile-ios-release.sh
```

Or open Xcode: `npm run mobile:ios` → Product → Archive → Distribute App.

App Store Connect checklist:

- [ ] **Privacy Policy URL**: https://wcstat.orangecloud.vn/privacy
- [ ] **App Privacy** (nutrition labels): Data linked to user = No; diagnostics = minimal server logs
- [ ] **Export compliance**: `ITSAppUsesNonExemptEncryption` = NO (standard HTTPS only)
- [ ] **Guideline 4.2**: App bundles local UI + native shell; not a bare bookmark to Safari
- [ ] **Guideline 5.3.4 (Gambling)**: Not applicable — no wagering; probability copy is analytical
- [ ] Screenshots: iPhone 6.7" and 6.1", optional iPad

---

## Policy compliance built into the app

1. **Privacy page** at `/privacy` (also on production after deploy)
2. **Market / probability disclaimers** — existing copy: “not betting advice”
3. **HTTPS-only** — Android `network_security_config`, iOS ATS
4. **Minimal permissions** — `INTERNET` only on Android; no camera, location, contacts
5. **No admin / API key UI** in mobile build (admin route redirects home)

---

## Architecture

```
mobile/www/          ← Vite mobile build (static SPA)
android/             ← Capacitor Android project
ios/                 ← Capacitor iOS project
capacitor.config.ts  ← appId, webDir, splash/status bar
app/lib/apiOrigin.ts ← VITE_API_ORIGIN for native API calls
```

Production API origin is baked into mobile builds via `vite.mobile.config.ts`.

---

## Deploy privacy page to production

Before store review, deploy `main` so https://wcstat.orangecloud.vn/privacy resolves:

```bash
npm run deploy:production
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank screen in app | Run `npm run mobile:sync`; check device network |
| API errors | Confirm `VITE_API_ORIGIN` in mobile build; CORS allows mobile WebView |
| Gradle SDK missing | Set `ANDROID_HOME` and install platform-tools + android-36 |
| iOS signing | Select team in Xcode → Signing & Capabilities |

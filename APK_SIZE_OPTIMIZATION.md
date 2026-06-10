# APK Size Optimization Report — SportSphere (Turf-1701)

**Current APK size:** ~100 MB  
**Target (Play Store soft limit):** ≤ 50 MB (AAB) | ≤ 150 MB (APK)  
**Realistic minimum achievable:** ~35–45 MB (AAB after all optimizations)

> Note: Google Play uses AAB (Android App Bundle), not APK. AAB ships only the ABI/density slice the user's device needs, so the *download size* will always be smaller than the raw APK. The numbers below refer to APK unless stated otherwise.

---

## Why 100 MB Today

| Category | Estimated contribution to final APK |
|---|---|
| Dual Firebase SDK (compat + native + web) | ~30–45 MB |
| ProGuard/minification disabled | ~15–25 MB extra (unused code kept) |
| `shrinkResources` disabled | ~5–10 MB extra (unused drawables kept) |
| Uncompressed PNG assets (logos) | ~4–5 MB |
| All ABI slices in one APK (x86, x86_64, arm64, armeabi) | ~15–20 MB extra vs AAB |
| Ubuntu font (3 weights × 330 KB) | ~1 MB |
| Dev-only dependencies leaking into release | ~2–5 MB |

---

## Issue 1 — Dual (Triple) Firebase SDK — CRITICAL

### What's happening

The app loads **three Firebase SDKs simultaneously**:

| SDK | Package | Purpose in app | Size in node_modules |
|---|---|---|---|
| React Native Firebase (native) | `@react-native-firebase/*` | Auth, Firestore, Messaging, Storage on native | ~87 MB |
| Firebase Modular (web) | `@firebase/*` | Used in service files via `Platform.OS === "web"` check | ~93 MB |
| Firebase Compat (legacy) | `firebase` (v8 compat API) | Only used for `expo-firebase-recaptcha` | ~29 MB |

The compat SDK is imported at the top of `App.js`, which means **it is bundled unconditionally** — the Metro bundler cannot tree-shake it out.

### Why this inflates the APK

Metro's tree-shaking only works at the module level for ES modules. Firebase compat uses CommonJS (`require`), so the entire ~29 MB library is included even if only one function is called. Combined with the web SDK (also pulled in by service files), you end up with two full Firebase implementations in a native app that only needs one.

### Fix

1. **Remove `firebase` (compat) package entirely.** Replace `expo-firebase-recaptcha` with a custom WebView-based reCAPTCHA or use Firebase App Check (which `@react-native-firebase/app-check` supports natively without the compat SDK).
2. **Remove `@firebase` (web modular) package** — already replaced by native SDK on Android/iOS. The `Platform.OS === "web"` branches in service files are only for web builds. If you are not shipping a web build, these imports are dead weight. If you do ship web, keep the web SDK but gate it with dynamic `require()` inside the platform branch so Metro can split it.
3. Keep only `@react-native-firebase/*` for native builds.

**Estimated saving: 25–50 MB from APK**

---

## Issue 2 — ProGuard + Resource Shrinking Disabled — HIGH

### What's happening

`android/app/build.gradle` has:

```groovy
def enableMinifyInReleaseBuilds = false  // ← should be true
shrinkResources false                    // ← should be true
```

This means the release APK contains:
- All Java/Kotlin bytecode including unused Firebase, Expo, and library classes
- All drawable resources even if never referenced

### Fix

```groovy
def enableMinifyInReleaseBuilds = true
shrinkResources true
```

Add/verify a `proguard-rules.pro` that keeps React Native and Firebase classes. Expo Prebuild generates a default one — it is usually sufficient.

**Estimated saving: 15–25 MB**

> **Risk:** ProGuard can strip classes that are accessed via reflection (common in Firebase). Test thoroughly on a real device after enabling. Firebase's own AAR already ships consumer ProGuard rules so most things work out of the box.

---

## Issue 3 — Single Fat APK Instead of AAB — HIGH

### What's happening

The current build produces a universal APK containing native `.so` libraries for all four ABIs:
- `armeabi-v7a` (32-bit ARM — old phones)
- `arm64-v8a` (64-bit ARM — modern phones, ~95% of users)
- `x86` (emulators)
- `x86_64` (emulators)

Each ABI copy of the React Native engine, Firebase native libs, and Hermes adds ~10–15 MB.

### Fix

**Switch to AAB for Play Store submission.** EAS Build already produces `.aab` by default for `production` profile. AAB lets Google Play deliver only the ABI slice the user's device needs.

For direct APK distribution (outside Play Store), build ABI-split APKs:

```groovy
android {
  splits {
    abi {
      enable true
      reset()
      include "arm64-v8a", "armeabi-v7a"
      universalApk false
    }
  }
}
```

**Estimated saving: 15–20 MB** (AAB download size vs universal APK)

---

## Issue 4 — Image Assets Uncompressed — MEDIUM

### What's happening

| File | Current size | Target |
|---|---|---|
| `assets/PlayGrid_Logo.png` | 2.55 MB | ~200–400 KB |
| `assets/SS_Logo.png` | 2.33 MB | ~200–400 KB |
| `assets/adaptive-icon.png` | ~50 KB | ~20 KB |
| `assets/splash.png` | ~50 KB | ~25 KB |

Logos at 2+ MB each are unusually large — these are almost certainly exported at print resolution (300 DPI, large canvas) and contain full alpha channels. Mobile screens never need more than ~512×512 px at 2× for a logo.

### Fix

1. Re-export logos at 512×512 px max (or 1024×1024 for @2x splash).
2. Run through [pngquant](https://pngquant.org/) with `--quality=65-85` — typically 50–70% reduction.
3. Optionally convert to WebP (Expo supports WebP; saves another 20–30% vs compressed PNG).

```bash
# Example (run once, not in build pipeline)
pngquant --quality=70-85 --output assets/PlayGrid_Logo_compressed.png assets/PlayGrid_Logo.png
```

**Estimated saving: 4 MB**

---

## Issue 5 — Fonts: All Weights Bundled — LOW-MEDIUM

### What's happening

Three Ubuntu font weights are bundled: Regular, Medium, Bold (~330 KB each = ~1 MB). App.json loads all three via `expo-font`.

### Fix

If the app only uses Bold and Regular (check usage), remove Medium. Alternatively, use a variable font — Ubuntu does not have an official variable font, but Roboto (Google Fonts) and Inter both do and can replace Ubuntu visually at ~180 KB for all weights.

**Estimated saving: 300–700 KB**

---

## Issue 6 — Dev Dependencies in Release Build — LOW-MEDIUM

### What's happening

`react-devtools-core` (16 MB in node_modules) and certain Babel plugins are dev-only but may leak into the production bundle if not properly excluded.

EAS Build runs `npm install --production=false` by default (to get native build tools), but Metro bundler should not include dev-only JS modules. Verify with:

```bash
npx expo export --platform android --dev false
# Check the bundle size output
```

### Fix

Audit `package.json` to ensure `react-devtools-core` and similar packages are under `devDependencies`, not `dependencies`.

**Estimated saving: 0–5 MB** (depends on what Metro actually bundles)

---

## Issue 7 — Hermes vs JSC — LOW

### What's happening

`android/app/build.gradle` sets `hermesEnabled = true`. This is correct — Hermes produces smaller bytecode than JSC and is the recommended engine for React Native production builds.

Confirm this is actually on in your EAS build:

```json
// eas.json
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

If Hermes is enabled, the JS bundle is pre-compiled to Hermes bytecode during build — this saves ~10–15% JS size and improves startup time.

**No action needed if already confirmed enabled.**

---

## Issue 8 — Unused @firebase Module Imports — LOW

### What's happening

The web SDK import files pull in ~46 Firebase sub-modules. Most native-only code paths import them inside `Platform.OS === "web"` checks, but static analysis during bundling may still include them.

If you proceed with removing `@firebase` for native (Issue 1 fix), this is automatically resolved.

---

## Estimated Size After All Fixes

| Fix | Saving |
|---|---|
| Remove compat + web Firebase SDK (Issues 1) | 25–50 MB |
| Enable ProGuard + shrinkResources (Issue 2) | 15–25 MB |
| Switch to AAB (Issue 3) | 15–20 MB (download size) |
| Compress images (Issue 4) | 4 MB |
| Font cleanup (Issue 5) | 0.3–0.7 MB |
| Dev dep audit (Issue 6) | 0–5 MB |

**Current:** ~100 MB APK  
**After Issues 1+2+3:** ~35–50 MB AAB download size  
**After all fixes:** ~30–40 MB AAB download size  

**Minimum realistically achievable for this stack:** ~28–35 MB (AAB)  
*(React Native + Expo baseline itself accounts for ~20–25 MB after full optimization)*

---

## Recommended Fix Order

```
Priority 1 (biggest bang, do first):
  [ ] Enable ProGuard + shrinkResources in build.gradle
  [ ] Switch EAS production profile to buildType: app-bundle
  [ ] Compress logo PNGs

Priority 2 (requires code changes, test carefully):
  [ ] Remove expo-firebase-recaptcha + firebase compat SDK
  [ ] Evaluate removing @firebase web SDK for native builds

Priority 3 (polish):
  [ ] Audit font weights in use
  [ ] Move devDependencies to correct section
  [ ] Verify Hermes is active in production profile
```

---

## Reference: Play Store & App Store Limits

| Store | Format | Hard limit | Recommendation |
|---|---|---|---|
| Google Play | AAB | 150 MB | < 50 MB download |
| Google Play | APK | 100 MB (legacy) | Use AAB instead |
| Apple App Store | IPA | 4 GB | < 50 MB OTA download |

At 100 MB you are over Google Play's legacy APK limit, which is why you're seeing rejections. Switching to AAB alone (Issue 3) plus ProGuard (Issue 2) will almost certainly get you under the limit even before touching Firebase.

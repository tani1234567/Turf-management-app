# iOS IPA Build via GitHub Actions — Complete Guide

**Project:** Play Grid (com.tanmaydevil.Turf1701)  
**Situation:** Mac available but Xcode version < 16 (cannot upgrade). Using GitHub Actions cloud runners (macOS 15 + Xcode 16/26) to build.  
**Goal:** Build a signed iOS `.ipa` file entirely in the cloud.

---

## How This Works (Big Picture)

Your Mac is used **only for 3 things**:
1. Generating a signing certificate (using Keychain Access — no Xcode needed)
2. Downloading the provisioning profile from Apple's website
3. Copying `GoogleService-Info.plist` from your project

GitHub Actions does **all the actual building** on Apple's macOS runners in the cloud, which have Xcode 16+ pre-installed.

```
Your Mac (no Xcode needed for these)          GitHub Cloud Runner (Xcode 16+)
─────────────────────────────────             ──────────────────────────────
1. Create certificate in Keychain    →        1. Checkout your code
2. Download provisioning profile     →        2. Install your certificate
3. Collect GoogleService-Info.plist  →        3. Install provisioning profile
4. Encode files → GitHub Secrets     →        4. expo prebuild (generate ios/)
                                              5. pod install
                                              6. xcodebuild archive
                                              7. xcodebuild export → .ipa
                                              8. Save .ipa as downloadable artifact
```

---

## PART 1 — Things You Need From Apple (Do This on Your Mac)

### Prerequisites
- An **Apple Developer Account** (paid, $99/year) — you need this to sign iOS apps
- Your Apple Developer account credentials (Apple ID + password)
- Your **Team ID** — find it at https://developer.apple.com/account → Membership Details → Team ID (looks like `AB12CD34EF`)

---

### Step 1.1 — Create a Certificate Signing Request (CSR)

This is done entirely in **Keychain Access** — no Xcode needed.

1. Open **Spotlight** (Cmd+Space) → type `Keychain Access` → open it
2. In the menu bar: **Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority...**
3. Fill in:
   - **User Email Address**: your Apple Developer email
   - **Common Name**: anything (e.g., `PlayGrid Distribution`)
   - **CA Email Address**: leave blank
   - Select **Saved to disk**
4. Click **Continue** → save the file as `CertificateSigningRequest.certSigningRequest` somewhere easy to find (e.g., Desktop)

---

### Step 1.2 — Create a Distribution Certificate on Apple Developer Portal

1. Open a browser → go to https://developer.apple.com/account/resources/certificates/list
2. Click the **`+`** button (top right)
3. Under **Software**, choose **Apple Distribution** → click **Continue**
4. Click **Choose File** → upload the `CertificateSigningRequest.certSigningRequest` from Step 1.1
5. Click **Continue** → click **Download**
6. You now have a file called `distribution.cer` (or similar) — save it to your Desktop

---

### Step 1.3 — Add the Certificate to Keychain and Export as .p12

1. Double-click the `distribution.cer` file you just downloaded — it automatically opens Keychain Access and installs it
2. In Keychain Access, in the left sidebar make sure you are in **login** keychain and **My Certificates** category
3. You should see **"Apple Distribution: Your Name (XXXXXXXXXX)"** listed
4. **Right-click** on it → **Export "Apple Distribution: ..."**
5. Save as `distribution.p12` on your Desktop
6. Set a **strong password** when prompted — write it down, you need it as a GitHub Secret
7. Click **OK**

You now have `distribution.p12` on your Desktop.

---

### Step 1.4 — Register Your App ID (if not already done)

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click **`+`** → select **App IDs** → **App** → Continue
3. Description: `PlayGrid`
4. Bundle ID: **Explicit** → `com.tanmaydevil.Turf1701`
5. Capabilities: enable **Push Notifications** (needed for your app)
6. Click **Register**

Skip this step if `com.tanmaydevil.Turf1701` already exists in your identifiers list.

---

### Step 1.5 — Register Test Devices (for Ad Hoc only)

If you are building **Ad Hoc** (to install on specific devices for testing), you must register each device.

1. Go to https://developer.apple.com/account/resources/devices/list
2. Click **`+`**
3. Enter the **UDID** of each test device
   - To find iPhone UDID: connect iPhone to Mac → open **Finder** → click iPhone in sidebar → click the device model name (it toggles between info) until you see **UDID**
4. Repeat for each device

Skip this step if you are building **App Store** distribution (for TestFlight upload).

---

### Step 1.6 — Create a Provisioning Profile

1. Go to https://developer.apple.com/account/resources/profiles/list
2. Click **`+`**
3. Choose your distribution type:
   - **Ad Hoc** → for testing on registered devices
   - **App Store** → for TestFlight / App Store submission
4. Click **Continue**
5. **App ID**: select `com.tanmaydevil.Turf1701` → Continue
6. **Certificate**: select the **Apple Distribution** certificate you just created → Continue
7. If Ad Hoc: **Devices**: select all the test devices → Continue
8. **Profile Name**: type `PlayGrid_Distribution` (or `PlayGrid_AdHoc`) → Generate
9. Click **Download** → save as `PlayGrid_Distribution.mobileprovision` on Desktop

---

### Step 1.7 — Locate GoogleService-Info.plist

Your Firebase config file for iOS.

1. This file should already be in your project at: `C:\Users\Tanmay\Desktop\Turf-1701\GoogleService-Info.plist`
   
   **If you don't have it:**
   - Go to https://console.firebase.google.com
   - Select your project (sowin-power)
   - Click the gear icon → **Project settings**
   - Under **Your apps**, find the iOS app (bundle ID: `com.tanmaydevil.Turf1701`)
   - Click **Download GoogleService-Info.plist**
   - If there is no iOS app listed, click **Add app** → iOS → enter bundle ID `com.tanmaydevil.Turf1701` → download

Make sure you have this file on your Mac (copy it from your Windows project if needed via USB/airdrop/email).

---

## PART 2 — Encode Files to Base64 (Do This on Your Mac)

GitHub Secrets cannot store binary files — you must convert them to Base64 text strings. Do each command in **Terminal** on your Mac.

### 2.1 — Encode the Certificate

```bash
base64 -i ~/Desktop/distribution.p12 | pbcopy
```

This copies the base64 string to your clipboard. Paste it into a temporary text file to save it — you will add it as a GitHub Secret shortly.

### 2.2 — Encode the Provisioning Profile

```bash
base64 -i ~/Desktop/PlayGrid_Distribution.mobileprovision | pbcopy
```

Copy and save the output.

### 2.3 — Encode GoogleService-Info.plist

```bash
base64 -i ~/Desktop/GoogleService-Info.plist | pbcopy
```

Copy and save the output.

---

## PART 3 — Add Secrets to GitHub

1. Go to your GitHub repository in a browser
2. Click **Settings** (top navigation of the repo)
3. Left sidebar → **Secrets and variables** → **Actions**
4. Click **New repository secret** for each of the following:

| Secret Name | Value | Where it came from |
|---|---|---|
| `IOS_DISTRIBUTION_CERT_BASE64` | base64 of `distribution.p12` | Step 2.1 |
| `IOS_CERT_PASSWORD` | password you set when exporting the `.p12` | Step 1.3 |
| `IOS_PROVISIONING_PROFILE_BASE64` | base64 of `.mobileprovision` | Step 2.2 |
| `GOOGLE_SERVICE_INFO_PLIST_BASE64` | base64 of `GoogleService-Info.plist` | Step 2.3 |

After adding all 4 secrets they will appear as `****` — that is normal and correct.

---

## PART 4 — Files to Add to Your Repository

You need to add 2 new files to your project before writing the workflow.

### 4.1 — ExportOptions.plist

This tells Xcode how to package the archive into an `.ipa`.

Create this file at: `.github/workflows/ExportOptions.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>

  <!-- 
    method: change based on your distribution type
      "ad-hoc"    → install on registered test devices
      "app-store" → upload to TestFlight / App Store
  -->
  <key>method</key>
  <string>ad-hoc</string>

  <!-- Your 10-character Apple Team ID from developer.apple.com/account → Membership -->
  <key>teamID</key>
  <string>YOUR_TEAM_ID_HERE</string>

  <!-- The exact name you gave your provisioning profile in Step 1.6 -->
  <key>provisioningProfiles</key>
  <dict>
    <key>com.tanmaydevil.Turf1701</key>
    <string>PlayGrid_Distribution</string>
  </dict>

  <key>signingStyle</key>
  <string>manual</string>

  <key>signingCertificate</key>
  <string>Apple Distribution</string>

  <key>compileBitcode</key>
  <false/>

  <key>stripSwiftSymbols</key>
  <true/>

  <key>thinning</key>
  <string>&lt;none&gt;</string>

</dict>
</plist>
```

**Replace `YOUR_TEAM_ID_HERE`** with your actual Team ID.  
**Replace `PlayGrid_Distribution`** with the exact name you typed when creating the provisioning profile in Step 1.6.

---

### 4.2 — The GitHub Actions Workflow File

Create this file at: `.github/workflows/build-ios.yml`

```yaml
name: Build iOS IPA

# When to run this workflow:
on:
  # Automatically on every push to master
  push:
    branches: [master]

  # Manually from GitHub UI (Actions tab → Run workflow button)
  workflow_dispatch:
    inputs:
      build_type:
        description: 'Build type (ad-hoc or app-store)'
        required: false
        default: 'ad-hoc'

jobs:
  build-ios:
    # macOS 15 has Xcode 16+ pre-installed on GitHub's cloud runners
    runs-on: macos-15

    # Total timeout: 60 minutes (IPA builds typically take 20-35 min)
    timeout-minutes: 60

    steps:

      # ══════════════════════════════════════════════════════
      # STEP 1 — Read all files (checkout the entire repo)
      # ══════════════════════════════════════════════════════
      - name: Checkout repository
        uses: actions/checkout@v4
        # This downloads every file in your repo to the runner

      # ══════════════════════════════════════════════════════
      # STEP 2 — Set up Xcode version
      # ══════════════════════════════════════════════════════
      - name: Select Xcode version
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: 'latest-stable'
          # 'latest-stable' picks the newest stable Xcode on the runner
          # To pin a specific version use: '16.2' or '26.0'

      - name: Print Xcode version (verify)
        run: |
          xcodebuild -version
          echo "Runner macOS: $(sw_vers -productVersion)"

      # ══════════════════════════════════════════════════════
      # STEP 3 — Set up Node.js
      # ══════════════════════════════════════════════════════
      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          # 'cache: npm' caches node_modules based on package-lock.json
          # so subsequent runs download far fewer packages

      # ══════════════════════════════════════════════════════
      # STEP 4 — Install JavaScript dependencies
      # ══════════════════════════════════════════════════════
      - name: Install npm dependencies
        run: npm ci
        # 'npm ci' is like 'npm install' but:
        # - Uses package-lock.json exactly (reproducible builds)
        # - Deletes node_modules first (clean install)
        # - Faster in CI environments

      # ══════════════════════════════════════════════════════
      # STEP 5 — Place GoogleService-Info.plist
      # Must exist BEFORE expo prebuild runs because
      # app.json references it via "googleServicesFile"
      # ══════════════════════════════════════════════════════
      - name: Write GoogleService-Info.plist
        run: |
          echo "${{ secrets.GOOGLE_SERVICE_INFO_PLIST_BASE64 }}" \
            | base64 --decode > $GITHUB_WORKSPACE/GoogleService-Info.plist
          echo "✅ GoogleService-Info.plist written"
          # Verify the file exists (do not print contents — it has API keys)
          ls -la $GITHUB_WORKSPACE/GoogleService-Info.plist

      # ══════════════════════════════════════════════════════
      # STEP 6 — Generate the native iOS project folder
      # Your repo does not have an ios/ folder committed.
      # expo prebuild generates it from app.json + your JS code.
      # This is required because @react-native-firebase needs
      # native code that only exists after prebuild.
      # ══════════════════════════════════════════════════════
      - name: Run expo prebuild (generate ios/ folder)
        run: |
          npx expo prebuild \
            --platform ios \
            --clean \
            --no-install
          # --clean    : delete any previously generated ios/ folder first
          # --no-install : skip pod install here; we do it in the next step
          echo "✅ expo prebuild complete"
          ls ios/

      # ══════════════════════════════════════════════════════
      # STEP 7 — Cache CocoaPods (speeds up subsequent runs)
      # ══════════════════════════════════════════════════════
      - name: Cache CocoaPods
        uses: actions/cache@v4
        with:
          path: ios/Pods
          # Cache key: changes when Podfile.lock changes (new pod added)
          key: pods-${{ runner.os }}-${{ hashFiles('ios/Podfile.lock') }}
          restore-keys: |
            pods-${{ runner.os }}-

      # ══════════════════════════════════════════════════════
      # STEP 8 — Set up Ruby and install CocoaPods
      # CocoaPods is a dependency manager for iOS native libraries.
      # It links all the native iOS packages (Firebase, etc.) to Xcode.
      # ══════════════════════════════════════════════════════
      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'

      - name: Install CocoaPods gem
        run: |
          sudo gem install cocoapods --no-document
          pod --version

      - name: Install CocoaPods dependencies (pod install)
        working-directory: ios
        run: |
          pod install --repo-update
          # --repo-update : refreshes the CocoaPods spec repository
          # This is important on fresh runners where the specs may be stale.
          # On cache-hit runs, this is skipped automatically for cached Pods.
          echo "✅ pod install complete"

      # ══════════════════════════════════════════════════════
      # STEP 9 — Install the Distribution Certificate
      # Creates a temporary keychain, imports your .p12 into it,
      # and grants codesign access so xcodebuild can sign the app.
      # ══════════════════════════════════════════════════════
      - name: Install distribution certificate into keychain
        env:
          CERT_BASE64: ${{ secrets.IOS_DISTRIBUTION_CERT_BASE64 }}
          CERT_PASSWORD: ${{ secrets.IOS_CERT_PASSWORD }}
        run: |
          # Decode the base64 .p12 file back to binary
          echo "$CERT_BASE64" | base64 --decode > /tmp/distribution.p12

          # Define keychain path and a random password
          KEYCHAIN_PATH="$RUNNER_TEMP/app-signing.keychain-db"
          KEYCHAIN_PASSWORD="temp-$(date +%s)-$$"

          # Store keychain password for use in later steps
          echo "KEYCHAIN_PATH=$KEYCHAIN_PATH" >> $GITHUB_ENV
          echo "KEYCHAIN_PASSWORD=$KEYCHAIN_PASSWORD" >> $GITHUB_ENV

          # Create a brand new temporary keychain
          security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

          # Set it as the default keychain for this session
          security default-keychain -s "$KEYCHAIN_PATH"

          # Unlock it (required before importing)
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

          # Set keychain lock timeout to 1 hour (3600 seconds)
          security set-keychain-settings -t 3600 -u "$KEYCHAIN_PATH"

          # Import the .p12 certificate
          # -T /usr/bin/codesign  → allow codesign to use this key
          # -T /usr/bin/xcodebuild → allow xcodebuild to use this key
          security import /tmp/distribution.p12 \
            -k "$KEYCHAIN_PATH" \
            -P "$CERT_PASSWORD" \
            -T /usr/bin/codesign \
            -T /usr/bin/xcodebuild

          # Grant access without UI prompts (critical for CI)
          security set-key-partition-list \
            -S "apple-tool:,apple:,codesign:" \
            -s \
            -k "$KEYCHAIN_PASSWORD" \
            "$KEYCHAIN_PATH"

          # Add this keychain to the system's search list
          security list-keychains \
            -d user \
            -s "$KEYCHAIN_PATH" \
            ~/Library/Keychains/login.keychain-db

          # Verify certificate imported correctly
          security find-identity -v -p codesigning "$KEYCHAIN_PATH"

          # Clean up decoded .p12 file
          rm /tmp/distribution.p12
          echo "✅ Certificate installed"

      # ══════════════════════════════════════════════════════
      # STEP 10 — Install the Provisioning Profile
      # Xcode looks for provisioning profiles in a specific
      # folder. We copy the decoded profile there using its UUID
      # as the filename (Xcode's required naming convention).
      # ══════════════════════════════════════════════════════
      - name: Install provisioning profile
        env:
          PROFILE_BASE64: ${{ secrets.IOS_PROVISIONING_PROFILE_BASE64 }}
        run: |
          # Decode the base64 .mobileprovision file
          echo "$PROFILE_BASE64" | base64 --decode > /tmp/profile.mobileprovision

          # Extract the UUID embedded inside the profile
          # (Xcode requires the filename to be the UUID)
          PROFILE_UUID=$(
            security cms -D -i /tmp/profile.mobileprovision \
            | plutil -extract UUID xml1 -o - - \
            | sed -n 's/.*<string>\(.*\)<\/string>.*/\1/p'
          )
          echo "Profile UUID: $PROFILE_UUID"
          echo "PROFILE_UUID=$PROFILE_UUID" >> $GITHUB_ENV

          # Create the Xcode provisioning profiles directory if it doesn't exist
          PP_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
          mkdir -p "$PP_DIR"

          # Copy the profile with UUID as filename
          cp /tmp/profile.mobileprovision "$PP_DIR/$PROFILE_UUID.mobileprovision"

          # Verify
          ls -la "$PP_DIR/$PROFILE_UUID.mobileprovision"

          # Clean up
          rm /tmp/profile.mobileprovision
          echo "✅ Provisioning profile installed (UUID: $PROFILE_UUID)"

      # ══════════════════════════════════════════════════════
      # STEP 11 — Find workspace name
      # expo prebuild names the workspace after the app slug
      # in app.json. We detect it dynamically so this works
      # even if the slug changes.
      # ══════════════════════════════════════════════════════
      - name: Detect workspace and scheme name
        run: |
          WORKSPACE=$(ls ios/*.xcworkspace | head -1)
          SCHEME=$(basename "$WORKSPACE" .xcworkspace)
          echo "WORKSPACE=$WORKSPACE" >> $GITHUB_ENV
          echo "SCHEME=$SCHEME" >> $GITHUB_ENV
          echo "Workspace: $WORKSPACE"
          echo "Scheme: $SCHEME"
          # List all available schemes for debugging
          xcodebuild -workspace "$WORKSPACE" -list

      # ══════════════════════════════════════════════════════
      # STEP 12 — Build iOS Archive
      # xcodebuild compiles all source code + links native
      # libraries → produces a .xcarchive (compiled app bundle
      # with debug symbols, ready for export).
      # ══════════════════════════════════════════════════════
      - name: Build iOS Archive
        run: |
          xcodebuild archive \
            -workspace "$WORKSPACE" \
            -scheme "$SCHEME" \
            -configuration Release \
            -sdk iphoneos \
            -archivePath "$RUNNER_TEMP/PlayGrid.xcarchive" \
            -destination "generic/platform=iOS" \
            CODE_SIGN_STYLE=Manual \
            CODE_SIGN_IDENTITY="Apple Distribution" \
            PROVISIONING_PROFILE="$PROFILE_UUID" \
            DEVELOPMENT_TEAM="YOUR_TEAM_ID_HERE" \
            | xcpretty --color && exit ${PIPESTATUS[0]}
          echo "✅ Archive built successfully"
        # xcpretty formats the raw xcodebuild output (thousands of lines)
        # into a readable summary. If xcpretty is not installed,
        # remove '| xcpretty --color && exit ${PIPESTATUS[0]}'

      # Install xcpretty for cleaner build logs
      - name: Install xcpretty
        run: gem install xcpretty --no-document
        # Note: move this step BEFORE Step 12 if you want to use xcpretty
        # It is placed here for documentation clarity only.

      # ══════════════════════════════════════════════════════
      # STEP 13 — Export Archive to IPA
      # Takes the .xcarchive and packages it into an .ipa file
      # using the signing identity and export options you set up.
      # ══════════════════════════════════════════════════════
      - name: Export IPA from archive
        run: |
          xcodebuild -exportArchive \
            -archivePath "$RUNNER_TEMP/PlayGrid.xcarchive" \
            -exportOptionsPlist ".github/workflows/ExportOptions.plist" \
            -exportPath "$RUNNER_TEMP/ipa"
          echo "✅ IPA exported"
          ls -la "$RUNNER_TEMP/ipa/"

      # ══════════════════════════════════════════════════════
      # STEP 14 — Save IPA as a downloadable GitHub Artifact
      # After this step, you can download the .ipa from the
      # GitHub Actions run page under "Artifacts".
      # ══════════════════════════════════════════════════════
      - name: Upload IPA artifact
        uses: actions/upload-artifact@v4
        with:
          # Artifact name includes the run number so each build is unique
          name: PlayGrid-iOS-Build-${{ github.run_number }}
          path: ${{ runner.temp }}/ipa/*.ipa
          retention-days: 30
          # 'error' means the step fails if no .ipa file is found
          if-no-files-found: error

      # ══════════════════════════════════════════════════════
      # STEP 15 — Clean up keychain (ALWAYS runs, even if build fails)
      # Removes the temporary keychain to prevent certificate
      # leaks if the runner is somehow reused.
      # ══════════════════════════════════════════════════════
      - name: Clean up temporary keychain
        if: always()
        run: |
          security delete-keychain "$KEYCHAIN_PATH" || true
          echo "✅ Keychain cleaned up"
```

**Important:** Replace `YOUR_TEAM_ID_HERE` on line with `DEVELOPMENT_TEAM` with your actual 10-character Apple Team ID.

---

## PART 5 — Final File Checklist

Before pushing to GitHub, verify these files exist in your project:

```
Turf-1701/
├── .github/
│   └── workflows/
│       ├── build-ios.yml           ← The workflow (created above)
│       └── ExportOptions.plist     ← Export config (created above)
├── GoogleService-Info.plist        ← NOT committed to git (add to .gitignore)
├── app.json                        ← Already exists
├── package.json                    ← Already exists
└── ... rest of your project
```

**Make sure `GoogleService-Info.plist` is in `.gitignore`:**

```
# Add to .gitignore
GoogleService-Info.plist
```

It must NOT be committed — it will be injected by GitHub Actions from the secret you set up.

---

## PART 6 — Push and Trigger the Build

```bash
git add .github/workflows/build-ios.yml
git add .github/workflows/ExportOptions.plist
git commit -m "add iOS GitHub Actions build workflow"
git push origin master
```

The workflow starts automatically on push. To monitor it:

1. Go to your GitHub repository
2. Click the **Actions** tab (top navigation)
3. Click the running workflow **"Build iOS IPA"**
4. Watch each step in real time — each step expands to show logs

Expected total build time: **25–40 minutes** (first run with no cache).  
Subsequent runs with pod cache: **15–20 minutes**.

---

## PART 7 — Download and Install the IPA

### 7.1 — Download from GitHub

1. Go to your repo → **Actions** tab
2. Click the completed workflow run (green checkmark ✅)
3. Scroll to the bottom → **Artifacts** section
4. Click **PlayGrid-iOS-Build-{N}** to download a `.zip`
5. Unzip it → you get `PlayGrid.ipa` (or similar name)

### 7.2 — Install on a Test Device (Ad Hoc)

**Option A — Apple Configurator 2 (on any Mac, free from App Store):**
1. Connect iPhone via USB
2. Open Apple Configurator 2
3. Drag the `.ipa` file onto the device

**Option B — Diawi (web, no Mac needed):**
1. Go to https://www.diawi.com
2. Upload the `.ipa` file
3. Share the generated link with testers
4. Tester opens the link on iPhone → installs directly

**Option C — TestFlight (if you built App Store distribution):**
1. Upload the `.ipa` to App Store Connect using Transporter app
2. Wait for processing (~15 min)
3. Invite testers via TestFlight

---

## PART 8 — Troubleshooting Common Errors

### ❌ "No signing certificate found"
- Your `IOS_DISTRIBUTION_CERT_BASE64` secret is corrupted or wrong
- Re-encode the `.p12`: `base64 -i distribution.p12` and verify the output starts with `MIIM...`
- Make sure you exported the **private key** with the cert (in Step 1.3, the `.p12` must include the private key — if Keychain says "This item has a private key", you're good)

### ❌ "No profiles for 'com.tanmaydevil.Turf1701' were found"
- The provisioning profile name in `ExportOptions.plist` doesn't exactly match what you named it on Apple Developer Portal
- Go to https://developer.apple.com/account/resources/profiles/list and copy the exact profile name

### ❌ "expo prebuild failed"
- Usually means a native module is missing something
- Check the step logs — look for the specific error
- Common fix: make sure `GoogleService-Info.plist` was written in Step 5 before prebuild runs

### ❌ "pod install failed"
- Check if there's a network error fetching pod specs (transient — re-run the workflow)
- Or a pod version conflict — check the logs for the specific pod name

### ❌ "Provisioning profile doesn't include the signing certificate"
- The provisioning profile was created with a different certificate than the one in your `.p12`
- Solution: create a new provisioning profile, selecting the exact certificate you exported

### ❌ xcpretty not found
- Either move the xcpretty install step before the archive step, or remove `| xcpretty --color && exit ${PIPESTATUS[0]}` from Step 12 to get raw logs instead

### ❌ Build takes > 60 minutes and times out
- Increase `timeout-minutes: 60` to `timeout-minutes: 90`
- The first run is always slowest (no pod cache)

---

## PART 9 — Summary of What You Need From Your Mac

| What | How to Get It | Format for GitHub |
|------|--------------|-------------------|
| Distribution Certificate | Keychain Access → export `.p12` | base64 → `IOS_DISTRIBUTION_CERT_BASE64` |
| Certificate Password | You set this during export | Plain text → `IOS_CERT_PASSWORD` |
| Provisioning Profile | Download from developer.apple.com | base64 → `IOS_PROVISIONING_PROFILE_BASE64` |
| GoogleService-Info.plist | Firebase console or already in project | base64 → `GOOGLE_SERVICE_INFO_PLIST_BASE64` |
| Apple Team ID | developer.apple.com → Membership | Hard-coded in `ExportOptions.plist` and `build-ios.yml` |

You do **not** need Xcode installed on your Mac for any of these steps. Keychain Access and a browser are sufficient.

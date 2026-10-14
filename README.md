# BookMind

AI-powered book recommendation engine that helps readers discover their next favorite book based on personal preferences.

## Architecture

**Frontend** — Vue 3 + TypeScript + Tailwind CSS
- Composition API with `<script setup>` syntax
- Pinia for state management (auth, language)
- Vue Router with auth guards
- Vue I18n (English, Italian, Spanish)
- IndexedDB for client-side preference caching

**Backend** — FastAPI (Python)
- OpenAI GPT-3.5-turbo for generating recommendations
- Google Books API for metadata enrichment (covers, ISBNs, page counts)
- Multilingual prompt engineering

**Auth & Storage** — Firebase
- Email/password authentication with local persistence
- Password recovery flow

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+

### Frontend

```sh
npm install
cp .env.example .env   # Fill in your API keys
npm run dev
```

### Backend

```sh
cd bookmind-server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Add your OpenAI API key
uvicorn main:app --reload
```

The frontend runs at `http://localhost:5173` and the API at `http://localhost:8000/docs`.

## Release build (Android App Bundle for Google Play)

Google Play publishes new apps only as a signed Android App Bundle (AAB), signed with an **upload key**; with Play App Signing, Google holds the app signing key ([Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756), [App Bundle](https://developer.android.com/guide/app-bundle)). The upload key and its keystore are created and kept by the operator, outside the repo, with a backup. Nothing secret is ever committed (`*.jks`, `*.keystore`, `*.p12` and `keystore.properties` are git-ignored).

### One-time: create the upload key (operator)

```sh
keytool -genkeypair -v -keystore ~/secure/bookmind-upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep the `.jks` and its passwords in a password manager and make a backup.

### Configure signing

Either copy `android/keystore.properties.example` to `android/keystore.properties` and fill it in, or export the same values as environment variables (these win over the file):

| `keystore.properties` | Environment variable             | Meaning                                             |
| --------------------- | -------------------------------- | --------------------------------------------------- |
| `storeFile`           | `BOOKMIND_UPLOAD_STORE_FILE`     | keystore path (absolute, or relative to `android/`) |
| `storePassword`       | `BOOKMIND_UPLOAD_STORE_PASSWORD` | keystore password                                   |
| `keyAlias`            | `BOOKMIND_UPLOAD_KEY_ALIAS`      | key alias (`upload` above)                          |
| `keyPassword`         | `BOOKMIND_UPLOAD_KEY_PASSWORD`   | key password                                        |

Without all four, `bundleRelease` / `assembleRelease` fail with an explicit message instead of producing an unsigned bundle. Debug builds never need them.

### Build

```sh
npm run build-only && npx cap sync android
cd android
export JAVA_HOME="<JDK 21>"   # Capacitor 8 compiles with Java 21
./gradlew :app:bundleRelease
# -> android/app/build/outputs/bundle/release/app-release.aab
jarsigner -verify -verbose -certs app/build/outputs/bundle/release/app-release.aab
```

Upload the `.aab` in Play Console (operator step).

### Versioning rule

`versionCode` and `versionName` live in `android/app/build.gradle` (`defaultConfig`).

-   **`versionCode`**: a positive integer, at most 2100000000, and **greater than every value already uploaded to Play** (Play rejects a `versionCode` used before, even for a release that was never published). Increment it by 1 for **every** AAB uploaded, including closed/internal testing and re-uploads of the same `versionName`. Never decrease it.
-   **`versionName`**: the string users see, `<major>.<minor>.<patch>` (e.g. `1.0.0`). Bump patch for fixes, minor for features, major for breaking changes. Several uploads can share a `versionName`; they never share a `versionCode`.
-   Change both in one commit (`chore(release): 1.0.1 (versionCode 2)`) before building the AAB.

Source: https://developer.android.com/studio/publish/versioning (checked 2026-10-14).

### Network security

The release build trusts system certificate authorities only and forbids cleartext (`android/app/src/main/res/xml/network_security_config.xml`). The debug build overrides that file (`android/app/src/debug/res/xml/network_security_config.xml`) to also trust user-installed CAs, so a local HTTPS backend on the emulator (`10.0.2.2`) keeps working.

## Features

- **Personalized Recommendations** — Configure genre, book length, historical period, complexity, and reading purpose
- **AI-Powered** — GPT-3.5-turbo generates curated book suggestions based on your criteria
- **Book Metadata** — Automatic enrichment with covers, page counts, and purchase links via Google Books API
- **Multilingual** — Full support for English, Italian, and Spanish
- **Daily Limits** — Built-in API usage tracking to manage costs
- **Mobile Ready** — Capacitor support for iOS and Android (coming soon)

# native-shell Specification

## Purpose
How the Capacitor native shell is built and configured: Android API levels and Capacitor version, system bars and safe-area insets, and keeping native and web layouts usable on phones and tablets. iOS requirements are added by card #55.
## Requirements
### Requirement: Android build targets the Play-mandated API level

The Android app SHALL be built with `compileSdkVersion = 36`, `targetSdkVersion = 36` and `minSdkVersion = 24`, on Capacitor 8 (`@capacitor/android` `^8.5.3`), so that it meets the Google Play target API requirement in force since 31 Aug 2026 (https://support.google.com/googleplay/android-developer/answer/11926878, checked 2026-10-07).

#### Scenario: Merged manifest declares API 36

-   **WHEN** `./gradlew :app:assembleDebug` completes and the merged manifest or `aapt2 dump badging` output of the debug APK is inspected
-   **THEN** `targetSdkVersion` is `36` and `minSdkVersion` is `24`

#### Scenario: Debug build installs and launches on Android 16

-   **WHEN** the debug build is installed on the `Pixel_9_API_36` and `Pixel_Tablet_API_36` emulators
-   **THEN** the app launches to the login screen (or to Home when a session exists) without a crash or a blank WebView

### Requirement: Capacitor packages stay in lockstep

`@capacitor/core`, `@capacitor/android`, `@capacitor/ios` and `@capacitor/cli` SHALL resolve to one identical 8.5.x version, and `npm ci` SHALL succeed without `--legacy-peer-deps`.

#### Scenario: Clean install

-   **WHEN** `npm ci` is run on a clean checkout of the branch
-   **THEN** it succeeds without peer-dependency errors and `package-lock.json` lists the same 8.5.x version for all four packages

### Requirement: Content is never obscured by system bars on Android

On Android, where edge-to-edge is enforced at targetSdk 36, no text, control or tap target SHALL render under the status bar, the navigation/gesture bar or a display cutout. Insets SHALL be read as `var(--safe-area-inset-<side>, env(safe-area-inset-<side>, 0px))`. The `--safe-area-inset-*` variables are injected on Android by the System Bars plugin with `insetsHandling: "css"`; `env()` is the fallback on Android WebView 140 and newer (https://capacitorjs.com/docs/apis/system-bars, checked 2026-10-07). In a desktop or mobile browser every inset SHALL resolve to 0, leaving the web layout unchanged.

#### Scenario: Header clears the status bar

-   **WHEN** Home, Preferences or Reading List is opened in portrait on the Android 16 phone emulator
-   **THEN** the header title, back arrow and menu button sit entirely below the status bar

#### Scenario: Scrolled content does not collide with the status bar

-   **WHEN** the Home or Reading List page is scrolled down on the Android 16 phone emulator so that the header leaves the viewport
-   **THEN** a solid scrim the height of the top inset covers the status-bar area, so scrolled text never overlaps the clock or status icons

#### Scenario: Chat composer clears the navigation bar

-   **WHEN** the Preferences chat is open with the keyboard closed, on the Android 16 phone emulator with gesture navigation
-   **THEN** the textarea and the Send button sit entirely above the gesture bar and can be tapped

#### Scenario: Footer clears the navigation bar

-   **WHEN** Home or Reading List is scrolled to the bottom on the Android 16 phone emulator
-   **THEN** the footer text sits entirely above the navigation bar

#### Scenario: Full-screen menu respects all insets

-   **WHEN** the hamburger menu is opened in portrait and in landscape on the Android 16 phone emulator
-   **THEN** the language selector, Preferences, Reading List and Logout controls are all fully visible and tappable, with none under a system bar or cutout

#### Scenario: Chat input stays reachable with the keyboard open

-   **WHEN** the chat textarea is focused on the Android 16 phone emulator
-   **THEN** the textarea and the Send button remain visible above the on-screen keyboard

#### Scenario: Browser layout unchanged

-   **WHEN** the app is served with `npm run dev` and viewed at 360 px and 1280 px wide
-   **THEN** the layout is identical to the pre-change baseline screenshots

### Requirement: Android status bar icons are legible on the light UI

The Android system bar icons SHALL be dark (System Bars style `LIGHT`, which the docs define as dark system bar content on a light background) whatever the device appearance setting, because BookMind has a light-only theme.

#### Scenario: Device in dark mode

-   **WHEN** the Android 16 phone emulator is switched to dark theme and the app is opened
-   **THEN** the status bar clock and icons are dark and readable against the app's light background

### Requirement: Android tablets get a resizable, rotatable layout without reloads

The app SHALL NOT lock orientation and SHALL NOT use the temporary `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` opt-out, because Android 16 ignores orientation and resizability restrictions on displays with smallest width ≥ 600dp (https://developer.android.com/about/versions/16/behavior-changes-16, checked 2026-10-07). The Android activity SHALL declare `navigation` and `density` in `configChanges`, so rotation, resize and density changes do not reload the WebView.

#### Scenario: Rotate the tablet during the chat

-   **WHEN** two chat messages have been sent on `Pixel_Tablet_API_36` and the emulator is rotated portrait → landscape → portrait
-   **THEN** the transcript and the typed-but-unsent input are still there (no WebView reload) and the layout fills the window in both orientations

### Requirement: Existing flows survive the upgrade unchanged on Android

Login, the conversational preferences chat, recommendation generation and the reading list SHALL behave on Capacitor 8 exactly as they did on Capacitor 6. Android system back SHALL behave as it did on the Capacitor 6 baseline recorded before the upgrade; changing that behaviour is out of scope (card #45).

#### Scenario: End-to-end flow on Android 16

-   **WHEN** on the Android 16 phone emulator a test user logs in, completes the preferences chat, receives recommendations, saves one book to the reading list, marks it read/liked, and relaunches the app
-   **THEN** every step succeeds and after relaunch the user is still signed in and the saved book is still in the reading list

#### Scenario: Back gesture parity

-   **WHEN** the system back gesture is performed on Home and on Preferences on the Android 16 phone emulator
-   **THEN** the result matches the baseline recorded on Capacitor 6 for the same screens


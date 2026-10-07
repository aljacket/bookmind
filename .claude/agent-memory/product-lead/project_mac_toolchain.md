---
name: mac-toolchain
description: Snapshot of the operator's Mac toolchain (Node, JDKs, Android Studio, SDK, AVDs, no Xcode) as of 2026-10-07
metadata:
  type: project
---
Snapshot 2026-10-07 — re-check before relying on it:
- Node 22.23.2 / npm 10.9.8; macOS 26.5.
- JDK on PATH: Temurin 17 via SDKMAN (`/usr/libexec/java_home` finds none). Capacitor 7/8 needs JDK 21: use Android Studio's JBR at `/Applications/Android Studio.app/Contents/jbr/Contents/Home`. Baseline on Capacitor 6 (Gradle 8.2.1) runs with JDK 17.
- Android Studio 2026.2 (updated 2026-10-07). SDK platforms android-34 and android-36; cmdline-tools/latest installed (sdkmanager, avdmanager available).
- AVDs: Pixel_9_API_35, Pixel_9_API_36, Pixel_Tablet_API_36.
- No Xcode (xcode-select → CommandLineTools), no CocoaPods.

**Why:** avoids re-discovering the environment each run. **How to apply:** see [[operator-decisions-2026-10-07]].

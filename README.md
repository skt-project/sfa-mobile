# Skintific SFA — STEP Mobile

Offline-first Android app for field salesmen (SE) and supervisors (SPV): route execution, store visits, order entry, and the approval workflow of the **STEP** platform.

**Current release: v1.4.2 (versionCode 11)** · app id `com.skintific.sfa` · Expo 57 / React Native 0.86 / TypeScript

> 📚 **Full system documentation lives in the web/backend repo:**
> [`sfa-step/docs/current/`](https://github.com/skt-project/sfa-step/tree/main/docs/current) — system overview, business rules, API reference, database guide, **mobile guide (05)**, operations runbook, changelog, E2E test scripts.

## Quick start

```bash
npm install          # postinstall applies patch-package + scripts/patch-cmake.js
npx expo start       # Metro dev server ('a' = Android)
```

Backend: the app talks to the STEP API on Google Cloud Run (`src/api/client.ts` → `BASE_URL`). Changing the API host requires shipping a new APK.

## Quality gates

```bash
npx tsc --noEmit     # 0 errors required
npx jest             # 12 unit tests (sync engine, offline store, GPS checkin, visit flow)
```

## Release build

1. Bump `versionCode`/`versionName` in `android/app/build.gradle` **and** `version` in `app.json`.
2. `cd android && ./gradlew assembleRelease`
3. APK at `android/app/build/outputs/apk/release/app-release.apk` (~116 MB). Installs over previous versions; SQLite data survives; users re-login after role/BU changes.

⚠ Release currently signs with the **debug keystore** — internal distribution only. `android/` is gitignored (regenerate via `npx expo prebuild`), so re-apply version bumps after a fresh prebuild.

## Architecture in one paragraph

Role-split navigation (SE vs SPV) over a fully offline visit flow: check-in (mandatory photo, informational GPS) → Business-Unit-filtered order entry (priced SKUs only) → checkout (Total Rupiah) → submit. Visits persist in expo-sqlite and replay through `src/sync/engine.ts` — single-flight mutex, debounced network-restore trigger, per-visit connectivity re-checks, crash recovery for interrupted flushes — against idempotent server endpoints, so retries never duplicate data. Route List shows per-store 🟡 Local / 🟢 Tersinkron sync state; submitted visits are read-only. Server state via TanStack Query (auto-invalidated after sync), local state via Zustand, JWT in expo-secure-store, design tokens in `src/theme.ts`.

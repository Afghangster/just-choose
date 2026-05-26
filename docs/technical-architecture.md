# Technical Architecture

## Stack

- React Native with TypeScript
- Expo prebuild-compatible native code
- React Navigation
- Zustand local state
- Zod-ready TypeScript domain models
- Supabase Auth, Postgres, RLS, and Storage
- Expo Notifications
- Native `DecisionLock` module interface with iOS Swift and Android Kotlin scaffolding

## Decision Lock Interface

The shared JavaScript module is `src/services/decisionLock/DecisionLock.ts`.

The native module name is `DecisionLock`, with the requested interface:

- `getStatus`
- `requestPermission`
- `openAppSelection`
- `getSelectedAppsSummary`
- `saveConfig`
- `getConfig`
- `startLock`
- `stopLock`
- `isLockActive`

When native support is unavailable, the JS adapter degrades safely:

- iOS without the native entitlement build returns unsupported and keeps the UI usable.
- Android returns the soft-lock fallback path: notifications, in-app active lock screen, and selected-app shielding unavailable.

## Supabase

Schema and RLS live in `supabase/migrations/20260524170538_initial_schema.sql`.

Current Supabase behavior requires explicit grants for Data API access in new projects that do not auto-expose public tables. The migration grants authenticated access to the public tables, then relies on RLS policies to restrict rows.

Relevant Supabase references:

- RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
- Data API grant change: https://supabase.com/changelog/45702-developer-update-may-2026

## Storage

Decision images use a private `decision-images` bucket. Uploads are scoped to the authenticated user’s folder. The app generates signed URLs for decision option images rather than making the bucket public.

## Native Build Notes

Run Expo prebuild before native work:

```sh
npx expo prebuild
```

iOS Screen Time implementation requires:

- Family Controls entitlement approval from Apple.
- FamilyActivityPicker UI for user-chosen apps/categories.
- Opaque FamilyActivitySelection persistence.
- ManagedSettingsStore shielding only for the owner-selected apps/categories.
- A DeviceActivity extension only if scheduling/monitoring is needed beyond the foreground app.

Android stricter shielding is not enabled in the MVP. Any future AccessibilityService usage requires a separate prominent disclosure, explicit consent, and Play Console declaration.

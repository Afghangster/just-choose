# Just Choose

Private decision cards for connected people, with profile demographics, private connection labels, and quick one-tap answers.

## Run

```sh
npm install
npm run start
```

Configure Supabase with:

```sh
cp .env.example .env
```

Then set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Onboarding uses native Apple Sign In on iOS, Apple OAuth in the browser on Android, and email/password as a fallback. Email confirmation is intentionally disabled so new users can enter the app immediately; OAuth accounts are verified by Apple.

## Verify

```sh
npm run typecheck
npx expo config --type public
supabase db lint --local --fail-on error
```

## Important Docs

- Product decisions: `docs/product-decisions.md`
- Technical architecture: `docs/technical-architecture.md`
- Store and marketing copy: `docs/store-and-marketing-copy.md`
- Privacy and terms outline: `docs/privacy-terms-outline.md`

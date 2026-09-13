# 10Doors Admin UI

Internal admin console for the 10Doors platform. Access requires an account with the
system-level `SYSTEM_ADMIN` entitlement (the default Administrator); the backend enforces
this on every `/v1/admin/**` and `/v1/marketing/**` call, and the UI signs out any user whose
`GET /v1/admin/me` response has `systemAdmin: false`.

## Modules

- **Overview** – public `/v1/health` probe (polled), DB status, uptime/version/profiles, traced-error counts, marketing agent state.
- **Traced Errors** – paginated `/v1/admin/traced-errors` with time window + errorCode filter; detail shows stack trace and captured request payload.
- **Clients & Admins** – administrators, clients (secrets redacted server-side), entitlements lookup by subject id.
- **Marketing Agent** – approval queue, publications (manual post + record result), agent activity audit log, reference data (objectives, campaigns, segments, channels, rules, insights).

## Development

```bash
npm install
npm run dev        # http://localhost:5174, proxies /api -> http://localhost:8080
npm run typecheck
npm run lint
npm run build      # build:staging / build:prod for other modes
```

Run the backend locally with the `dev` profile. Sign in with the dev administrator credentials.

## Configuration

Resolution order: `public/config/app-config.json` (runtime, replaced at deploy) → `VITE_*` from
`.env.<mode>` → defaults. Keys: `apiBaseUrl`, `clientId`, `clientSecret`, `apiKey`, `scope`.
`x-api-key` is sent on every request (including token calls) when configured.

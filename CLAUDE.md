# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git workflow

Always work directly on `main` — never create feature branches, and never
open PRs, even via `/create-pr` or similar. Commit finished work to `main`
locally, but **never `git push`** — pushing is the user's own manual step,
always left to them.

## Commands

```bash
npm run dev       # start Vite dev server (frontend only, not /api)
npm run build     # tsc -b (typecheck src + api/server, no emit) && vite build
npm run lint      # eslint .
npm run preview   # serve the production build locally
```

`vercel dev` (requires `vercel login`) is the only way to exercise `/api`
locally — Vite's dev server does not run serverless functions.

There is no test suite/runner configured in this project (matches
[LandingLornaEvans](../LandingLornaEvans), the closest sibling project).

## Architecture

React 19 + TypeScript + Vite SPA (`react-router-dom` v7) + Tailwind CSS v4,
**Supabase** (Postgres + Auth + Realtime) as the entire data backend, deployed
on Vercel as a static build. This mirrors
[LandingLornaEvans](../LandingLornaEvans)'s stack and single-admin auth
pattern almost exactly — the difference is this app *is* the admin panel
(no public marketing site) and it adds a WhatsApp bot as Vercel serverless
functions under `/api`.

### Data model (`supabase-setup.sql`, source of truth — run manually, no migrations)

- `pacientes`, `tratamientos` (soft-delete via `activo`), `turnos`,
  `turno_tratamientos` (join — a turno can have zero or more tratamientos;
  `precio_aplicado` snapshots the price at booking time so later catalog
  price changes don't rewrite history).
- `turnos.estado` is a **fixed 4-value enum** (Finalizado/Agendado/Cancelado/Otro)
  — it's Mai's list, don't add a 5th value. WhatsApp "confirmar" sets the
  separate `confirmado_paciente` boolean instead of inventing a "Confirmado"
  state.
- `finalizar_turnos_vencidos()`: a `pg_cron` job (every 15 min, scheduled in
  `supabase-setup.sql`) flips `Agendado` → `Finalizado` once `fecha + 1h <=
  now()`. Runs inside Postgres, not a Vercel Cron — Vercel's Hobby plan only
  allows daily crons, far too coarse for this. Revenue aggregation
  ([useDashboardStats.ts](src/hooks/useDashboardStats.ts),
  [useTopTratamientos.ts](src/hooks/useTopTratamientos.ts)) only sums
  `precio`/`precio_aplicado` for turnos already `Finalizado` — an `Agendado`
  turno can still be cancelled or no-show, so it doesn't count as revenue yet.
  `cantidad` (activity counts) still includes any non-`Cancelado` turno.
- `notificaciones`: written only by `api/whatsapp-webhook.ts`, read/marked-read
  by the frontend. `turno_id` is nullable — an unrecognized sender or an
  unmatched reply still produces a row so nothing silently drops.
- `upsert_turno(...)` Postgres function: creates/updates a turno **and**
  replaces its `turno_tratamientos` rows in one transaction (avoids a turno
  ever existing with a partial line-item set from two sequential client
  calls). Called via `supabase.rpc('upsert_turno', …)` from
  [useTurnos.ts](src/hooks/useTurnos.ts) — don't insert into `turnos` directly
  from the frontend for create/update.
- RLS: every table is `auth.role() = 'authenticated'` for all operations —
  unlike LornaEvans there is no public read anywhere, because there's no
  public site.
- `notificaciones` and `turnos` are added to the `supabase_realtime`
  publication; [useNotifications.ts](src/hooks/useNotifications.ts) and
  [useTurnos.ts](src/hooks/useTurnos.ts) subscribe so the bot's writes (and
  the FAB creating a turno from any page) show up live without a refresh.

### Auth

Single-admin, same pattern as LornaEvans: no public signup (disabled in the
Supabase dashboard), one account created manually.
[AuthContext](src/context/AuthContext.tsx) wraps `supabase.auth`;
[ProtectedRoute](src/components/ProtectedRoute/ProtectedRoute.tsx) redirects
to `/login`. Unlike LornaEvans, **every** route is protected (this whole app
is the admin panel) via one layout route in [App.tsx](src/App.tsx) wrapping
[AppLayout](src/components/AppLayout/AppLayout.tsx) (`Outlet`-based), instead
of wrapping each page individually.

### The turno form

[NuevoTurnoForm](src/components/NuevoTurnoForm/NuevoTurnoForm.tsx) is the
central form (spec'd fields: fecha, paciente, tratamiento(s), precio,
gift card, medio de pago, señado, estado). It's reused for both create and
edit — don't fork it. Paciente/tratamiento pickers are
[ComboboxCreatable](src/components/ComboboxCreatable/ComboboxCreatable.tsx),
one generic searchable-picker-with-inline-create component parameterized by
`multiple`, reused for both. Picking "crear nuevo" opens
[NuevoPacienteForm](src/components/NuevoPacienteForm/NuevoPacienteForm.tsx) /
[NuevoTratamientoForm](src/components/NuevoTratamientoForm/NuevoTratamientoForm.tsx)
stacked on top; because that nested form uses its **own** `usePacientes`/
`useTratamientos` hook instance, `NuevoTurnoForm` explicitly `refetch()`s its
own instance in the `onSaved` callback before selecting the new id — hook
state isn't shared across instances, so skipping this leaves the combobox
unable to render the just-created item's label.

Price auto-sums from selected tratamientos until the user edits the price
field by hand (`precioDirty` flag) — then it stops syncing. Editing an
*existing* turno starts with `precioDirty = true` (never silently overwrite a
possibly-manually-set historical price just because the edit modal opened).

All three forms (`NuevoPacienteForm`/`NuevoTratamientoForm`/`NuevoTurnoForm`)
use the same "outer wrapper returns null unless open, inner component holds
the hooks" split — mounting fresh on every open is what resets form state,
instead of a `useEffect` + `setState` (which the strict
`react-hooks/set-state-in-effect` lint rule below flags anyway).

### WhatsApp bot (`server/`, `api/`)

Meta WhatsApp Cloud API, chosen because it's plain HTTP/webhook — no
persistent process, which is what makes it viable as a Vercel serverless
function (rules out whatsapp-web.js/Baileys, which need a standing browser
session).

- `api/send-reminders.ts`: Vercel Cron (`vercel.json`, daily), gated by
  `CRON_SECRET` (`requireEnv` — the endpoint refuses to run at all without
  it, since it sends real messages and costs real API quota). Finds turnos
  scheduled for "tomorrow" in **Argentina time** — see
  [server/argentinaTime.ts](server/argentinaTime.ts), hardcoded UTC-3 (no DST
  in Argentina since 2009, so no timezone library needed) — with
  `estado='Agendado'` and no `reminder_sent_at` yet, sends the pre-approved
  reminder template (business-initiated messages outside the 24h window
  *must* be a template — that's a Cloud API rule, not a choice) per turno.
- `api/whatsapp-webhook.ts`: `GET` handles Meta's verification handshake.
  `POST` handles incoming replies — `bodyParser: false` because the
  `X-Hub-Signature-256` HMAC has to be verified against the **raw** body
  (re-serializing parsed JSON can byte-mismatch what Meta actually signed).
  [server/replyParser.ts](server/replyParser.ts) does keyword matching
  (confirmar/cancelar/reprogramar), not NLU — cancelado → `turnos.estado`,
  confirmado → `turnos.confirmado_paciente`, reprogramar → **no automatic
  field change**, just a notification (coordinating a new date isn't
  something to automate from a keyword match). Every reply, matched or not,
  produces a `notificaciones` row — see the data model section.
- `server/supabaseAdmin.ts` uses the **service role key** (bypasses RLS —
  correct here since these are trusted backend writes, not user-scoped
  requests). Never import this from `src/`.
- `server/` holds shared logic; `api/*.ts` files stay thin orchestration only,
  so anything testable lives in `server/` (see below).

### Google Calendar sync (`server/googleCalendar.ts`, `api/`)

Every turno syncs to Mai's Google Calendar (`primary` calendar of whichever
account did the one-time OAuth setup); the paciente is added as an attendee
(and gets Google's own invite email) when `pacientes.email` is set — no email
means the turno still lands on Mai's calendar, just without inviting anyone.

- One-time setup (see README): `api/google-oauth-start.ts` redirects to
  Google's consent screen (`access_type=offline`, `prompt=consent` — forces a
  refresh token even on a re-consent); `api/google-oauth-callback.ts` swaps
  the `code` for tokens and **displays the refresh token on the page** for
  Mai to copy into `GOOGLE_CALENDAR_REFRESH_TOKEN` by hand — it's never
  persisted by the app itself, only lives in Vercel env vars.
- `server/googleCalendar.ts`: thin wrapper, same shape as
  `server/whatsappClient.ts`. `getAccessToken()` exchanges the refresh token
  for a fresh access token on every call (no caching — call volume is low).
  `syncTurnoEvent(turno)` builds the event (title, `+1h` duration — same
  assumption as `finalizar_turnos_vencidos`, `America/Argentina/Buenos_Aires`
  timezone) and does `events.insert`/`events.update`/`events.delete`
  depending on whether `google_event_id` already exists and whether
  `estado === 'Cancelado'`.
- `api/sync-calendar.ts`: the only thing the frontend talks to — thin
  orchestration via `server/supabaseAdmin.ts`, reads the full turno (paciente
  + tratamientos), calls `syncTurnoEvent`, writes the resulting
  `google_event_id` back. `NuevoTurnoForm.tsx` fires this after `save()`
  resolves and in `handleDelete` before `deleteTurno()` — **never** await-blocks
  or reverts the Supabase write if the Calendar call fails, it just logs to
  the console, since a turno living in the app but not in Calendar is a far
  smaller problem than losing the turno data over a Google API hiccup.
  `api/whatsapp-webhook.ts` does the same delete-on-cancel when a patient
  replies "cancelar".
- Needs Google's sensitive-scope verification (`calendar.events`) to avoid
  the refresh token expiring every 7 days — see README setup steps.

### Styling

Tailwind v4 via `@tailwindcss/vite` (not `@tailwindcss/postcss` —
that's the Next.js-specific setup used in
[alma_ib-v2](../alma_ib-v2), the other reference project; this app is Vite).
Design tokens (colors, font) are defined once via `@theme` in
[src/index.css](src/index.css) and consumed as Tailwind utilities
(`bg-primary-500`, `text-ink-muted`, etc.) — don't hardcode hex values in
components. No component library — modal, combobox, dropdown are hand-rolled
Tailwind, matching alma_ib's own stated convention ("no heavy extra
libraries unless explicitly requested").

Charts (Recharts, in [MonthlyChart](src/components/MonthlyChart/MonthlyChart.tsx))
are intentionally **single-axis** — a monthly revenue bar chart, with turno
count available via tooltip and a table-view toggle, not a second y-axis.
Dual-axis charts invent a correlation that isn't in the data; don't add one
back if asked to show two metrics on one chart — do two charts, or a table,
instead.

### Routing / code-splitting

[App.tsx](src/App.tsx) lazy-loads every page except `Login` — `Dashboard`
pulls in Recharts, which is the single biggest dependency, so it's worth
keeping out of the initial bundle for a login screen nobody stays on.

### ESLint

Same `eslint-plugin-react-hooks` v7 (React Compiler rules) config as
LornaEvans, including `react-hooks/set-state-in-effect`, which is stricter
than most React projects. `tsconfig.server.json` covers `api/` + `server/`
separately from the app (`moduleResolution: "bundler"`).

**Every relative import between `api/` and `server/` needs an explicit
`.js` extension** (e.g. `from '../server/env.js'`, even though the file on
disk is `env.ts`) — `moduleResolution: "bundler"` tolerates this (maps the
`.js` specifier back to the real `.ts` file, same as Vite), but it is not
what actually builds the deployed functions. Vercel compiles `api/*.ts`
with its own internal `nodenext`-style resolution, which *requires* the
extension; without it, the function still deploys (`vercel build` doesn't
hard-fail) but crashes on every invocation in production with
`ERR_MODULE_NOT_FOUND` for the un-resolved sibling file. This was a live
bug from the first WhatsApp-bot deploy until 2026-08-20, caught only once
the Google Calendar endpoints were added and one crashed loudly enough to
investigate (`vercel inspect <deployment> --logs` is what surfaces the
real `tsc` errors — `vercel logs` only shows the runtime crash, not why).

### Environment variables

See [.env.example](.env.example) for the full list and
[README.md](README.md) for where each one comes from. `VITE_*` vars are
inlined at build time (frontend); the rest are server-only and must never
gain a `VITE_` prefix (or Vite would bundle them into the public client
build).

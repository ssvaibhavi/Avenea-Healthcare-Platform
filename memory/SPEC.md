# Avenea — App Spec

## What it is
Avenea ("A beautiful path to better health.") is a premium blush-pink preventive
healthcare platform for community health workers, clinics, and NGOs serving
rural/underserved communities. Opens as a branded editorial landing experience
first; the working app lives behind the same nav.

**All data is synthetic demo data.** Every record is flagged `seeded_demo` (seed
data) or created via the UI as a demo patient. The risk tier comes from a
transparent rule-based demo heuristic in `backend/models/screenings.py::compute_risk`
— NOT clinically validated. Pages carry a `SyntheticDataBanner` disclaimer.

## Stack & conventions
FastAPI + motor (backend/, port 8001), Vite + React 19 + Tailwind v4 +
shadcn/base-ui (frontend/, port 3000, `/api` proxied). All routes on `api_router`
under `/api`. Fonts: Lora (headings) + Plus Jakarta Sans (body) via
`@fontsource-variable`. Theme tokens in `frontend/src/index.css` (pink palette:
blush/rose/cream surfaces, plum text, sage accent). Hero art:
`frontend/public/hero-sculpture.jpg`.

## Design system (v2 editorial redesign)
User choices: soft blush base with rich rose accents; soft classic serif (Lora);
flowing ribbon/path lines + oversized editorial numbers & words.
- `index.css` utilities: `bg-atmosphere` + `grain` (App shell), `surface-silk`
  (default card), `surface-rose`, `surface-plum`, `glass-nav`, `text-outline(-light)`,
  `ink-rose`/`ink-blush` (gradient italic accents), `ribbon-flow`/`ribbon-sway`.
- `components/Ribbon.tsx`: animated SVG ribbons (variants hero/header/band/footer)
  + `RibbonDivider`.
- `PageHeader` takes `index` ("N° 02") and `word` (giant outlined word); every
  inner page passes both. Nav is a floating glass pill with an animated active pill.
- Cards carry oversized outlined numerals (registry index, result risk score,
  coordination I/II/III, analytics 01–04, screening step 01–05).

## Data model (backend/models/)
- `Patient`: id (uuid4 str), name, age, sex (female|male|other), community, phone,
  created_at, seeded_demo.
- `Screening`: id, patient_id, snapshot (patient_name/age/sex/community), vitals
  {systolic, diastolic, pulse, weight_kg, height_cm, glucose}, lifestyle
  {smoker, alcohol, activity(low|moderate|active)}, symptoms[str], notes, flags[str]
  (plain-language), risk_score, risk_level (low|moderate|high), referral_status
  (none|pending|scheduled|completed), referral_note, coordinator (str, "" =
  unassigned), referral_due_date (YYYY-MM-DD | null), created_at.
- Risk heuristic: BP ≥160/100 +3, ≥140/90 +2; glucose ≥200 +3, ≥140 +2; pulse >100 +1;
  age ≥60 +2 / ≥45 +1; smoker +1; alcohol +1; sedentary +1; symptoms count ≤3;
  red-flag symptom (chest_pain, breathlessness) +2. Score ≥7 high, ≥4 moderate, else low.
  Referral auto-opens (pending) for moderate/high.

## API (all under /api)
- `GET /patients` — list with roll-up (screening_count, last_screening_at,
  risk_level, referral_status from latest screening)
- `POST /patients` — create
- `PUT /patients/{id}` — partial update (name/age/sex/community/phone), returns PatientSummary; 404/422
- `GET /patients/{id}` — detail + full screening history
- `POST /screenings` — body `ScreeningCreate`: either `patient_id` (updates
  demographics in place) or `new_patient_name` + `age` (creates patient inline);
  plus vitals/lifestyle/symptoms/notes. Returns computed `Screening`. 422 if
  neither patient selector given.
- `GET /screenings?risk=&referral=&patient_id=&limit=` — list, newest first
- `PATCH /screenings/{id}/referral` — {referral_status, referral_note?, coordinator?, referral_due_date? (YYYY-MM-DD, 422 otherwise)}
- `GET /analytics/summary` — totals, risk_distribution, referral_pipeline,
  screenings_by_day (last 14 days, zero-filled), top_symptoms, avg_age, today (server date, used for overdue), demo: true
- Template `POST/GET /status` retained.

## Pages (frontend/src/pages/)
- `Home.tsx` — full-screen editorial landing: split hero (left copy + CTAs, right
  sculptural hero visual with floating glass stat cards), live demo stats strip,
  philosophy pillars, 3-step path, plum quote band, app tour, CTA band.
- `NewScreening.tsx` — 5-step guided wizard: Patient (existing picker / create
  inline) → Demographics → Vitals (BP required) → Lifestyle & symptoms → Review &
  save; sticky session rail; lands on /patients with success toast.
- `PatientRegistry.tsx` — dossier card grid, search + community select + risk
  chips, detail Sheet (history, "Edit details" inline form → PUT, "Printable
  summary" → /patients/:id/print, "Record a follow-up visit" →
  /new-screening?patient=<id> which preselects the patient), Add-patient Dialog.
- `PrintSummary.tsx` (`/patients/:id/print`) — one-page printable referral summary
  (latest screening, referral/coordinator/due, findings, history); nav/footer hidden in print.
- `ClinicalResults.tsx` — risk-tier tabs, result cards with vitals chips
  (out-of-range flagged), backend flags, risk meter, "Refer for follow-up" action.
- `CareCoordination.tsx` — 3-column board (pending/scheduled/completed),
  advance-referral actions + coordination notes + coordinator/due-date assignment
  (PATCH); "Overdue" badge when due date < server today (non-completed only).
- `Outreach.tsx` — editorial drives/education/field-notes content (labelled
  sample), live demo chips from analytics.
- `Analytics.tsx` — metric cards + recharts (area: screenings/day; donut: risk;
  h-bar: top symptoms; custom bars: referral pipeline). Synthetic-data labelled.

## Seed & demo state
`backend/seed.py` (idempotent, `FORCE=1` to reseed — narrowly deletes only
`seeded_demo: true` docs). Current DB: 14 patients, 14 screenings, 5 communities
(Rampur, Kishanganj, Belgaon, Sonapur, Hariyali), 9 open referrals. Nisha Verma
has no screenings (shows "Awaiting screening" state).

## Backend tests (Phase 1)
`cd /app/backend && python -m pytest tests` runs 148 tests: test_risk 49, test_validation 61, test_api 38.
- `test_risk.py` / `test_validation.py`: pure unit tests (no DB). These are regression pins of the EXISTING demo heuristic and models, not clinical validation.
- `test_api.py`: runs the app in-process (httpx ASGITransport, no lifespan), monkeypatches every router's `db` handle to a throwaway database named `avenea_test_<uuid>`, guards that the name differs from the live DB_NAME, and drops only that database on teardown. It NEVER touches the live `app` DB or the running uvicorn on :8001.
- The pre-built `conftest.py` `client`/`aclient` fixtures hit the LIVE server and DB, so do not use them for writes.

## Security foundation (Phase 2, INACTIVE)
`backend/security/` holds JWT verification (PyJWT), bcrypt hashing, roles and the permission
matrix, `authorize()`, `ScopedCollection` (org + relationship scoping), dependencies
(`get_principal`/`require`/`authorize_resource`), and sanitised audit events. **Nothing is wired
into server.py or the routers. All existing /api routes remain unauthenticated.**
See backend/security/README.md for the role matrix, endpoint mapping and activation steps.
`tests/test_security.py` (121 tests) uses synthetic identities, in-memory stores and isolated
`avenea_test_*` DBs, and guard-tests that the app hasn't imported the package.

## Phase 2B — ACTIVE authentication (dev/preview)
- Emergent-managed Clerk (email+password + Google). `backend/clerk_auth.py` verifies Clerk session JWTs (JWKS/RS256). `security/access.py`: `current_principal` -> role/org ONLY from `auth_memberships` (re-read every request); `require_access(action)`; `scoped()` folds org+relationship predicate into every query. Unknown users -> 403; ADMIN_EMAIL owner (verified email) bootstraps organisation_admin on first sign-in.
- Protected: GET/POST /api/patients, GET/PUT /api/patients/{id}, GET/POST /api/screenings, PATCH /api/screenings/{id}/referral, GET /api/analytics/summary (print page uses GET /patients/{id}). Public: /api/public/stats (aggregate counts only, landing page), /api/clerk/config, /api/, /api/status (template).
- Migration `migrations/m001_assign_demo_org.py` (additive, rehearsed, applied): all 14 patients/screenings -> org-avenea-demo; backups in backend/backups/; rollback commit c4a97da.
- Frontend: ClerkAuthProvider + TokenBridge (Bearer via api.ts), /sign-in & /sign-up (SignInPage), `<Protected>` on all app routes except `/`, UserButton (logout) in navbar when signed in, 401 -> /sign-in?expired=1. Demo creds in memory/test_credentials.md.
- Tests: 287 passing (incl. tests/test_access.py).

## Auth
None — no login/PIN anywhere. No credentials required.

## Handoff notes for testing
- Form factor: desktop (responsive down to mobile).
- No auth; all pages reachable from the nav.
- App is intentionally NOT dashboard-first; `/` is the landing.
- Numbers on Home hero cards (94.2%, 4,200+, 18 hubs) are static demo copy marked
  with `*Synthetic demo metrics`; the stats strip + Analytics/Observation counts
  are live queries over the synthetic records.

# TUFA Business AI

Platformë SaaS multi-tenant për kontabilitet, TVSH, deklarime, dokumente dhe analizë financiare — për bizneset dhe ekonomistët në Shqipëri. Produkt i TUFA Consulting.

Stack: **Next.js 16 (App Router, TypeScript) · Tailwind 4 · Recharts · Supabase (Postgres + RLS, Auth, Storage)** · pnpm monorepo.

Arkitektura e plotë, skema dhe plani i fazave: shih dokumentin "TUFA Business AI — Arkitektura e Sistemit (v1)".

## Struktura

```
apps/web/                 Next.js — UI, Server Actions, services
  src/app/(auth)/         login, register, auth/callback
  src/app/onboarding/     organizata + subjekti i parë
  src/app/app/[companyId] dashboard, invoices, vat, declarations, documents, reports, settings
  src/server/actions/     Server Actions (Zod → Supabase me sesionin e përdoruesit)
  src/server/services/    lexime (RPC-të SQL)
  src/lib/supabase/       klientët SSR + types.ts (gjeneruar nga DB)
  src/lib/i18n/           tekstet (sq)
packages/connectors/      interface Connector + connectors "pending"
agent/tufa-sync/          agjenti lokal (Python): lexon faturat nga CIS me certifikatën e biznesit → /api/sync/invoices
supabase/migrations/      0001–0016 (skema, RLS, triggers, funksione, importi CIS)
supabase/seed/            01 rregullat tatimore · 02 kalendari fiskal · 03 të dhëna DEMO
supabase/tests/           shim lokal + 74 teste RLS/integriteti
scripts/db-local.sh       DB lokale nga zero + teste
.github/workflows/ci.yml  CI: migrations + teste RLS, lint, typecheck, build, teste të agjentit
```

## Prodhimi

- App: https://tufa-business-ai.vercel.app (Vercel, projekt `tufa-business-ai`, root `apps/web`; çdo push në `main` bën deploy automatik)
- Databaza: Supabase `tufa-business-ai` (ref `znqptnmhfbhvwjzborbv`, Frankfurt), migrations 0001–0016 të aplikuara
- Rrjedha regjistrim → konfirmim email → onboarding → dashboard u testua në prodhim më 20.10.2026

## Nisja lokale

Kërkesa: Node 22, pnpm 10, PostgreSQL 16 (vetëm për testet e DB-së).

```bash
pnpm install

# 1. DB lokale për teste (migrations + seed + 44 teste RLS)
pg_ctl -D <data-dir> -o "-p 5433" start          # ose docker run -p 5433:5432 postgres:16
pnpm db:test

# 2. App-i web kundër projektit Supabase
cp apps/web/.env.example apps/web/.env.local     # vendos URL + publishable key
pnpm dev                                         # http://localhost:3000
```

Projekti i prodhimit: `tufa-business-ai` (ref `znqptnmhfbhvwjzborbv`, Frankfurt) — migrations 0001–0010 dhe seed 01–02 të aplikuara më 20.10.2026. Për një projekt të ri: apliko `supabase/migrations/*.sql` me radhë (CLI `supabase db push`, ose SQL editor), pastaj `supabase/seed/01_*.sql` dhe `02_*.sql`. `03_demo.sql` **vetëm** në projekte zhvillimi (krijon përdorues demo me fjalëkalim `Demo1234!`).

Rigjenerimi i tipeve pas çdo migration: `SUPABASE_PROJECT_REF=<ref> pnpm --filter @tufa/web gen:types`.

## Modeli i sigurisë (shkurt)

- Tenant-i i izolimit është **kompania** (`company_id` në çdo tabelë); organizata grupon kompanitë dhe mban abonimin.
- RLS në çdo tabelë; policies thërrasin `app.has_permission(company_id, modul, veprim)` që lexon matricën `permissions` sipas rolit (`org_owner`, `accountant`, `company_admin`, `finance_manager`, `operator`, `viewer`).
- App-i web përdor vetëm çelësin publik + sesionin e përdoruesit. `service_role` nuk ekziston në kodin e app-it.
- `audit_logs` është append-only (trigger `app.audit_row()` në çdo tabelë financiare).
- Periudhat e mbyllura bllokojnë INSERT/UPDATE/DELETE; rihapja vetëm me `reopen_period(id, arsye)` + audit.
- Normat tatimore jetojnë në `tax_rules` me `valid_from/valid_to`; asnjë normë në kod.
- Kredencialet e portaleve shtetërore **nuk ruhen** në Fazën 1.
- Certifikata e fiskalizimit (.p12) **nuk ngarkohet kurrë** në platformë: agjenti TUFA Sync e përdor lokalisht dhe dërgon vetëm faturat, me një çelës API për subjekt (`tba_…`, ruhet vetëm sha256, revokohet nga Cilësimet). Çelësi verifikohet brenda DB-së (`sync_cis_invoices`, SECURITY DEFINER) — pa service_role.

## Statusi i Fazës 1

| # | Dorëzimi | Statusi |
| --- | --- | --- |
| 1 | Skeleti i projektit, CI, README | ✅ |
| 2 | Migrations + RLS + audit + seed + 74 teste | ✅ |
| 3 | Auth (regjistrim, login, callback, rivendosje fjalëkalimi) · ftesa me link + rol · MFA | ✅ · MFA në vijim |
| 4 | Organizata + subjekte (onboarding, switcher, editim, subjekt i ri, anëtarë/ftesa) | ✅ |
| 5 | Import faturash nga fiskalizimi (CIS FiscalizationDataService) me agjentin TUFA Sync · Excel/CSV | ✅ CIS (testuar live 22.10.2026) · Excel në vijim |
| 6 | Regjistri i shitjeve/blerjeve: filtra, kërkim, eksport | ✅ |
| 7 | Dashboard (KPI, grafik 12 muaj, afate, debitorë) | ✅ |
| 8 | TVSH bazë: përmbledhje shitje/blerje sipas normave, normat në fuqi | ✅ |
| 9 | Dokumente: upload drag&drop, kategori, kërkim, signed URL, soft delete | ✅ |
| 10 | Deklarime: gjenerim sipas regjimit, statuset me audit, matrica e studios (/studio) | ✅ |
| 11 | i18n sq/en, dark mode, PWA | ✅ sq + dark/light + manifest · en në vijim |

Integrimet: `selfcare` (fiskalizimi/CIS) = functional pas sinkronizimit të parë me TUFA Sync · `manual_import` = functional · `cats` = pending_integration (pa API publike) · `bank` = unavailable.

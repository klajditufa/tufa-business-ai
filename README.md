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
supabase/migrations/      0001–0009 (skema, RLS, triggers, funksione)
supabase/seed/            01 rregullat tatimore · 02 kalendari fiskal · 03 të dhëna DEMO
supabase/tests/           shim lokal + 44 teste RLS/integriteti
scripts/db-local.sh       DB lokale nga zero + teste
.github/workflows/ci.yml  CI: migrations + teste RLS, lint, typecheck, unit tests, build
```

## Prodhimi

- App: https://tufa-business-ai-klajditufa.vercel.app (Vercel, projekt `tufa-business-ai`, root `apps/web`; çdo push në `main` bën deploy automatik)
- Databaza: Supabase `tufa-business-ai` (ref `znqptnmhfbhvwjzborbv`, Frankfurt), migrations 0001–0011 të aplikuara
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

## Statusi i Fazës 1

| # | Dorëzimi | Statusi |
| --- | --- | --- |
| 1 | Skeleti i projektit, CI, README | ✅ |
| 2 | Migrations + RLS + audit + seed + 44 teste | ✅ |
| 3 | Auth (regjistrim, login, callback) · ftesa, MFA | ✅ bazë · ftesa/MFA në vijim |
| 4 | Organizata + subjekte (onboarding, switcher, settings) | ✅ bazë · editimi në vijim |
| 5 | Import faturash Excel/CSV/XML me parapamje | ⏳ |
| 6 | Regjistri i shitjeve/blerjeve: filtra, kërkim, eksport | ✅ lexim · filtra/eksport në vijim |
| 7 | Dashboard (KPI, grafik 12 muaj, afate, debitorë) | ✅ |
| 8 | TVSH bazë | ⏳ (funksioni `vat_summary` ekziston) |
| 9 | Dokumente (upload, kategori, signed URL) | ⏳ (skema + storage policies ekzistojnë) |
| 10 | Deklarime: statuset + matrica e studios | ⏳ (skema ekziston) |
| 11 | i18n sq/en, dark mode, PWA | ✅ sq + dark/light + manifest · en në vijim |

Integrimet: `manual_import` = functional (parsers vijnë në #5) · `selfcare`, `cats` = pending_integration · `bank` = unavailable.

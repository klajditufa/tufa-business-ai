-- 0001 · Extensions dhe tipet e përbashkëta
-- TUFA Business AI · Faza 1
--
-- Rregull: çdo vlerë monetare është NUMERIC(18,2); asnjë float.
-- Rregull: çdo enum jeton këtu që migrations e tjera ta referojnë.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Skema e aplikacionit për funksione ndihmëse (jo të ekspozuara te PostgREST)
create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.organization_type as enum ('studio', 'single', 'demo');

create type public.org_role as enum ('org_owner', 'accountant');
create type public.company_role as enum ('accountant', 'company_admin', 'finance_manager', 'operator', 'viewer');

create type public.legal_form as enum ('pf', 'shpk', 'sha', 'ojf', 'tjeter');
create type public.tax_regime as enum ('standard', 'simplified', 'exempt');
create type public.period_status as enum ('open', 'closing', 'closed');

create type public.invoice_direction as enum ('sale', 'purchase');
create type public.invoice_type as enum ('normal', 'corrective', 'cancelled', 'summary');
create type public.invoice_source as enum ('manual', 'import', 'connector');
create type public.payment_status as enum ('unpaid', 'partial', 'paid', 'void');
create type public.payment_method as enum ('cash', 'bank', 'card', 'compensation', 'other', 'unknown');

create type public.import_format as enum ('xlsx', 'csv', 'xml', 'pdf', 'json');
create type public.import_status as enum ('queued', 'parsing', 'preview', 'importing', 'done', 'failed', 'reverted');
create type public.import_row_status as enum ('new', 'duplicate', 'error', 'imported', 'skipped');

create type public.tax_rule_kind as enum (
  'vat_rate', 'vat_exempt', 'profit_tax', 'simplified_tax', 'withholding',
  'social_contrib', 'health_contrib', 'min_wage', 'max_wage', 'payroll_tax_bracket', 'dividend_tax'
);
create type public.declaration_kind as enum ('vat', 'payroll_esig25', 'withholding', 'profit_tax', 'simplified', 'annual_financial', 'other');
create type public.declaration_status as enum ('pending', 'in_process', 'for_review', 'suspended', 'declared', 'late');
create type public.obligation_kind as enum ('vat', 'profit_tax', 'simplified_tax', 'withholding', 'social', 'health', 'income_tax', 'local_tax', 'penalty', 'other');

create type public.document_category as enum ('invoice', 'contract', 'bank', 'declaration', 'customs', 'employee', 'business', 'report', 'other');
create type public.ocr_status as enum ('none', 'queued', 'done', 'failed');

create type public.integration_provider as enum ('manual_import', 'selfcare', 'cats', 'bank');
create type public.integration_status as enum ('functional', 'demo', 'pending_integration', 'unavailable');
create type public.job_status as enum ('queued', 'running', 'done', 'failed');

create type public.task_status as enum ('open', 'in_progress', 'blocked', 'done', 'cancelled');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'unpaid');

-- Domain për monedha ISO 4217 (3 shkronja të mëdha)
create domain public.currency_code as char(3) check (value ~ '^[A-Z]{3}$');

-- Domain për NIPT/NUIS: shkronjë + 8 shifra + shkronjë (p.sh. K12345678A)
create domain public.nipt as text check (value ~ '^[A-Z][0-9]{8}[A-Z]$');

comment on domain public.nipt is 'NIPT/NUIS shqiptar: 1 shkronjë, 8 shifra, 1 shkronjë';

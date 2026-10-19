-- Seed · Kalendari fiskal global (afatet e përgjithshme, Shqipëri)
-- Afatet standarde: TVSH dhe listëpagesa/kontribute deri më 14 / 20 të muajit pasardhës; konfirmo sipas kalendarit zyrtar të DPT.
-- Gjeneron 18 muaj afate nga muaji aktual. Idempotent për rreshtat globalë.

delete from public.tax_calendar_items where company_id is null;

insert into public.tax_calendar_items (company_id, kind, title, due_date, recurrence, applies_to)
select null::uuid, 'vat'::public.declaration_kind, 'Deklarimi dhe pagesa e TVSH-së', (m + interval '1 month' + interval '13 days')::date, 'monthly'::text, '{"vat_registered":true}'::jsonb
from generate_series(date_trunc('month', current_date), date_trunc('month', current_date) + interval '17 months', interval '1 month') as m
union all
select null::uuid, 'payroll_esig25'::public.declaration_kind, 'Listëpagesa (E-Sig 25) dhe pagesa e kontributeve', (m + interval '1 month' + interval '19 days')::date, 'monthly', '{}'::jsonb
from generate_series(date_trunc('month', current_date), date_trunc('month', current_date) + interval '17 months', interval '1 month') as m
union all
select null::uuid, 'withholding'::public.declaration_kind, 'Deklarimi i tatimit në burim', (m + interval '1 month' + interval '19 days')::date, 'monthly', '{}'::jsonb
from generate_series(date_trunc('month', current_date), date_trunc('month', current_date) + interval '17 months', interval '1 month') as m;

-- Vjetore (vit pas viti; konfirmo datat zyrtare)
insert into public.tax_calendar_items (company_id, kind, title, due_date, recurrence, applies_to) values
  (null, 'profit_tax',       'Deklarata vjetore e tatimit mbi fitimin',           make_date(extract(year from current_date)::int + 1, 3, 31), 'yearly', '{"tax_regime":"standard"}'),
  (null, 'annual_financial', 'Dorëzimi i pasqyrave financiare në QKB',            make_date(extract(year from current_date)::int + 1, 7, 31), 'yearly', '{"legal_form":["shpk","sha"]}'),
  (null, 'simplified',       'Deklarata vjetore e biznesit të vogël',             make_date(extract(year from current_date)::int + 1, 2, 10), 'yearly', '{"tax_regime":"simplified"}');

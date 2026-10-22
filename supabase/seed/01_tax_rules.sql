-- Seed · Rregullat tatimore globale (Shqipëri)
-- confirmed = false deri sa t'i konfirmojë Klajdi/administratori i platformës (Vendimi #6 i arkitekturës).
-- Burimet janë referenca ligjore; vlerat duhen verifikuar kundrejt tekstit në fuqi për çdo periudhë.
-- Ekzekutohet idempotent: fshin dhe rishkruan vetëm rreshtat globalë të pakonfirmuar.

delete from public.tax_rules where scope = 'global' and confirmed = false;

insert into public.tax_rules (scope, kind, code, params, valid_from, valid_to, source, confirmed) values
-- TVSH (Ligji nr. 92/2014 "Për tatimin mbi vlerën e shtuar", i ndryshuar)
('global','vat_rate','standard',       '{"rate":20,"label":"Norma standarde 20%"}',                         '2015-01-01', null, 'Ligji 92/2014, neni 49', false),
('global','vat_rate','reduced_6',      '{"rate":6,"label":"Norma e reduktuar 6% (akomodim turistik, libra, agroturizëm)"}', '2019-01-01', null, 'Ligji 92/2014, neni 49/1; VKM përkatëse', false),
('global','vat_rate','reduced_10',     '{"rate":10,"label":"Norma e reduktuar 10% (inpute bujqësore)"}', '2019-01-01', null, 'Ligji 92/2014, neni 49/2', false),
('global','vat_rate','zero',           '{"rate":0,"label":"Furnizime me normë 0% (eksport, furnizime ndërkombëtare)"}', '2015-01-01', null, 'Ligji 92/2014, nenet 57–61', false),
('global','vat_exempt','exempt',       '{"rate":0,"label":"Furnizime të përjashtuara (pa të drejtë kreditimi)"}',       '2015-01-01', null, 'Ligji 92/2014, nenet 51–56', false),
('global','vat_exempt','threshold',    '{"annual_turnover":10000000,"currency":"ALL","label":"Pragu i regjistrimit në TVSH"}', '2021-01-01', null, 'VKM nr. 953/2014, e ndryshuar', false),

-- Tatimi mbi fitimin / tatimi i thjeshtuar (Ligji nr. 29/2023 "Për tatimin mbi të ardhurat")
('global','profit_tax','standard',     '{"rate":15,"label":"Tatim fitimi 15%"}',                            '2024-01-01', null, 'Ligji 29/2023, neni 33', false),
('global','simplified_tax','small',    '{"rate":0,"turnover_max":14000000,"currency":"ALL","label":"Biznes i vogël: tatim fitimi 0% deri në 14 mln ALL (deri 2029)"}', '2024-01-01', '2029-12-31', 'Ligji 29/2023, dispozita kalimtare', false),

-- Tatim në burim (Ligji 29/2023, neni 56)
('global','withholding','standard',    '{"rate":15,"label":"Tatim në burim 15% (qira, shërbime, interesa)"}', '2024-01-01', null, 'Ligji 29/2023, neni 56', false),
('global','dividend_tax','standard',   '{"rate":8,"label":"Dividend 8%"}',                                   '2019-01-01', null, 'Ligji 29/2023, neni 56', false),

-- Kontributet (Ligji nr. 7703/1993 "Për sigurimet shoqërore"; Ligji 10383/2011 "Për sigurimin shëndetësor")
('global','social_contrib','default',  '{"employee":9.5,"employer":15,"self_employed":23,"label":"Sigurime shoqërore: 9.5% punëmarrës + 15% punëdhënës"}', '2009-01-01', null, 'Ligji 7703/1993, i ndryshuar', false),
('global','health_contrib','default',  '{"employee":1.7,"employer":1.7,"self_employed":3.4,"label":"Sigurime shëndetësore: 1.7% + 1.7%"}', '2009-01-01', null, 'Ligji 10383/2011', false),
('global','min_wage','default',        '{"amount":40000,"currency":"ALL","label":"Paga minimale 40.000 ALL"}', '2023-04-01', '2025-12-31', 'VKM nr. 113/2023', false),
('global','min_wage','default',        '{"amount":50000,"currency":"ALL","label":"Paga minimale 50.000 ALL"}', '2026-01-01', null, 'VKM 2026', false),
('global','max_wage','default',        '{"amount":176416,"currency":"ALL","label":"Paga maksimale për kontribute 176.416 ALL"}', '2023-04-01', '2025-12-31', 'VKM përkatëse', false),
('global','max_wage','default',        '{"amount":186416,"currency":"ALL","label":"Paga maksimale për kontribute 186.416 ALL"}', '2026-01-01', null, 'VKM 2026', false),

-- Tatimi mbi të ardhurat nga punësimi (Ligji 29/2023, neni 24) — mujor, ALL
('global','payroll_tax_bracket','default',
 '{"currency":"ALL","label":"TAP mujor sipas Ligjit 29/2023",
   "brackets":[
     {"from":0,"to":50000,"rate":0,"note":"0%"},
     {"from":50001,"to":60000,"rate":13,"base_from":35000,"note":"13% mbi pjesën që tejkalon 35.000"},
     {"from":60001,"to":200000,"rate":13,"base_from":30000,"note":"13% mbi pjesën që tejkalon 30.000"},
     {"from":200001,"to":null,"rate":23,"fixed":22100,"base_from":200000,"note":"22.100 + 23% mbi pjesën që tejkalon 200.000"}
   ]}',
 '2024-01-01', null, 'Ligji 29/2023, neni 24', false);

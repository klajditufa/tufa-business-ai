# TUFA Sync (CIS Client)

> **Agjenti lokal i TUFA Business AI.** Lexon faturat e shitjes dhe blerjes nga
> sistemi i fiskalizimit (CIS) me certifikatën e biznesit dhe i dërgon në
> TUFA Business AI me `push`. Certifikata dhe fjalëkalimi i saj **nuk largohen kurrë nga
> ky kompjuter**: në TUFA shkojnë vetëm faturat. Shih [Dërgimi në TUFA](#dërgimi-në-tufa-business-ai).

Read a business's invoices straight from the Albanian fiscalization system
(CIS) with nothing but the business's own fiscalization certificate (`.p12`).
No tax-portal login and no third-party server: requests are signed on your
computer and go directly to the tax authority.

- **Sales and purchases** for any period, up to 1000 invoices per request.
  Long periods are split automatically, so a whole year comes in one go.
- **By item**: every invoice line, totalled per item (quantity, value, VAT),
  with units normalised (`kg`, `KG`, `Kg.` are one unit).
- **PDFs**: an invoice list, a summary by item, every invoice in one PDF or
  one PDF each (ZIP), and for e-invoices the tax authority's own PDF.
- **Several businesses**: load the certificate of each business you manage,
  switch between them, and see all of them side by side for a period
  (turnover, purchases, output and input VAT).
- **Registers**: taxpayer search by NIPT or name, the business's operators,
  business units and cash registers (TCRs).
- **Exports**: CSV (opens in Excel), JSON.

> **Shqip:** Nisni aplikacionin, ngarkoni certifikatën e fiskalizimit (`.p12`)
> dhe merrni shitjet, blerjet dhe artikujt drejtpërdrejt nga CIS, për një ose
> për shumë subjekte. Shihni [Si ta përdorni](#si-ta-përdorni).

## Dërgimi në TUFA Business AI

1. Në TUFA, hap subjektin → **Cilësimet → Sinkronizimi i faturave** → *Krijo çelës*.
   Çelësi (`tba_...`) shfaqet vetëm një herë; kopjoje.
2. Në kompjuterin ku ndodhet certifikata e fiskalizimit (Terminal / PowerShell,
   brenda kësaj dosjeje):

   ```sh
   export TUFA_URL=https://tufa-business-ai.vercel.app
   export TUFA_API_KEY=tba_...            # çelësi nga hapi 1
   export CIS_CERT=~/Downloads/certifikata.p12
   ./start.sh push --from 2026-01-01 --to 2026-10-31
   ```

   Për subjektet në TVSH me disa norma shto `--details`: dërgohen faturat e plota
   (artikujt dhe TVSH sipas normës), një thirrje shtesë në CIS për çdo faturë.
   Me artikujt, TUFA plotëson edhe **Raporte & mjete → Faturat sipas artikujve**.

   Për njësitë e biznesit, pajisjet (TCR) dhe operatorët (TUFA → **Raporte & mjete →
   Operatorët, njësitë & pajisjet**):

   ```sh
   ./start.sh push-registry               # ose: push-registry units tcrs
   ```

   Fjalëkalimi i certifikatës kërkohet në ekran (ose vendoset me
   `CIS_CERT_PASSWORD`). `push` lexon shitjet **dhe** blerjet e periudhës nga
   CIS dhe i dërgon në TUFA; `push sales` ose `push purchases` vetëm njërën.
3. Rikthimi i të njëjtës periudhë është i sigurt: TUFA i njeh faturat nga FIC
   (NIVF) dhe përditëson vetëm çfarë ka ndryshuar, pa dublikata.

Agjenti kontrollon që NIPT-i i certifikatës përputhet me subjektin të cilit i
përket çelësi; nëse jo, ndalon pa dërguar asgjë. Çelësi jep vetëm të drejtën
*të dërgojë fatura për atë subjekt* dhe revokohet nga TUFA në çdo moment.

Çfarë dërgohet: objektet e faturave siç i kthen CIS (FIC, IIC, EIC, datat,
palët, totalet, TVSH-ja, mënyra e pagesës). Çfarë **nuk** dërgohet: certifikata,
çelësi privat, fjalëkalimi.

## Contents

- [Si ta përdorni](#si-ta-përdorni)
- [Quick start](#quick-start)
- [What it does](#what-it-does)
- [Command line](#command-line)
- [Python library](#python-library)
- [Local JSON API](#local-json-api)
- [How it works](#how-it-works)
- [Project layout](#project-layout)
- [Development](#development)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Sharing a clean copy](#sharing-a-clean-copy)
- [Porting to another language](#porting-to-another-language)

## Si ta përdorni

1. Instaloni **Python 3.9 ose më të ri** nga [python.org](https://www.python.org/downloads/)
   (në Windows shënoni "Add Python to PATH").
2. Nisni aplikacionin: në Windows klikoni dy herë `start.bat`, në macOS/Linux
   ekzekutoni `./start.sh`. Herën e parë instalohen paketat (zgjat pak).
3. Shfletuesi hapet te `http://127.0.0.1:8765/`. Mbajeni dritaren e terminalit
   të hapur sa kohë e përdorni.
4. Tërhiqni certifikatën `.p12` në faqe dhe shkruani fjalëkalimin, nëse ka.
   Mjedisi mbetet **Automatik**: aplikacioni e njeh vetë Test apo Production.
5. Te *Shitjet* ose *Blerjet* zgjidhni periudhën (ose shkruani datat, p.sh.
   `01.10.2026`) dhe shtypni **Merr faturat**.
   - **Sipas artikujve** jep totalet për çdo artikull.
   - Butoni **PDF** krijon listën, përmbledhjen, ose të gjitha faturat në PDF.
   - Klikoni një faturë për ta parë të plotë.
6. Për subjekte të tjera: menyja lart djathtas → **Shto një subjekt**. Skeda
   **Të gjitha subjektet** tregon xhiron, blerjet dhe TVSH-në e të gjithëve.

Certifikatat mbahen vetëm në kujtesë sa kohë aplikacioni është i hapur; nuk
ruhen në disk dhe nuk dërgohen askund përveç pjesës publike që shoqëron çdo
kërkesë drejt tatimeve.

## Quick start

You need **Python 3.9 or newer**. Node.js is *not* needed: the web interface
comes built.

| System | Start the app |
| --- | --- |
| macOS / Linux | `./start.sh` |
| Windows | double-click `start.bat` |

The first start creates a private environment in `.venv` and installs the
three dependencies (`cryptography`, `lxml`, `certifi`); later starts are
instant. The app opens at `http://127.0.0.1:8765/`, in Albanian (switch with
**SQ / EN** at the top). Keep the terminal window open while you use it; close
it (or press Ctrl+C) to stop.

Manual setup, if you prefer: `python3 -m venv .venv`, then
`.venv/bin/pip install -r requirements.txt` and `.venv/bin/python -m cis_client`.
Or install it as a package with `pip install .` and run `cis-client`.

## What it does

**Invoices.** Pick a period (a preset, or dates typed as `dd.mm.yyyy`) and
fetch. Filter by number, NIPT, name or fiscal code and by type (cash,
non-cash, e-invoice, corrective). Sort any column, and choose rows per page.
Click an invoice to see it in full: parties, items, VAT breakdown, payments,
fiscal codes and the verification link.

**By item.** CIS's period lists carry no invoice lines, so the app fetches
each invoice once (four at a time, with progress and a stop button) and keeps
it for the session. Lines are grouped by item name and unit, ignoring case and
accents. Item codes differ between issuers, so codes are listed rather than
used for grouping. Click an item to see every line it appears on.

**PDFs** (the *PDF* menu, for what the filter shows):

| Option | Contents |
| --- | --- |
| Invoice list | date, number, partner, type and totals of every invoice |
| Summary by item | quantity, net, VAT and total per item |
| All invoices in one PDF | every invoice in full, one after another |
| Each invoice as its own PDF | a ZIP with one PDF per invoice |

The invoice PDF is an A4 layout with parties, details, items, VAT breakdown,
payments, fiscal codes and the verification QR code. It is marked as an
informative copy; for e-invoices the tax authority's own PDF is available too.

**Several businesses.** Each certificate you load is a business. The menu in
the top bar switches between them and adds more. *All businesses* fetches one
period for every business and shows the following, with CSV and PDF exports:

- sales count and turnover (excl. VAT);
- output VAT;
- purchases and input VAT;
- the VAT difference.

**Preferences** (language, theme, last tab, rows per page, invoice/item mode,
period preset, sorting) are kept in the browser under one key,
`cis-client.preferences`.

## Command line

```sh
export CIS_CERT=company.p12            # or pass --cert company.p12 to every command
export CIS_CERT_PASSWORD='secret'      # otherwise you are asked for it (if the file has one)

cis-client info --check                                   # certificate details, confirmed with CIS
cis-client sales --from 2026-09-01 --to 2026-09-30        # one page (up to 1000) as a table
cis-client sales --from 2026-01-01 --to 2026-09-30 --all --format csv -o sales.csv
cis-client purchases --from 2026-09-01 --to 2026-09-30 --items --format csv -o lines.csv   # every line
cis-client purchases --from 2026-09-01 --to 2026-09-30 --by-item                           # totals per item
cis-client purchases --fic 2ed48eff-f3d0-4315-a2a5-16618c63ad0b   # one full invoice with items (JSON)
cis-client taxpayers vodafone
cis-client operators
cis-client business-units
cis-client tcrs
cis-client pdf 5e0a7d9e-ebc4-41d8-9669-0800200c9a66 --party BUYER -o invoice.pdf   # official e-invoice PDF
cis-client serve --port 8765 --no-browser                 # web app; same as running without a command
```

Without `pip install .`, use `python -m cis_client` instead of `cis-client`.
Common options are:

- `--env production|test` (default: detected from the certificate);
- `--format table|json|csv` and `-o FILE`;
- `--timeout SECONDS`;
- `--debug`, given before the command, to print the SOAP messages.

Tables fit the terminal width.

## Python library

```python
from cis_client import PURCHASES, SALES, CisClient, CisFault, summarise_items

client = CisClient.from_file("company.p12", password="secret")  # environment from the certificate

page = client.get_sales("2026-09-01", "2026-09-30")  # one page of up to 1000
print(page.count, page.pages, page.invoices[0]["TotPrice"])

purchases = client.fetch_all_invoices(PURCHASES, "2026-01-01", "2026-09-30")  # every page
complete = client.get_invoice_details(purchases, PURCHASES)  # each with "Items" (4 lookups at a time)
for row in summarise_items(complete)[:10]:
    print(row["ItemName"], row["Quantity"], row["Unit"], row["Price"])

client.get_taxpayers("K11715005L")  # [{"Tin", "Name", "Address", "Town", "Country"}]
client.get_operators()  # [{"name", "opCode", "idNumber", "validFrom", "validTo", ...}]
pdf = client.get_einvoice_pdf(eic, "BUYER")  # EinvoicePdf(eic, pdf=b"%PDF-...") or None

try:
    client.get_sales("2020-01-01", "2026-12-31")
except CisFault as fault:
    print(fault.fault_code, fault.fault_string, fault.hint)  # 87, "Excessive number of invoices ...", ...
```

Invoices are plain dictionaries with CIS's own field names, every scalar left
as the string CIS sent (`"120.00"`, `"true"`). The helpers are:

- `convert.net_amount`, `flatten_invoice` and `flatten_items` (CSV rows);
- `summarise_items` and `totals`;
- `verification_url`;
- `units.unit`, for unit normalisation.

[`examples/purchase_costs.py`](examples/purchase_costs.py) sums a period's
purchase costs per supplier and per item.
[`examples/export_month.py`](examples/export_month.py) exports last month to CSV.

## Local JSON API

While the app runs, other programs on the same computer can use the same data
on `http://127.0.0.1:8765`.

| Method and path | Body | Returns |
| --- | --- | --- |
| `GET /api/session` | | `{version, active, businesses: [{id, environment, verified, warning, certificate}]}` |
| `POST /api/session` | `{"certificate": "<base64 .p12>", "password": "...", "environment": null}` | session; the business becomes active |
| `POST /api/session/active` | `{"id": "..."}` | session |
| `POST /api/session/environment` | `{"environment": "test"}` | session |
| `DELETE /api/session` | | session without that business |
| `POST /api/overview` | `{"FromDate", "ToDate"}` | `{businesses: [{id, sales, purchases, error}]}` with count, net, vat and total |
| `POST /api/v1/utilities/cis-invoices/sales` | `{"FromDate", "ToDate", "Page"}` or `{"FIC"}` or `{..., "All": true}` | invoice array; total in `X-Total-Count` |
| `POST /api/v1/utilities/cis-invoices/purchases` | same as sales | same as sales |
| `POST /api/v1/utilities/get-taxpayers` | `{"searchTerm": "vodafone"}` | `[{Tin, Name, Address, Town, Country}]` |
| `POST /api/v1/utilities/get-operators` | `{}` | `[{name, opCode, ...}]` |
| `POST /api/v1/utilities/get-business-units` | `{}` | `[{BUCode, BUName, ...}]` |
| `POST /api/v1/utilities/get-tcrs` | `{}` | `[{TCRCode, ...}]` |
| `POST /api/v1/utilities/einvoice-pdf` | `{"EIC": "...", "PartyType": "BUYER"}` | `{eic, base64, details}` |

- **Choosing the business:** requests use the active business, or the one
  named in an `X-Business: <id>` header.
- **Dates:** `YYYY-MM-DD`, whole days in Albanian time.
- **Errors:** `{"message", "field"?, "cisError"?, "hint"?, "unreachable"?}` with
  status 400 (bad input), 401 (no such certificate loaded), 422 (CIS refused
  the request) or 502 (CIS down or failing).
- **Who may call it:** the server listens on `127.0.0.1` only, rejects
  requests whose `Host`/`Origin` is not the app itself, and requires
  `Content-Type: application/json`.

## How it works

CIS is a set of SOAP services run by the tax authority. Every request is an XML
message signed with the business certificate (XML-DSig, RSA-SHA256, exclusive
C14N); CIS identifies the business from that certificate.

| Data | Operation | Service (production; test adds `-test` to the host) |
| --- | --- | --- |
| Sales / purchases | `GetInvoices` (`InvTransactionType` SALES / PURCHASES) | `https://efiskalizimi.tatime.gov.al/FiscalizationDataService-v1` |
| Operators, business units, TCRs | `GetOperators`, `GetBusinessUnits`, `GetTCRs` | `https://efiskalizimi.tatime.gov.al/FiscalizationService-v3` |
| Taxpayers, e-invoice PDF | `GetTaxpayers`, `GetEinvoices` | `https://einvoice.tatime.gov.al/EinvoiceService-v1` |

Behaviour confirmed against the live services:

- **Paging.** A period search returns at most 1000 invoices per page, with the
  total in `Invoices/@count`.
- **Long periods.** Busy periods are refused with **fault 87**; the client
  then splits the period in halves until each part is accepted.
- **Reduced lists.** Period searches return a reduced invoice: no `InvNum`,
  `TotPriceWoVAT`, `PayMethods`, `SameTaxes` or `Items`. The net amount is
  `TotPrice - TotVATAmt`. A search by FIC returns the complete invoice, which
  is how items are loaded.
- **Order and amounts.** Invoices come in no particular order. Amounts are in
  ALL; `Currency` holds the original currency and its rate.
- **Units** are free text and are normalised for grouping only (`units.json`).
- **Certificates.** NAIS certificates carry the NIPT in the subject's `SN`
  attribute and mark test certificates with `title=Test`. Production CIS
  refuses a test certificate with fault 34.

The wire format is in [docs/PROTOCOL.md](docs/PROTOCOL.md); the official WSDL
and XSD files are in [schemas/](schemas/).

## Project layout

```
cis_client/                 Python package (the app's backend, CLI and library)
  certificate.py            load .p12/.pfx/PEM; NIPT and environment detection
  xmlsig.py                 enveloped XML signature (sign and verify)
  transport.py              SOAP envelopes, endpoints, HTTP, faults, retries
  client.py                 CisClient: the operations above
  convert.py                XML to dicts, net amount, CSV rows, item lines and totals
  units.py, units.json      measure unit normalisation (shared with the web app)
  server/                   local web server: businesses.py (loaded certificates),
                            routes.py (JSON API), http.py (static files, security checks)
  cli.py                    command line
  web/                      the built web interface (generated by `npm run build`; committed)
frontend/                   web interface source: React, TypeScript, Mantine, Vite
  src/features/             screens: invoices, overview, registry lists, session
  src/components/           shared UI (table, page header, period, small pieces)
  src/lib/                  formatting, invoices, items, units, files, preferences
  src/pdf/                  PDF documents (pdfmake): invoice, reports
  src/i18n/                 Albanian and English text
schemas/                    official WSDL and XSD files
docs/PROTOCOL.md            wire format, for porting
examples/                   small scripts using the library
scripts/make-zip.sh         clean shareable zip
tests/                      unit tests, an offline fake CIS, golden signed messages
```

## Development

| Area | Commands |
| --- | --- |
| Python tests (offline) | `python -m unittest discover -s tests -t .` |
| Python lint and format | `pip install ruff`, then `ruff check .` and `ruff format .` |
| Web app, with hot reload | `cd frontend && npm install && npm run dev`, then open `http://127.0.0.1:5173/` |
| Web checks | `npm run check` (TypeScript, ESLint, Prettier) |
| Web build | `npm run build` (writes `cis_client/web`) |

- **Python tests.** `tests/fake_cis.py` checks every request's signature and
  answers like CIS (faults, paging, fault 87, reduced lists).
  `tests/test_signing.py` validates requests against the official XSDs.
- **Hot reload.** The dev server forwards `/api` to a running `cis-client` on
  port 8765, so start that first and load a certificate there.
- **Commit the build.** The built web interface is committed so users don't
  need Node: run `npm run build` before committing frontend changes.

Code style:

- **Python:** Ruff, 4 spaces.
- **TypeScript/CSS:** Prettier with 2 spaces, and ESLint with
  `typescript-eslint` strict type-checked rules.

CI (`.github/workflows/ci.yml`) runs all of the above and fails if
`cis_client/web` is not the build of `frontend/`. See [CLAUDE.md](CLAUDE.md)
for the conventions in more detail.

## Security

- **Certificates.** Certificates and passwords stay in the memory of the local
  process: never written to disk, logged, or sent anywhere. Only the public
  certificate travels inside each signed request, to `*.tatime.gov.al`.
- **A certificate is not read-only.** Whoever holds a business's `.p12` and
  password can fiscalize invoices in its name. Treat certificates like keys.
- **TLS** to CIS is verified (with the `certifi` CA bundle).
- **The local server** binds to `127.0.0.1` and refuses cross-site requests.
  Its pages run under a Content-Security-Policy that allows scripts only from
  the app itself.
- **Parsing.** Responses are parsed with DTDs and entity expansion disabled and
  must echo the request's UUID.
- **CSV exports** prefix cells that start with `=`, `+`, `-` or `@` (unless
  they are numbers), so spreadsheets do not run them as formulas.
- `.gitignore` excludes certificates and exports.

## Troubleshooting

| CIS code | Meaning | What to do |
| --- | --- | --- |
| 2 | Computer clock is off | Sync the system clock. |
| 29–31 | Signature rejected | The key and certificate do not match. |
| 34 | Certificate not accepted (no NIPT, or wrong environment) | Check the environment; use the certificate NAIS issued. |
| 35 | Certificate not issued by NAIS for this environment | Use the right certificate/environment. |
| 36 / 38 | Expired / revoked | Request a new certificate. |
| 87 | Period too long / too many invoices | The app splits periods by itself; on the command line use `--all`. |

- *"This certificate is password protected"*: type its password (files from
  NAIS usually have one).
- *"Cannot reach CIS … closed connection"*: the tax authority's service is
  down for a while (the e-invoice service, used for taxpayers and e-invoice
  PDFs, is the one most often down). Try again later.
- Port 8765 taken: the app moves to the next free port and prints the address.
- A broken first install: delete the `.venv` folder and start again.

## Sharing a clean copy

```sh
scripts/make-zip.sh                  # writes dist/cis-client.zip
scripts/make-zip.sh ~/Desktop/x.zip  # or any other path
```

The zip is built from a fresh clone of the committed state, git history
included. It leaves out `.venv`, `node_modules`, caches, exports and
certificates, as well as remotes, hooks, reflogs, and owner or macOS metadata.

The script stops if:

- a committed file mentions this computer (home folder, account or host name);
- a commit carries your global git identity (this repository sets its own
  neutral one);
- the built web interface is missing.

## Porting to another language

[docs/PROTOCOL.md](docs/PROTOCOL.md) describes each message, the signing
algorithm step by step, response parsing, error codes and how items are
loaded. `tests/fixtures/golden/` holds byte-exact reference values for the
test certificate and a fixed UUID/time. A port that loads
`tests/fixtures/selfsigned-test-only.p12` (password `test`), uses UUID
`8f1f5b8e-2c7a-4d4e-9a51-0f3c2b1a7e6d` and `SendDateTime`
`2026-09-30T10:15:00+02:00` must produce exactly those bytes (RSA PKCS#1 v1.5
signatures are deterministic).

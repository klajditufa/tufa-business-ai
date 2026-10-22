# TUFA Sync (CIS Client)

> **Agjenti lokal i TUFA Business AI.** Lexon faturat e shitjes dhe blerjes nga
> sistemi i fiskalizimit (CIS) me certifikatën e biznesit dhe i dërgon në
> TUFA Business AI. Certifikata dhe fjalëkalimi i saj **nuk largohen kurrë nga
> ky kompjuter**: në TUFA shkojnë vetëm faturat. Shih [Dërgimi në TUFA](#dërgimi-në-tufa-business-ai).

Read your business's data straight from the Albanian fiscalization system
(CIS, *Sistemi Qendror i Faturave*) using nothing but the business's own
fiscalization certificate:

- **Sales**: every invoice the business issued, by period or by FIC (NIVF).
- **Purchases**: every invoice issued *to* the business by its suppliers.
- **Taxpayers**: search the taxpayer registry by NIPT or name.
- **Operators**: the operators (cashiers) registered for the business and their operator codes.
- **Business units and TCRs**: registered premises and cash registers/devices.
- **E-invoice PDFs**: the official PDF of an electronic invoice, by EIC.

It comes as a local web app (load the `.p12` certificate and its password,
then browse, filter and export), a command line tool, a Python library, and a
small local JSON API. Requests are signed on your computer and go directly to
the tax authority; no other server is involved.

> **Shqip:** Hapni aplikacionin, ngarkoni certifikatën e fiskalizimit (`.p12`)
> dhe fjalëkalimin, dhe merrni shitjet, blerjet, tatimpaguesit dhe operatorët
> drejtpërdrejt nga CIS. Shih [Si ta përdorni](#si-ta-përdorni).

## Contents

- [Quick start](#quick-start)
- [Dërgimi në TUFA Business AI](#dërgimi-në-tufa-business-ai)
- [Si ta përdorni](#si-ta-përdorni)
- [Command line](#command-line)
- [Python library](#python-library)
- [Local JSON API](#local-json-api)
- [How it works](#how-it-works)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Porting to another language](#porting-to-another-language)

## Quick start

You need **Python 3.9 or newer** ([python.org](https://www.python.org/downloads/)).

| System | Start the app |
| --- | --- |
| macOS / Linux | `./start.sh` |
| Windows | double-click `start.bat` |

The first start creates a private environment in `.venv` and installs the
dependencies (`cryptography`, `lxml`, `certifi`); later starts are instant.
The app opens in your browser at `http://127.0.0.1:8765/`, in Albanian (switch
with **SQ / EN** at the top right). Keep the terminal window open while you use
it; close it (or press Ctrl+C) to stop.

Then:

1. Drop the business's fiscalization certificate (`.p12` / `.pfx`, or a PEM
   file containing the key) on the page and type its password.
2. Leave the environment on **Automatic**. NAIS marks test certificates, so the
   app picks *Test* or *Production* by itself and confirms with CIS that the
   certificate is accepted.
3. Use the tabs: *Sales*, *Purchases*, *Taxpayers*, *Operators*, *Units & devices*.

Invoice lists can be filtered, sorted and exported to CSV (opens in Excel) or
JSON. Click an invoice to load it in full, with items, VAT breakdown and
payments, a link to the public verification page, and, for e-invoices, the
official PDF.

Manual setup, if you prefer:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt     # Windows: .venv\Scripts\pip install -r requirements.txt
.venv/bin/python -m cis_client                # starts the web app
```

or install it as a package: `pip install .`, then run `cis-client`.

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

## Si ta përdorni

1. Instaloni **Python 3.9 ose më të ri** nga [python.org](https://www.python.org/downloads/).
2. Nisni aplikacionin: në Windows klikoni dy herë `start.bat`; në macOS/Linux ekzekutoni `./start.sh`.
   Herën e parë instalohen paketat e nevojshme (zgjat pak).
3. Shfletuesi hapet te `http://127.0.0.1:8765/`. Mbajeni dritaren e terminalit të hapur.
4. Ngarkoni certifikatën `.p12` / `.pfx` dhe shkruani fjalëkalimin. Mjedisi mbetet **Automatik**:
   aplikacioni e njeh vetë nëse certifikata është për Test apo Production.
5. Zgjidhni periudhën te *Shitjet* ose *Blerjet* dhe shtypni **Merr faturat**. Klikoni një faturë
   për ta parë të plotë (artikujt, TVSH-ja, pagesat). Eksportoni në CSV/JSON me butonat përkatës.

Certifikata mbahet vetëm në kujtesën e kompjuterit sa kohë aplikacioni është i hapur; nuk ruhet
në disk dhe nuk dërgohet askund përveç pjesës publike që shoqëron çdo kërkesë drejt tatimeve.

## Command line

```sh
export CIS_CERT=company.p12            # or pass --cert company.p12 to every command
export CIS_CERT_PASSWORD='secret'      # otherwise you are asked for it

cis-client info --check                                   # certificate details, confirmed with CIS
cis-client sales --from 2026-09-01 --to 2026-09-30        # one page (up to 1000) as a table
cis-client sales --from 2026-01-01 --to 2026-09-30 --all --format csv -o sales.csv
cis-client purchases --fic 2ed48eff-f3d0-4315-a2a5-16618c63ad0b   # full invoice with items (JSON)
cis-client taxpayers vodafone
cis-client taxpayers K11715005L --format json
cis-client operators
cis-client business-units
cis-client tcrs
cis-client pdf 5e0a7d9e-ebc4-41d8-9669-0800200c9a66 --party BUYER -o invoice.pdf
cis-client serve --port 8765 --no-browser                 # web app; same as running without a command
```

Without `python -m pip install .`, use `python -m cis_client` instead of
`cis-client`. Common options: `--env production|test` (default: detected from
the certificate), `--format table|json|csv`, `-o FILE`, `--timeout SECONDS`,
and `--debug` (before the command) to print the SOAP messages exchanged with CIS.

## Python library

```python
from cis_client import CisClient, CisFault, SALES

client = CisClient.from_file("company.p12", password="secret")   # environment: from the certificate,
                                                                   # or pass environment="production" / "test"

page = client.get_sales("2026-09-01", "2026-09-30")       # one page of up to 1000
print(page.count, page.pages, page.invoices[0]["TotPrice"])

everything = client.fetch_all_invoices(SALES, "2026-01-01", "2026-09-30")  # all pages
invoice = client.get_invoice(everything[0]["FIC"], SALES)                  # with "Items"

client.get_purchases()                  # current month
client.get_taxpayers("K11715005L")      # [{"Tin", "Name", "Address", "Town", "Country"}]
client.get_operators()                  # [{"name", "opCode", "firstName", "lastName", "idNumber", "validFrom", "validTo"}]
client.get_business_units()             # [{"BUCode", "BUName", ...}]
client.get_tcrs()                       # [{"TCRCode", "BusinUnitCode", "IssuerNUIS", ...}]
pdf = client.get_einvoice_pdf(eic, "BUYER")   # EinvoicePdf(eic, pdf=b"%PDF-...", details={...}) or None

try:
    client.get_sales("2020-01-01", "2026-12-31")
except CisFault as fault:
    print(fault.fault_code, fault.fault_string, fault.hint)   # 87, "Excessive number of invoices ...", ...
```

Invoices are plain dictionaries that keep CIS's own field names, with every
scalar left as the string CIS sent (`"120.00"`, `"true"`); see
[`examples/export_month.py`](examples/export_month.py). The useful extras are
`convert.net_amount(invoice)`, `convert.flatten_invoice(invoice)` and
`verification_url(invoice)`.

## Local JSON API

While the web app runs, the same data is available as JSON on
`http://127.0.0.1:8765`, so other programs on the same computer can use it.
Load the certificate first (in the page, or with `POST /api/session`), then:

| Method and path | Body | Returns |
| --- | --- | --- |
| `POST /api/v1/utilities/cis-invoices/sales` | `{"FromDate": "2026-09-01", "ToDate": "2026-09-30", "Page": 1}` | invoice array; total in `X-Total-Count` |
| `POST /api/v1/utilities/cis-invoices/purchases` | same as sales | same as sales |
| | `{"FIC": "..."}` | `[invoice with Items]` or `[]` |
| | `{"FromDate": ..., "ToDate": ..., "All": true}` | every page in one array |
| `POST /api/v1/utilities/get-taxpayers` | `{"searchTerm": "vodafone"}` | `[{Tin, Name, Address, Town, Country}]` |
| `POST /api/v1/utilities/get-operators` | `{}` | `[{name, opCode, ...}]` |
| `POST /api/v1/utilities/get-business-units` | `{}` | `[{BUCode, BUName, ...}]` |
| `POST /api/v1/utilities/get-tcrs` | `{}` | `[{TCRCode, ...}]` |
| `POST /api/v1/utilities/einvoice-pdf` | `{"EIC": "...", "PartyType": "BUYER"}` | `{eic, base64, details}` |
| `GET /api/session` | | loaded certificate and environment |
| `POST /api/session` | `{"certificate": "<base64 of the .p12>", "password": "...", "environment": null}` | session |
| `DELETE /api/session` | | forgets the certificate |

Dates are `YYYY-MM-DD` and cover whole days in Albanian time; without dates
the current month is used. Errors come back as
`{"message", "field"?, "cisError": {"faultEnv", "faultString", "faultCode"}?, "hint"?}`
with status 400 (bad input), 401 (no certificate loaded), 422 (CIS refused the
request) or 502 (CIS unreachable or failing).

```sh
curl -s http://127.0.0.1:8765/api/v1/utilities/get-taxpayers \
  -H 'Content-Type: application/json' -d '{"searchTerm": "vodafone"}'
```

The server only listens on `127.0.0.1`, rejects requests whose `Host`/`Origin`
is not the app itself (so web pages cannot reach it), and requires
`Content-Type: application/json`.

## How it works

CIS is a set of SOAP services run by the tax authority. Every request is an XML
message signed with the business certificate (XML-DSig, RSA-SHA256, exclusive
C14N); CIS identifies the business from that certificate. No user name, token
or other credential exists.

| Data | Operation | Service (production; test adds `-test` to the host) |
| --- | --- | --- |
| Sales / purchases | `GetInvoices` (`InvTransactionType` SALES / PURCHASES) | `https://efiskalizimi.tatime.gov.al/FiscalizationDataService-v1` |
| Operators | `GetOperators` | `https://efiskalizimi.tatime.gov.al/FiscalizationService-v3` |
| Business units | `GetBusinessUnits` | `https://efiskalizimi.tatime.gov.al/FiscalizationService-v3` |
| TCRs | `GetTCRs` | `https://efiskalizimi.tatime.gov.al/FiscalizationService-v3` |
| Taxpayers | `GetTaxpayers` | `https://einvoice.tatime.gov.al/EinvoiceService-v1` |
| E-invoice PDF | `GetEinvoices` | `https://einvoice.tatime.gov.al/EinvoiceService-v1` |

Behaviour worth knowing, confirmed against the live services:

- A period search returns at most **1000 invoices per page** and the total in
  `Invoices/@count`. Long or busy periods are refused with **fault 87**
  ("Excessive number of invoices detected"); `fetch_all_invoices` (and the web
  app) then split the period in halves until each part is accepted.
- Period searches return a **reduced invoice**: no `InvNum`, `TotPriceWoVAT`,
  `PayMethods`, `SameTaxes` or `Items`. The net amount is `TotPrice - TotVATAmt`
  (`convert.net_amount`). A search by FIC returns the complete invoice.
- CIS returns invoices in no particular order.
- Amounts are in ALL; `Currency` holds the original currency and rate.
- NAIS certificates carry the NIPT in the subject's `SN` attribute and mark test
  certificates with `title=Test`. Production CIS refuses a test certificate with
  fault 34 ("doesn't contain valid title value").

The full wire format is in [docs/PROTOCOL.md](docs/PROTOCOL.md) and the official
WSDL/XSD files are in [schemas/](schemas/).

```
cis_client/
  certificate.py   load .p12/.pfx/PEM, NIPT and environment detection
  xmlsig.py        enveloped XML signature (sign and verify)
  transport.py     SOAP envelopes, endpoints, HTTP, faults
  client.py        CisClient: the operations above
  convert.py       XML to dicts, net amount, CSV rows, verification URL
  server.py        local web app + JSON API (standard library only)
  cli.py           command line
  web/             the page (plain HTML/CSS/JS, no build step)
schemas/           official WSDL and XSD files
docs/PROTOCOL.md   wire format, for porting
tests/             unit tests, an offline fake CIS, golden signed messages
```

## Security

- The certificate and password stay in the memory of the local process. They are
  never written to disk, logged, or sent anywhere; only the public certificate
  travels inside each signed request, to `*.tatime.gov.al`.
- TLS to CIS is verified (with the `certifi` CA bundle).
- The web app binds to `127.0.0.1` only and refuses cross-site requests; see
  [Local JSON API](#local-json-api).
- Responses are parsed with entity expansion and DTDs disabled, and must echo the
  request's UUID.
- CSV exports prefix cells that start with `=`, `+`, `-` or `@` (unless they are
  numbers) so spreadsheets do not run them as formulas.
- `.gitignore` excludes certificates and exports so they are not committed by mistake.

## Troubleshooting

| CIS code | Meaning | What to do |
| --- | --- | --- |
| 2 | Computer clock is off | Sync the system clock. |
| 11 | Message failed XSD validation | Report it with `--debug` output. |
| 29–31 | Signature rejected | The key and certificate do not match. |
| 34 | Certificate not accepted (no NIPT, or wrong environment: "valid title value") | Check the environment; use the certificate NAIS issued. |
| 35 | Certificate not issued by NAIS (for this environment) | Use the right certificate/environment. |
| 36 / 38 | Expired / revoked | Request a new certificate. |
| 87 | Period too long / too many invoices | Use a shorter period, or `--all` / the web app, which split it. |
| 88 | No search parameters | n/a (the client always sends them). |

Other problems:

- *"the password is wrong or the file is not a .p12/.pfx file"*: check the
  password; `.p12` files from NAIS always have one.
- *"Cannot reach CIS"*: check the internet connection; the CIS hosts sometimes
  have maintenance windows.
- Port 8765 taken: the app moves to the next free port and prints the address.
- A broken first install: delete the `.venv` folder and start again.

## Development

```sh
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -t .
```

The tests run offline. `tests/fake_cis.py` checks every request's signature and
answers like CIS does (namespaces, faults, pagination, fault 87, reduced list
invoices), and `tests/test_signing.py` validates every request type against the
official XSDs. `tests/fixtures/selfsigned-test-only.p12` (password `test`) is a
self-signed certificate made for these tests; CIS refuses it.

## Porting to another language

[docs/PROTOCOL.md](docs/PROTOCOL.md) describes each message, the signing
algorithm step by step, response parsing and the error codes.
`tests/fixtures/golden/` holds byte-exact reference values for the test
certificate and a fixed UUID/time:

- `GetInvoicesRequest.c14n.xml`: the canonical bytes that are digested,
- `GetInvoicesRequest.SignedInfo.c14n.xml`: the canonical `SignedInfo` that is signed,
- `GetInvoicesRequest.signed.xml` and `GetOperatorsRequest.signed.xml`: complete messages.

A port that loads the test `.p12`, uses UUID `8f1f5b8e-2c7a-4d4e-9a51-0f3c2b1a7e6d`
and `SendDateTime` `2026-09-30T10:15:00+02:00` must produce exactly these
bytes (RSA PKCS#1 v1.5 signatures are deterministic).

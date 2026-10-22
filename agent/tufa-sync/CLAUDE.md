# CLAUDE.md

Guide for anyone (person or AI assistant) changing this repository.

## What this is

CIS Client reads a business's invoices from the Albanian fiscalization system
(CIS) with the business's own fiscalization certificate (`.p12`): sales,
purchases, invoice lines (items), registers (taxpayers, operators, business
units, TCRs) and e-invoice PDFs. It is a local app: a Python server on
`127.0.0.1` that signs SOAP requests to CIS, and a React web interface. It also
works as a command line tool and a Python library. Several certificates
(businesses) can be loaded at once.

Users are not technical: they run `start.sh` / `start.bat`, load a certificate
in the browser and work. Keep that path working without Node or any setup
beyond Python.

## Layout

- `cis_client/`: Python package (3.9+), see the table in README.md.
  - `server/businesses.py` holds the loaded certificates.
  - `server/routes.py` is the JSON API.
  - `server/http.py` serves files and enforces the local-only and same-origin checks.
- `cis_client/web/`: **generated** by `npm run build` from `frontend/`. Never
  edit it by hand. It is committed so users don't need Node.
- `frontend/`: React 19, TypeScript (strict), Mantine 9 (components and
  theme), Vite.
  - `src/theme.ts`: the design system (theme, component defaults, colour scheme).
  - `src/features/`: screens. `src/components/`: shared UI.
  - `src/lib/`: pure logic. `src/pdf/`: pdfmake documents.
- `cis_client/units.json`: measure units, shared by Python and the web app.
- `docs/PROTOCOL.md`: the wire format. `schemas/`: official WSDL/XSD files (never edit).
- `tests/`: unittest. `fake_cis.py` is an offline CIS that verifies signatures.

## Commands

```sh
./start.sh                                   # run the app (port 8765)
python -m unittest discover -s tests -t .    # Python tests, offline
ruff check . && ruff format --check .        # Python lint / format (pip install ruff)

cd frontend
npm install
npm run dev      # hot reload on http://127.0.0.1:5173, /api forwarded to a running app on 8765
npm run check    # tsc + eslint + prettier
npm run build    # writes ../cis_client/web; commit the result with the source change
```

Before committing:

- Python tests and Ruff pass.
- `npm run check` passes.
- If anything in `frontend/` changed, `npm run build` was run and
  `cis_client/web` is committed with it. CI fails otherwise.

## Conventions

- **Formatting:** Python follows Ruff (4 spaces, 120 columns). TypeScript, CSS
  and JSON follow Prettier (2 spaces, 110 columns). Both match `.editorconfig`.
- **Components:** use Mantine components and theme tokens, not hand-written
  CSS. `frontend/src/app.css` only holds what Mantine props can't express.
  Every screen must work in light and dark mode and on a phone (about 390px wide).
- **Text:** everything visible is in `frontend/src/i18n/strings.ts`, English
  and Albanian. The `sq` table must cover every key (TypeScript enforces it).
  Albanian is the default; write correct Albanian (ë, ç). File names keep
  Albanian letters (`Faturë_12_2026.pdf`).
- **Preferences:** UI preferences live in one localStorage key,
  `cis-client.preferences` (`src/lib/preferences.ts`). Add new ones there with
  validation and a default; never add separate keys.
- **Invoice data:** keep CIS field names, with every value the string CIS
  sent. Amounts are summed in cents (TypeScript) or `Decimal` (Python), never
  as floats.
- **Exports:** CSV columns are shared by the command line and the web app
  (`convert.py`, `lib/invoice.ts`, `lib/items.ts`); change both together.
- **API errors:** `{"message", "field"?, "cisError"?, "hint"?, "unreachable"?}`.
  The web app shows Albanian hints for CIS fault codes (`HINTS_SQ`).
- **Python:** keep the runtime dependencies at `cryptography`, `lxml` and
  `certifi`. No web framework: the server uses the standard library.

## Facts about CIS that the code relies on

- Period lists return at most 1000 invoices per page and leave out items,
  `InvNum`, `TotPriceWoVAT`, payments and VAT groups. Items need one lookup
  by FIC per invoice (`get_invoice_details`, four in parallel).
- Long periods fail with fault 87; `iter_invoices` splits them.
- Test certificates (`title=Test`) are refused in production with fault 34;
  the environment is detected from the certificate and confirmed with
  `GetTCRs`.
- The e-invoice service (`einvoice.tatime.gov.al`: taxpayers, e-invoice PDFs)
  is sometimes down while the others work. Errors then carry
  `"unreachable": true`.

## Never

- **Never commit real data.** That covers certificates, passwords, real
  invoices, NIPTs of real businesses and personal names. Test data uses the
  self-signed fixture (NIPT `X99999999X`) and the fake CIS.
- **Never weaken the server's checks:** local only, Host/Origin/Sec-Fetch-Site,
  and the CSP that allows scripts only from the app.
- **Never write certificates to disk or log them.**
- **Never add identifying information** about the people who built or use this
  (names, home paths, machine names) to files or commits.
  `scripts/make-zip.sh` refuses to package such traces.

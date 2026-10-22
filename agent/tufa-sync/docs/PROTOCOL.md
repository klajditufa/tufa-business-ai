# CIS wire protocol

Everything needed to talk to the Albanian fiscalization system (CIS) for the
read operations this project uses, written so the client can be reimplemented
in any language. The official WSDL and XSD files are in [`../schemas`](../schemas);
when this document and the schemas disagree, the schemas win.

## 1. Services and endpoints

All services are SOAP 1.1 over HTTPS (TLS 1.2, server certificate `*.tatime.gov.al`
from a public CA; no client TLS certificate). Production and test differ only in
the host name.

| Service | Production URL | Test URL | SOAPAction prefix |
| --- | --- | --- | --- |
| FiscalizationDataService | `https://efiskalizimi.tatime.gov.al/FiscalizationDataService-v1` | `https://efiskalizimi-test.tatime.gov.al/FiscalizationDataService-v1` | `https://eFiskalizimi.tatime.gov.al/FiscalizationDataService` |
| FiscalizationService | `https://efiskalizimi.tatime.gov.al/FiscalizationService-v3` | `https://efiskalizimi-test.tatime.gov.al/FiscalizationService-v3` | `https://eFiskalizimi.tatime.gov.al/FiscalizationService` |
| EinvoiceService | `https://einvoice.tatime.gov.al/EinvoiceService-v1` | `https://einvoice-test.tatime.gov.al/EinvoiceService-v1` | `https://Einvoice.tatime.gov.al/EinvoiceService` |

The WSDLs are published next to each endpoint, e.g.
`.../FiscalizationDataService-v1/FiscalizationDataService.wsdl` (and the XSDs they import).

| Operation | Service | `Version` attribute | Request root | Response root |
| --- | --- | --- | --- | --- |
| GetInvoices | FiscalizationDataService | `3` | `GetInvoicesRequest` | `GetInvoicesResponse` |
| GetOperators | FiscalizationService | `3` | `GetOperatorsRequest` | `GetOperatorsResponse` |
| GetBusinessUnits | FiscalizationService | `3` | `GetBusinessUnitsRequest` | `GetBusinessUnitsResponse` |
| GetTCRs | FiscalizationService | `3` | `GetTCRsRequest` | `GetTCRsResponse` |
| GetTaxpayers | EinvoiceService | `1` | `GetTaxpayersRequest` | `GetTaxpayersResponse` |
| GetEinvoices | EinvoiceService | `1` | `GetEinvoicesRequest` | `GetEinvoicesResponse` |

HTTP request:

```
POST {service URL}
Content-Type: text/xml; charset=utf-8
SOAPAction: {SOAPAction prefix}/{Operation}       e.g. https://eFiskalizimi.tatime.gov.al/FiscalizationDataService/GetInvoices
```

Successful responses are HTTP 200; faults arrive as HTTP 500 with a SOAP Fault body.

## 2. Message envelope

```xml
<?xml version='1.0' encoding='UTF-8'?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Header/>
  <SOAP-ENV:Body>
    <{Operation}Request xmlns="{SOAPAction prefix}/schema" Id="Request" Version="{version}">
      <Header UUID="{uuid}" SendDateTime="{now}"/>
      {operation specific elements}
      <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">...</Signature>
    </{Operation}Request>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
```

(Whitespace shown for readability; send the message without indentation.)

- The schema namespace is the SOAPAction prefix plus `/schema`, e.g.
  `https://eFiskalizimi.tatime.gov.al/FiscalizationDataService/schema`. Child
  elements are qualified (in that namespace); attributes are not.
- `Id="Request"` is fixed and is what the signature references.
- `UUID`: a new random UUID v4 for every message, lowercase is fine. Pattern:
  `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}`.
- `SendDateTime`: the current time as `YYYY-MM-DDThh:mm:ss+hh:mm` (or `Z`),
  **without fractional seconds**. CIS rejects clocks that are too far off (fault 2).
- A retry is a new message: new UUID, new SendDateTime, new signature.

## 3. Operation bodies

### GetInvoices: sales or purchases by period

```xml
<InvoicesRequestBody FromDate="2026-09-01T00:00:00+02:00" ToDate="2026-09-30T23:59:59+02:00"
                     InvTransactionType="SALES" Page="1"/>
```

- `InvTransactionType`: `SALES` (invoices the certificate's business issued) or
  `PURCHASES` (invoices where it is the buyer).
- `FromDate` / `ToDate`: issue date and time range, same format as SendDateTime.
  This client uses 00:00:00 and 23:59:59 in Europe/Tirane.
- `Page`: 1-based; up to 1000 invoices per page.

### GetInvoices: one invoice by FIC

```xml
<InvoicesRequestBody FIC="2ed48eff-f3d0-4315-a2a5-16618c63ad0b" InvTransactionType="PURCHASES"/>
```

The direction must match (a sales invoice is not found with `PURCHASES`).

### GetTaxpayers

```xml
<Filter><Tin>K11715005L</Tin></Filter>       or       <Filter><Name>Vodafone</Name></Filter>
```

Exactly one of `Tin` (pattern `[a-zA-Z][0-9]{8}[a-zA-Z]`) or `Name` (3 to 100 characters, substring search).

### GetOperators, GetBusinessUnits, GetTCRs

No body besides `Header` (and `Signature`).

### GetEinvoices: e-invoice PDF

```xml
<EIC>5e0a7d9e-ebc4-41d8-9669-0800200c9a66</EIC>
<PartyType>BUYER</PartyType>
```

`PartyType` is `BUYER` for purchases and `SELLER` for sales. The schema also
allows `RecDateTimeFrom` / `RecDateTimeTo` instead of `EIC` to list e-invoices.

## 4. Signature

The request element (`Id="Request"`) carries an enveloped XML-DSig 1.1 signature
as its **last child**:

```xml
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
  <SignedInfo>
    <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    <Reference URI="#Request">
      <Transforms>
        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
        <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      </Transforms>
      <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <DigestValue>{base64 SHA-256}</DigestValue>
    </Reference>
  </SignedInfo>
  <SignatureValue>{base64 RSA signature}</SignatureValue>
  <KeyInfo><X509Data><X509Certificate>{base64 DER certificate}</X509Certificate></X509Data></KeyInfo>
</Signature>
```

Steps:

1. Build the complete request element without the `Signature`.
2. **Digest**: canonicalize the request element with *exclusive* XML
   canonicalization 1.0 without comments (only namespaces that are used are
   output, so the SOAP namespace does not appear), then SHA-256, then base64.
   Doing this before adding the `Signature` is the same as applying the
   enveloped-signature transform afterwards.
3. Append the `Signature` element with its `SignedInfo` (as above, with the digest).
4. **Signature value**: canonicalize `SignedInfo` with exclusive C14N *as it sits
   in the document* (it renders as
   `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">...`), sign those bytes
   with RSASSA-PKCS1-v1_5 / SHA-256 using the certificate's private key, base64.
5. Put the signer's certificate (DER, base64) in `X509Certificate`.
6. Serialize. Nothing inside the request element may change after signing.

Most libraries (Java `javax.xml.crypto`, .NET `SignedXml`, Node `xml-crypto`,
Python `signxml`/`xmlsec`) do steps 2–5 when told: enveloped signature,
reference `#Request`, exclusive C14N for both canonicalization and transform,
RSA-SHA256, SHA-256 digest, X509 certificate key info.

**Test vector.** `tests/fixtures/golden/` contains, for
`tests/fixtures/selfsigned-test-only.p12` (password `test`), UUID
`8f1f5b8e-2c7a-4d4e-9a51-0f3c2b1a7e6d`, SendDateTime `2026-09-30T10:15:00+02:00`
and a SALES search for 2026-09-01..2026-09-30:

| File | Content |
| --- | --- |
| `GetInvoicesRequest.c14n.xml` | canonical request (step 2 input); SHA-256 base64 = `rDjBBm9hUgCsf6R+V8wrFv+b1b3sSFmZ82bX1OcrGVc=` |
| `GetInvoicesRequest.SignedInfo.c14n.xml` | canonical SignedInfo (step 4 input) |
| `GetInvoicesRequest.signed.xml` | the complete message |
| `GetOperatorsRequest.signed.xml` | complete GetOperators message |

Check a digest with `openssl dgst -sha256 -binary GetInvoicesRequest.c14n.xml | base64`.

## 5. Certificate

- Issued by NAIS (AKSHI) as a password protected PKCS#12 file. The files are BER
  (not strict DER) encoded and some use legacy PBE-SHA1-3DES/RC2 encryption; make
  sure your PKCS#12 reader accepts both (OpenSSL, Java, .NET and Python
  `cryptography` do; the latter warns about BER, which this client silences).
- RSA key. The subject carries the business **NIPT in `SN` (surname, OID 2.5.4.4)**;
  CIS refuses certificates without it (fault 34 "doesn't contain TIN number").
- Test certificates have **`title` (2.5.4.12) = `Test`**; production CIS refuses them
  with fault 34 "doesn't contain valid title value". Production certificates only
  work in production (fault 35 otherwise).
- CIS takes the business identity from the certificate; requests contain no NIPT.

## 6. Responses

```xml
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Header/>
  <SOAP-ENV:Body>
    <ns2:GetInvoicesResponse xmlns:ns2=".../schema" Id="Response" Version="3">
      <ns2:Header RequestUUID="{your UUID}" SendDateTime="..." UUID="..."/>
      <ns2:Invoices count="1272">
        <ns2:Inv TypeOfInv="CASH" IssueDateTime="2026-09-01T10:17:30+02:00" InvOrdNum="78" TCRCode="vy822ew359"
                 TotVATAmt="2" TotPrice="97217" FIC="..." IIC="..." ...>
          <ns2:Seller IDType="NUIS" IDNum="..." Name="..." Country="ALB"/>
          <ns2:Buyer .../>
        </ns2:Inv>
        ...
      </ns2:Invoices>
      <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">...</Signature>
    </ns2:GetInvoicesResponse>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
```

Parse by **local name** (prefixes vary between services) and with DTDs and
entity expansion disabled. Check that `Header/@RequestUUID` equals the UUID you
sent. Responses are signed by CIS (certificate CN "GDT eFiskalizimi"); TLS
already authenticates the server, so verifying that signature is optional.

### Invoices (`Invoices/Inv`)

- `Invoices/@count` is the total for the whole search; pages hold up to 1000.
  Pages needed = ceil(count / 1000).
- Values are strings as CIS stores them; amounts are not always two-decimal
  (`"97217"`, `"-21.40"`), booleans are `"true"`/`"false"`.
- **Period searches return a reduced invoice.** Seen in practice:
  `TypeOfInv, IsSimplifiedInv, IssueDateTime, InvOrdNum, TCRCode, IsIssuerInVAT,
  TaxFreeAmt, GoodsExAmt, MarkUpAmt, TotVATAmt, TotPrice, OperatorCode,
  BusinUnitCode, SoftCode, IIC, FIC, IsReverseCharge, IsEinvoice, EIC,
  PayDeadline, TypeOfSelfIss` plus `Seller`, `Buyer`, `Currency`,
  `CorrectiveInv`, `SupplyDateOrPeriod`. Missing: `InvNum`, `SendDateTime`,
  `TotPriceWoVAT`, `IICSignature`, `PayMethods`, `SameTaxes`, `Items`.
  Net = `TotPrice - TotVATAmt`.
- A FIC search returns the full invoice including `Items/I` (attributes `N` name,
  `C` code, `U` unit, `Q` quantity, `UPB`/`UPA` unit price before/after VAT,
  `R` discount %, `RR` discount reduces base, `PB`/`PA` line total before/after
  VAT, `VR` VAT %, `VA` VAT amount, `EX` exemption, `IN` investment) and
  `PayMethods/PayMethod`, `SameTaxes/SameTax`, `Fees/Fee`, `SumInvIICRefs/SumInvIICRef`.
- Order is arbitrary; sort on your side.
- Amounts are in ALL. `Currency/@Code` and `@ExRate` describe the original currency.

This client turns each `Inv` into a dictionary: attributes become keys,
single child elements become nested objects, and the wrapper elements above
become arrays. For example
`"PayMethods": [{"Type": "ACCOUNT", "Amt": "120.00"}]`.

### Other operations

| Operation | Items | Attributes |
| --- | --- | --- |
| GetTaxpayers | `Taxpayers/Taxpayer` (max 100) | `Tin, Name, Address, Town, Country` |
| GetOperators | `Operators/Operator` | `OprCode, OprFirstName, OprLastName, OprID, OprValidFrom, OprValidTo` |
| GetBusinessUnits | `BusinessUnits/BusinessUnit` | `BUCode, BUName, BUSerialNumber, BUStreetName, BUValidFrom, BUValidTo` |
| GetTCRs | `TCRs/TCR` | `IssuerNUIS, BusinUnitCode, TCRIntID, SoftCode, TCRCode, MaintainerCode, ValidFrom, ValidTo, Type` |
| GetEinvoices | `Einvoices/Einvoice` with child `Pdf` (base64) | `EIC, FIC, DocNumber, RecDateTime, DueDateTime, Status, Amount, BuyerTin, SellerTin, PartyType` |

`OprCode` is the `OperatorCode`, `BUCode` the `BusinUnitCode` and `TCRCode` the
`TCRCode` used when fiscalizing invoices. Optional attributes are often absent
(e.g. `TCRIntID`, `Type` on older TCRs).

## 7. Faults

```xml
<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Header/><env:Body>
  <env:Fault>
    <faultcode>env:CLIENT</faultcode>
    <faultstring>Excessive number of invoices detected! Please restrict the search period. Code=87 RequestUUID=... ResponseUUID=...</faultstring>
    <detail><code>87</code></detail>
  </env:Fault>
</env:Body></env:Envelope>
```

- `faultcode` `...:CLIENT` means the request is wrong (do not retry as is);
  `...:SERVER` is a temporary problem (retry with a new message).
- The numeric code is in `detail/code`. CIS often appends
  `Code=.. RequestUUID=.. ResponseUUID=..` (sometimes twice) to `faultstring`.

| Code | Meaning |
| --- | --- |
| 0, 1 | Message unreadable / too large |
| 2 | Client time differs too much from server time |
| 10, 11 | XSD validation failed |
| 20–32 | Signature problems (missing, wrong element, wrong algorithm, digest or value wrong) |
| 33 | Certificate is not X.509 |
| 34 | Certificate not valid (e.g. no TIN, wrong title for the environment) |
| 35 | Certificate not issued by NAIS |
| 36 | Certificate expired |
| 38, 39 | Certificate revoked / status unknown |
| 52, 55 | Taxpayer not in registry / not active |
| 87 | Search period too long, or more invoices than the limit (period searches of a single day are exempt from the count limit) |
| 88 | Missing search parameters |
| 999 | Message does not match the service interface |

## 8. Fetching a long period

```
fetch(range):
    try page 1 of range
    on fault 87 and range longer than one day:
        fetch(first half); fetch(second half); return
    take invoices of page 1, then pages 2..ceil(count/1000)
```

Ten months of a busy test business (about 37,700 invoices) took 47 requests
and roughly a minute this way. De-duplicate by FIC in case invoices registered
while paging shift the pages.

## 9. Invoice lines (items)

Period searches never include `Items`. To work with lines (costs per item, a
summary by article, an invoice PDF), look each invoice up by FIC:

```
for each invoice of the period (with a FIC), at most 4 requests at a time:
    GetInvoices { FIC, InvTransactionType }  ->  the complete invoice, with Items/I
keep the result; a FIC never changes, so each invoice is fetched once
```

A month of a few hundred purchases takes seconds; a thousand sales about a
minute. Each `I` has `N` (name), `C` (code, chosen by the issuer), `U` (unit,
free text), `Q`, `UPB`, `UPA`, `R`, `PB`, `VR`, `VA`, `PA`, and optionally `EX`
(VAT exemption) and `IN`. Corrective invoices carry negative quantities and
amounts.

To total lines per item across issuers, group by the item name (ignoring case,
accents and repeated spaces) and the unit. Do not group by code: the same item
has a different code at each supplier. Units arrive as `kg`, `KG`, `Kg.`,
`Copë`, `cope`, `pcs` and so on; `cis_client/units.json` maps the common
spellings to UN/ECE Rec. 20 codes (`KGM`, `XPP`, `LTR`, ...).

## 10. Verification link

The public check page (the address in an invoice's QR code) is

```
https://efiskalizimi-app.tatime.gov.al/invoice-check/#/verify?iic={IIC}&tin={issuer NIPT}&crtd={IssueDateTime}&ord={InvOrdNum}&bu={BusinUnitCode}&cr={TCRCode}&sw={SoftCode}&prc={TotPrice}
```

(`efiskalizimi-app-test` for the test environment). The issuer is the seller,
or the buyer for self-issued invoices (`TypeOfSelfIss` set).

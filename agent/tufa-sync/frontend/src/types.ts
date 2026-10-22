// Data as the local API returns it. Invoices keep CIS's attribute names and every value is a string,
// exactly as CIS sent it ("120.00", "true"); see cis_client/convert.py.

export type Kind = "SALES" | "PURCHASES";

/** Table sorting: a column key and a direction. */
export interface Sort {
  key: string;
  dir: 1 | -1;
}
export type Environment = "production" | "test";

export interface Party {
  IDType?: string;
  IDNum?: string;
  Name?: string;
  Address?: string;
  Town?: string;
  Country?: string;
}

/** One invoice line. */
export interface Item {
  N?: string; // name
  C?: string; // code
  U?: string; // unit, free text
  Q?: string; // quantity
  UPB?: string; // unit price without VAT
  UPA?: string; // unit price with VAT
  R?: string; // rebate %
  RR?: string;
  PB?: string; // value without VAT
  VR?: string; // VAT rate
  VA?: string; // VAT amount
  PA?: string; // value with VAT
  EX?: string; // VAT exemption
  IN?: string; // investment
}

export interface PayMethod {
  Type?: string;
  Amt?: string;
  CompCard?: string;
}

export interface SameTax {
  NumOfItems?: string;
  PriceBefVAT?: string;
  VATRate?: string;
  ExemptFromVAT?: string;
  VATAmt?: string;
}

export interface Reference {
  IICRef?: string;
  IssueDateTime?: string;
  Type?: string;
}

export interface Invoice {
  TypeOfInv?: string; // CASH or NONCASH
  IsSimplifiedInv?: string;
  IsBadDeb?: string;
  TypeOfSelfIss?: string;
  IssueDateTime?: string;
  SendDateTime?: string;
  InvNum?: string;
  InvOrdNum?: string;
  TCRCode?: string;
  IsIssuerInVAT?: string;
  TaxFreeAmt?: string;
  MarkUpAmt?: string;
  GoodsExAmt?: string;
  TotPriceWoVAT?: string;
  TotVATAmt?: string;
  TotPrice?: string;
  OperatorCode?: string;
  BusinUnitCode?: string;
  SoftCode?: string;
  ImpCustDecNum?: string;
  IIC?: string;
  FIC?: string;
  IsReverseCharge?: string;
  PayDeadline?: string;
  IsEinvoice?: string;
  EIC?: string;
  PayMethods?: PayMethod[];
  Seller?: Party;
  Buyer?: Party;
  Currency?: { Code?: string; ExRate?: string };
  SupplyDateOrPeriod?: { Start?: string; End?: string };
  CorrectiveInv?: Reference;
  BadDebtInv?: Reference;
  SameTaxes?: SameTax[];
  Fees?: { Type?: string; Amt?: string }[];
  SumInvIICRefs?: { IIC?: string; IssueDateTime?: string }[];
  /** Only on complete invoices (looked up by FIC); date range lists leave it out. */
  Items?: Item[];
}

export interface CertificateSummary {
  nipt?: string | null;
  name?: string | null;
  commonName?: string | null;
  issuer?: string;
  serialNumber?: string;
  validFrom?: string;
  validTo?: string;
  expired?: boolean;
  fingerprintSha256?: string;
}

/** One loaded certificate: the business it belongs to and where CIS accepted it. */
export interface Business {
  id: string;
  environment: Environment;
  verified: boolean;
  warning: string | null;
  certificate: CertificateSummary;
}

export interface Session {
  version: string;
  active: string | null;
  businesses: Business[];
}

export interface Totals {
  count: string;
  net: string;
  vat: string;
  total: string;
}

export interface OverviewRow {
  id: string;
  sales: Totals | null;
  purchases: Totals | null;
  error: { message: string; cisError?: { faultCode?: string | null; faultString?: string } } | null;
}

export interface Taxpayer {
  Tin: string;
  Name: string;
  Address: string;
  Town: string;
  Country: string;
}

export interface Operator {
  name: string;
  opCode: string;
  idNumber: string;
  validFrom?: string | null;
  validTo?: string | null;
}

export interface BusinessUnit {
  BUCode?: string;
  BUName?: string;
  BUStreetName?: string;
  BUSerialNumber?: string;
  BUValidFrom?: string;
  BUValidTo?: string;
}

export interface Tcr {
  TCRCode?: string;
  TCRIntID?: string;
  BusinUnitCode?: string;
  Type?: string;
  SoftCode?: string;
  MaintainerCode?: string;
  ValidFrom?: string;
  ValidTo?: string;
}

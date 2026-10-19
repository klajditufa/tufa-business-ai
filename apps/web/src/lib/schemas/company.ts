import { z } from "zod";

const niptRegex = /^[A-Z][0-9]{8}[A-Z]$/;

export const companySchema = z.object({
  orgType: z.enum(["single", "studio"]),
  orgName: z.string().min(2).max(120),
  nipt: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => niptRegex.test(s), "NIPT i pavlefshëm (p.sh. K12345678A)"),
  legal_name: z.string().min(2).max(200),
  trade_name: z.string().max(200).optional().or(z.literal("")),
  legal_form: z.enum(["pf", "shpk", "sha", "ojf", "tjeter"]),
  administrator_name: z.string().max(200).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  tax_regime: z.enum(["standard", "simplified", "exempt"]),
  vat_registered: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  base_currency: z.enum(["ALL", "EUR", "USD"]),
});


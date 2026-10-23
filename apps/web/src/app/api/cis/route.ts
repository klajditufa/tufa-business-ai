import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { OPERATIONS, SERVICES, type CisOperation } from "@/lib/cis/sign";

/**
 * /api/cis · përcjellës i kërkesave të nënshkruara drejt CIS (fiskalizimi i DPT-së).
 *
 * Shfletuesi i përdoruesit e nënshkruan kërkesën me certifikatën e subjektit (çelësi privat nuk vjen
 * kurrë këtu). CIS nuk lejon thirrje direkte nga shfletuesi (CORS), prandaj TUFA vetëm e përcjell.
 * Kontrollet: përdorues i kyçur me të drejtën invoices.write për subjektin; vetëm operacione leximi;
 * mesazhi duhet të ketë formën e saktë dhe certifikata duhet të jetë e NIPT-it të subjektit.
 * Asgjë nga mesazhi nuk ruhet as nuk shkruhet në log.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  companyId: z.string().uuid(),
  environment: z.enum(["production", "test"]),
  operation: z.enum(Object.keys(OPERATIONS) as [CisOperation, ...CisOperation[]]),
  envelope: z.string().min(200).max(64_000),
});

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status });

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail(400, "Trupi duhet të jetë JSON");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail(400, "Kërkesë e pavlefshme");
  const { companyId, environment, operation, envelope } = parsed.data;

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return fail(401, "Duhet të jeni të kyçur");
  const [{ data: perms }, { data: company }] = await Promise.all([
    supabase.rpc("my_permissions", { p_company_id: companyId }),
    supabase.from("companies").select("nipt").eq("id", companyId).maybeSingle(),
  ]);
  if (!company || !(perms ?? []).some((p) => p.module === "invoices" && p.action === "write")) {
    return fail(403, "Nuk ke të drejtë të marrësh faturat e këtij subjekti");
  }

  // Forma e mesazhit: zarfi SOAP i TUFA me një kërkesë leximi të vetme, pa DTD.
  const op = OPERATIONS[operation];
  const service = SERVICES[op.service];
  const head =
    `<?xml version='1.0' encoding='UTF-8'?>\n<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body>` +
    `<${operation}Request xmlns="${service.prefix}/schema" Id="Request" Version="${op.version}">`;
  const tail = `</${operation}Request></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
  if (!envelope.startsWith(head) || !envelope.endsWith(tail) || envelope.includes("<!") || envelope.split("<SOAP-ENV:Body>").length !== 2) {
    return fail(400, "Mesazh CIS i pavlefshëm");
  }
  // Certifikata në nënshkrim duhet të jetë e këtij subjekti (NIPT-i ndodhet në subjektin e saj).
  const certB64 = /<X509Certificate>([A-Za-z0-9+/=]+)<\/X509Certificate>/.exec(envelope)?.[1];
  const nipt = String(company.nipt).toUpperCase();
  if (!certB64 || !Buffer.from(certB64, "base64").toString("latin1").toUpperCase().includes(nipt)) {
    return fail(400, `Certifikata nuk është e subjektit ${nipt}`);
  }

  let response: Response;
  try {
    response = await fetch(service.url[environment], {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `${service.prefix}/${operation}`, Accept: "text/xml" },
      body: envelope,
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    return fail(502, "Shërbimi i fiskalizimit nuk u arrit. Provo pas pak.", { unreachable: true });
  }
  const text = await response.text();
  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8", "X-CIS-Status": String(response.status), "Cache-Control": "no-store" },
  });
}

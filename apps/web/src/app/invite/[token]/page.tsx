import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptInvitationAction } from "@/server/actions/settings";
import { Alert, Button, Card } from "@/components/ui";

/**
 * /invite/[token] · Nëse je i loguar: pranon ftesën dhe të çon te subjekti.
 * Nëse jo: tregon për cilin subjekt është dhe të çon te regjistrimi/hyrja me kthim këtu.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: preview }, { data: { user } }] = await Promise.all([
    supabase.rpc("invitation_preview", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const p = preview as { email: string; role: string; target: string; expired: boolean; used: boolean } | null;

  if (!p) return <Shell><Alert tone="danger">Kjo ftesë nuk ekziston.</Alert></Shell>;
  if (p.used) return <Shell><Alert tone="warning">Kjo ftesë është përdorur tashmë. <Link href="/app" className="underline">Hyr në llogari</Link>.</Alert></Shell>;
  if (p.expired) return <Shell><Alert tone="warning">Ftesa ka skaduar. Kërko një link të ri nga personi që të ftoi.</Alert></Shell>;

  if (user) {
    const res = await acceptInvitationAction(token);
    if (res.ok) redirect(res.companyId ? `/app/${res.companyId}/dashboard` : "/app");
    return (
      <Shell>
        <Alert tone="danger">{res.error}</Alert>
        <p className="mt-3 text-sm text-muted-foreground">Je loguar si <b>{user.email}</b>; ftesa është për <b>{p.email}</b>.</p>
      </Shell>
    );
  }

  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <Shell>
      <p className="text-sm">Je ftuar si <b>{p.role}</b> te <b>{p.target}</b> me email-in <b>{p.email}</b>.</p>
      <div className="mt-4 flex gap-2">
        <Link href={`/register?next=${next}`}><Button>Krijo llogari</Button></Link>
        <Link href={`/login?next=${next}`}><Button variant="secondary">Kam llogari — hyr</Button></Link>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Regjistrohu me të njëjtin email që të pranohet ftesa automatikisht.</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <h1 className="mb-3 text-xl font-semibold">Ftesë · TUFA Business AI</h1>
        {children}
      </Card>
    </main>
  );
}

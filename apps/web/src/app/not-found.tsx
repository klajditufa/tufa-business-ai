import Link from "next/link";
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Faqja nuk u gjet</h1>
      <p className="text-sm text-muted-foreground">Ose nuk ke akses në këtë subjekt.</p>
      <Link href="/app" className="text-accent hover:underline">Kthehu te paneli</Link>
    </main>
  );
}

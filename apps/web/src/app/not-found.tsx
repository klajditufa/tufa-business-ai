import { Title } from "@mantine/core";
import Link from "next/link";
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <Title order={2} fz={{ base: 20, sm: 24 }}>Faqja nuk u gjet</Title>
      <p className="text-sm text-muted-foreground">Ose nuk ke akses në këtë subjekt.</p>
      <Link href="/app" className="text-accent hover:underline">Kthehu te paneli</Link>
    </main>
  );
}

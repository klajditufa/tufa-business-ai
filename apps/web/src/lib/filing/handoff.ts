"use client";

/**
 * Kalimi i faqes së marrë nga e-Filing te Listëpagesa brenda të njëjtës skedë (pa ruajtje në disk):
 * skeda e-Filing e vendos, faqja e listëpagesës e merr një herë kur hapet.
 */
export type HandoffSnapshot = { url: string; title: string; nipt: string; tables: string[][][]; capturedAt: number };

let pending: { companyId: string; snapshot: HandoffSnapshot; at: number } | null = null;

export function handOff(companyId: string, snapshot: HandoffSnapshot) {
  pending = { companyId, snapshot, at: Date.now() };
}

export function takeHandOff(companyId: string): HandoffSnapshot | null {
  const item = pending;
  pending = null;
  if (!item || item.companyId !== companyId || Date.now() - item.at > 5 * 60 * 1000) return null;
  return item.snapshot;
}

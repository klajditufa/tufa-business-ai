import { useCallback, useRef, useState } from "react";
import { invoicesPath } from "../../api";
import type { Invoice, Kind } from "../../types";
import { useApi } from "../session/context";

const WORKERS = 4; // invoices fetched at the same time

export interface DetailsProgress {
  loading: boolean;
  done: number;
  total: number;
  error: unknown;
}

/**
 * Complete invoices (with their items) by FIC. CIS lists come without items, so each invoice
 * is fetched on its own, a few at a time, and kept for the rest of the session.
 *
 * `known` is an immutable snapshot that is replaced whenever invoices were added, so views can
 * use it as a dependency; loading itself works on the live map.
 */
export function useInvoiceDetails(kind: Kind) {
  const call = useApi();
  const store = useRef(new Map<string, Invoice>()).current;
  const [known, setKnown] = useState<ReadonlyMap<string, Invoice>>(() => new Map());
  const [progress, setProgress] = useState<DetailsProgress>({
    loading: false,
    done: 0,
    total: 0,
    error: null,
  });
  const run = useRef(0);
  const active = useRef<Promise<boolean> | null>(null);

  const publish = useCallback(() => setKnown(new Map(store)), [store]);

  const missing = useCallback(
    (invoices: Invoice[]) => invoices.filter((invoice) => invoice.FIC && !store.has(invoice.FIC)),
    [store],
  );

  const remember = useCallback(
    (invoice: Invoice) => {
      if (!invoice.FIC) return;
      store.set(invoice.FIC, invoice);
      publish();
    },
    [store, publish],
  );

  /** Loads what is missing. Resolves true when every invoice is complete; stops at the first error. */
  const load = useCallback(
    async (invoices: Invoice[]): Promise<boolean> => {
      while (active.current) await active.current;
      const pending = missing(invoices);
      if (!pending.length) return true;
      const id = ++run.current;
      const work = (async () => {
        setProgress({ loading: true, done: 0, total: pending.length, error: null });
        let next = 0;
        let done = 0;
        let failure: unknown = null;
        const worker = async () => {
          for (
            let invoice = pending[next++];
            invoice && run.current === id && failure === null;
            invoice = pending[next++]
          ) {
            try {
              const found = await call<Invoice[]>(invoicesPath(kind), { FIC: invoice.FIC });
              store.set(invoice.FIC as string, found[0] ?? invoice);
              done += 1;
              if (run.current === id) setProgress((state) => ({ ...state, done }));
            } catch (error) {
              failure ??= error;
            }
          }
        };
        await Promise.all(Array.from({ length: WORKERS }, worker));
        const stopped = run.current !== id;
        setProgress({ loading: false, done, total: pending.length, error: stopped ? null : failure });
        publish();
        return !stopped && failure === null;
      })();
      active.current = work;
      try {
        return await work;
      } finally {
        active.current = null;
      }
    },
    [call, kind, missing, publish, store],
  );

  /** Stops loading; what was loaded stays. */
  const stop = useCallback(() => {
    run.current += 1;
  }, []);

  /** Everything loaded so far, including what arrived after the last render. */
  const current = useCallback((): ReadonlyMap<string, Invoice> => store, [store]);

  return { known, progress, load, stop, remember, missing, current };
}

export type InvoiceDetails = ReturnType<typeof useInvoiceDetails>;

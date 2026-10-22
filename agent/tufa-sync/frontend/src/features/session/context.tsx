import { createContext, useCallback, useContext } from "react";
import { api } from "../../api";
import type { Business, Session } from "../../types";

interface SessionState {
  session: Session;
  setSession: (session: Session) => void;
}

/** Null until the session is known; components below the workspace always have one. */
export const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession needs SessionContext");
  return context;
}

/** The business whose data a part of the page shows. */
export const BusinessContext = createContext<Business | null>(null);

export function useBusiness(): Business {
  const business = useContext(BusinessContext);
  if (!business) throw new Error("useBusiness needs BusinessContext");
  return business;
}

export type ApiCall = <T>(path: string, body?: unknown) => Promise<T>;

/** POST to the API on behalf of the current business. */
export function useApi(): ApiCall {
  const { id } = useBusiness();
  return useCallback(<T,>(path: string, body: unknown = {}) => api<T>(path, body, { business: id }), [id]);
}

export const businessName = (business: Business): string =>
  business.certificate.name || business.certificate.commonName || business.certificate.nipt || business.id;

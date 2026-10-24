export interface PortalField {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "checkbox" | "radio" | "select";
  value: string;
  readOnly: boolean;
  options: { value: string; label: string }[];
}

export interface PortalSnapshot {
  title: string;
  url: string;
  nipt: string;
  revision: string;
  forms: { title: string; fields: PortalField[] }[];
  tables: string[][][];
  navigation?: { key: string; label: string; url: string }[];
  capturedAt: number;
}

export interface FilingState {
  connectionKind: "managed" | "extension" | null;
  configured: boolean;
  remembered: boolean;
  connected: boolean;
  username: string;
  snapshot: PortalSnapshot | null;
  command: { id: string; kind: string; status: string } | null;
  outcome: { ok: boolean; message: string; code?: string } | null;
  review: { id: string; revision: string; edits: Record<string, string> } | null;
  portalUrl: string;
}

export interface BrowserState {
  nodeAvailable: boolean;
  installed: boolean;
  installing: boolean;
  running: boolean;
  ready: boolean;
  channel: string;
  error: string;
  stopping: boolean;
  visible: boolean;
  authentication: string;
}

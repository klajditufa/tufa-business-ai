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

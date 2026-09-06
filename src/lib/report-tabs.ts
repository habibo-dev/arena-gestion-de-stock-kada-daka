export const REPORT_TABS = [
  { value: "stock", label: "État du stock" },
  { value: "valeur", label: "Valeur du stock" },
  { value: "ventes", label: "Ventes" },
  { value: "achats", label: "Achats" },
  { value: "mouvements", label: "Mouvements" },
  { value: "top", label: "Top ventes" },
  { value: "rotation", label: "Rotation" },
] as const;
export type ReportTab = (typeof REPORT_TABS)[number]["value"];

import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  primaire: "#2E75B6",
  secondaire: "#1B3A5C",
  texte: "#333333",
  gris: "#666666",
  gris_clair: "#999999",
  fond_header_tableau: "#D6E4F0",
  fond_alternance: "#F2F5F8",
  blanc: "#FFFFFF",
  trait: "#2E75B6",
  fond_watermark: "#E0E0E0",
  vert: "#2E7D32",
  orange: "#E65100",
  rouge: "#C62828",
};

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.4, // opt 17
    color: colors.texte,
    paddingTop: 50, // opt 12
    paddingBottom: 40, // opt 13
    paddingLeft: 56,
    paddingRight: 56,
  },
  headerFixed: {
    position: "absolute",
    top: 20,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.primaire,
    paddingBottom: 6,
  },
  headerText: {
    fontSize: 7.5, // opt 50
    color: colors.gris,
  },
  footerFixed: {
    position: "absolute",
    bottom: 20,
    left: 56,
    right: 56,
    borderTopWidth: 0.5,
    borderTopColor: colors.primaire,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7.5, // opt 50
    color: colors.gris_clair,
  },
  sectionBandeau: {
    backgroundColor: colors.secondaire,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 12, // opt 14
    marginBottom: 4, // opt 15
  },
  sectionBandeauText: {
    color: colors.blanc,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  sectionSubtitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.secondaire,
    marginTop: 10,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 9.5,
    lineHeight: 1.4, // opt 17
    textAlign: "justify",
    marginBottom: 3, // opt 16
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E0E0E0",
    minHeight: 22,
    alignItems: "center",
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E0E0E0",
    minHeight: 22,
    alignItems: "center",
    backgroundColor: "#F2F5F8",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.fond_header_tableau, // opt 20, 27, 33
    borderBottomWidth: 1,
    borderBottomColor: colors.secondaire,
    minHeight: 26,
    alignItems: "center",
  },
  tableCell: {
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tableCellBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  watermark: {
    position: "absolute",
    top: "40%",
    left: "20%",
    fontSize: 64,
    color: "#D0D0D0",
    opacity: 0.12,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 8,
  },
  signatureContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24, // opt 18/46
    paddingHorizontal: 20,
  },
  signatureBlock: {
    width: "40%",
    alignItems: "center",
  },
  bulletPoint: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 12,
  },
  bulletSymbol: {
    width: 15,
    fontSize: 9,
  },
  bulletText: {
    fontSize: 9,
    flex: 1,
    lineHeight: 1.4,
  },
  // Cover page
  coverTitle: {
    fontSize: 24, // opt 4
    fontFamily: "Helvetica-Bold", // opt 4
    color: colors.secondaire,
    textAlign: "center",
    textTransform: "uppercase", // opt 4
    marginTop: 20, // opt 3
    marginBottom: 6,
  },
  coverSubtitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.primaire,
    textAlign: "center",
    textTransform: "uppercase", // opt 5
    marginBottom: 4,
  },
  coverNorme: {
    fontSize: 11,
    color: colors.gris,
    textAlign: "center",
    marginBottom: 8, // reduced
  },
  coverInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3, // opt 7 — tighter spacing
  },
  coverInfoLabel: {
    fontSize: 9,
    color: colors.gris, // opt 7
  },
  coverInfoValue: {
    fontSize: 10, // opt 7
    fontFamily: "Helvetica-Bold", // opt 7
  },
  // Destinataire
  destBlock: {
    marginTop: 8, // opt 9
    padding: 8,
    borderWidth: 0.5,
    borderColor: colors.primaire,
    borderRadius: 2,
  },
  destText: {
    fontSize: 10,
    lineHeight: 1.5,
  },
  // Separator line
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: colors.primaire,
    marginVertical: 8, // opt 8 — tighter
  },
});

/** Safe string: never show undefined/null */
export function s(v: unknown): string {
  if (v === null || v === undefined || v === "") return "\u2014";
  return String(v);
}

/** Safe number coercion — never returns NaN/Infinity */
export function safeNumber(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined) return fallback;
  const n = typeof val === "string" ? parseFloat(val) : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

// opt 25 — bulletproof formatMontant that never produces "/" or NaN
export function formatMontant(val: unknown): string {
  const n = safeNumber(val, 0);
  if (n === 0) return "\u2014";
  const abs = Math.round(Math.abs(n));
  const str = abs.toString();
  const parts: string[] = [];
  for (let i = str.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) parts.push("\u202F");
    parts.push(str[i]);
  }
  const formatted = (n < 0 ? "-" : "") + parts.reverse().join("");
  return `${formatted} \u20AC HT`;
}

export function formatMontantUnit(val: unknown, unit: string): string {
  const n = safeNumber(val, 0);
  const abs = Math.round(Math.abs(n));
  const str = abs.toString();
  const parts: string[] = [];
  for (let i = str.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) parts.push("\u202F");
    parts.push(str[i]);
  }
  const formatted = (n < 0 ? "-" : "") + parts.reverse().join("");
  return `${formatted} \u20AC HT / ${unit}`;
}

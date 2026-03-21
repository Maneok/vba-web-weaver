import React from "react";
import { View, Text, Svg, Circle, Path, Image } from "@react-pdf/renderer";

export interface PdfTheme {
  primaire: string;
  secondaire: string;
  text: string;
  muted: string;
  light: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
}

export const DEFAULT_THEME: PdfTheme = {
  primaire: "#2E75B6",
  secondaire: "#1B3A5C",
  text: "#333333",
  muted: "#888888",
  light: "#F8F9FA",
  border: "#E0E0E0",
  success: "#2E7D32",
  warning: "#E65100",
  danger: "#C62828",
};

/** Bande colorée verticale gauche — signature visuelle du cabinet */
export const SideStripe: React.FC<{ color: string }> = ({ color }) => (
  <View
    fixed
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: color,
    }}
  />
);

/** V2-8/9: Bandeau de section — accent strip 3px, paddingVertical 6 */
export const SectionBanner: React.FC<{ title: string; theme: PdfTheme }> = ({ title, theme }) => (
  <View
    style={{
      flexDirection: "row",
      marginTop: 14,
      marginBottom: 6,
    }}
    wrap={false}
  >
    <View
      style={{
        width: 3,
        backgroundColor: theme.primaire,
        borderTopLeftRadius: 6,
        borderBottomLeftRadius: 6,
      }}
    />
    <View
      style={{
        flex: 1,
        backgroundColor: theme.secondaire,
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderTopRightRadius: 6,
        borderBottomRightRadius: 6,
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 10,
          fontFamily: "Helvetica-Bold",
          textTransform: "uppercase",
          letterSpacing: 0.3,
        }}
      >
        {title}
      </Text>
    </View>
  </View>
);

/** V2-35/36/37: Score gauge — 72x72 (was 66), score fontSize 18, label fontSize 8 */
export const ScoreGauge: React.FC<{ score: number; max: number; color: string }> = ({
  score,
  max,
  color,
}) => {
  const clamped = Math.max(0, Math.min(max, score));
  return (
    <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
      <Svg viewBox="0 0 72 72" style={{ width: 72, height: 72 }}>
        {/* Background circle */}
        <Circle cx="36" cy="36" r="30" fill="none" stroke="#E8E8E8" strokeWidth={4} />
        {/* Colored ring */}
        <Circle cx="36" cy="36" r="30" fill="none" stroke={color} strokeWidth={4} opacity={0.25} />
        {/* Inner fill */}
        <Circle cx="36" cy="36" r="22" fill={color} opacity={0.08} />
      </Svg>
      {/* Score text overlaid with absolute positioning */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color }}>{clamped}</Text>
        <Text style={{ fontSize: 8, color: "#999999", marginTop: -1 }}>/ {max}</Text>
      </View>
    </View>
  );
};

/** Badge arrondi coloré — V2-32: borderWidth for definition */
export const Badge: React.FC<{ text: string; bgColor: string; textColor: string; bordered?: boolean }> = ({
  text,
  bgColor,
  textColor,
  bordered,
}) => (
  <View
    style={{
      backgroundColor: bgColor,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      alignSelf: "flex-start",
      borderWidth: bordered ? 0.5 : 0,
      borderColor: bordered ? textColor : "transparent",
    }}
  >
    <Text style={{ fontSize: 7.5, color: textColor, fontFamily: "Helvetica-Bold" }}>{text}</Text>
  </View>
);

/** Séparateur premium */
export const Separator: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 8 }}>
    <View style={{ flex: 1, height: 1.5, backgroundColor: color }} />
    <View style={{ width: 6 }} />
    <View style={{ flex: 3, height: 0.5, backgroundColor: color, opacity: 0.3 }} />
  </View>
);

/** V2-7: Decorative dot for cover info section */
export const CoverDot: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color, marginRight: 6, marginTop: 2 }} />
);

/** V2-40/41/42/43/44: Encadré signature — width 44%, minHeight 110, "Lu et approuvé" 7.5pt, date line */
export const SignatureBox: React.FC<{
  label: string;
  name?: string;
  signatureImage?: string;
  boldName?: boolean;
}> = ({ label, name, signatureImage, boldName }) => (
  <View
    style={{
      width: "44%",
      borderWidth: 0.8,
      borderColor: "#CCCCCC",
      
      borderRadius: 4,
      padding: 10,
      alignItems: "center",
      minHeight: 110,
    }}
  >
    <Text
      style={{
        fontSize: 8.5,
        fontFamily: "Helvetica-Bold",
        color: "#1B3A5C",
        marginBottom: 6,
      }}
    >
      {label}
    </Text>
    {signatureImage ? (
      <Image src={signatureImage} style={{ width: 100, height: 30 }} />
    ) : (
      <View style={{ flex: 1, minHeight: 36 }} />
    )}
    {name && (
      <Text style={{ fontSize: 8, color: "#666666", marginTop: 4, fontFamily: boldName ? "Helvetica-Bold" : "Helvetica" }}>{name}</Text>
    )}
    <View
      style={{
        width: "80%",
        borderBottomWidth: 0.5,
        borderBottomColor: "#BBBBBB",
        marginTop: 2,
      }}
    />
    {/* V2-43: date line */}
    <Text style={{ fontSize: 7, color: "#BBBBBB", marginTop: 3 }}>Date : ___/___/______</Text>
    {/* V2-42: fontSize 7.5 (was 7) */}
    <Text style={{ fontSize: 7.5, color: "#999999", marginTop: 2 }}>Lu et approuvé</Text>
  </View>
);

/** SVG Checkmark icon for tables */
export const CheckIcon: React.FC<{ color?: string; size?: number }> = ({
  color = "#2E7D32",
  size = 10,
}) => (
  <Svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
    <Path
      d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
      fill={color}
    />
  </Svg>
);

/** V2-7/6: Ligne d'information premium avec dot décoratif */
export const InfoRow: React.FC<{
  label: string;
  value: string;
  bold?: boolean;
  theme: PdfTheme;
}> = ({ label, value, bold, theme }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 4,
      borderBottomWidth: 0.3,
      borderBottomColor: "#E8E8E8",
    }}
  >
    <CoverDot color={theme.primaire} />
    <Text style={{ fontSize: 8.5, color: theme.muted, width: 60 }}>{label}</Text>
    <Text
      style={{
        fontSize: 9,
        fontFamily: bold !== false ? "Helvetica-Bold" : "Helvetica",
        color: theme.text,
        flex: 1,
      }}
    >
      {value}
    </Text>
  </View>
);

/** Wrapper for rounded tables */
export const RoundedTableWrapper: React.FC<{
  children: React.ReactNode;
  borderColor?: string;
}> = ({ children, borderColor = "#E0E0E0" }) => (
  <View
    style={{
      borderWidth: 0.5,
      borderColor,
      borderRadius: 6,
      overflow: "hidden",
    }}
  >
    {children}
  </View>
);

/** V2-48/49: Annexe signature box — paddingBottom 40, marginTop 20, separator above */
export const AnnexeSignatureBox: React.FC<{
  text: string;
  sublabel: string;
}> = ({ text, sublabel }) => (
  <View>
    {/* V2-49: separator above signature */}
    <View style={{ borderBottomWidth: 0.3, borderBottomColor: "#E0E0E0", marginTop: 16, marginBottom: 4 }} />
    <View
      style={{
        marginTop: 4,
        borderWidth: 0.8,
        borderColor: "#CCCCCC",
        
        borderRadius: 4,
        padding: 14,
        paddingBottom: 40,
      }}
    >
      <Text style={{ fontSize: 9, color: "#333333", fontFamily: "Helvetica-Oblique" }}>
        {text}
      </Text>
      <Text style={{ fontSize: 8, color: "#666666", marginTop: 14 }}>{sublabel}</Text>
      {/* V2-43: date line in annexe signature too */}
      <Text style={{ fontSize: 7, color: "#BBBBBB", marginTop: 6 }}>Date : ___/___/______</Text>
    </View>
  </View>
);

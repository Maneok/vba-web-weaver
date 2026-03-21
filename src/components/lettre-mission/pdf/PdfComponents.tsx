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

/** Bande colorée verticale gauche — signature visuelle du cabinet (opt 1) */
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

/** Bandeau de section premium avec accent gauche */
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
        width: 4,
        backgroundColor: theme.primaire,
        borderTopLeftRadius: 6,
        borderBottomLeftRadius: 6,
      }}
    />
    <View
      style={{
        flex: 1,
        backgroundColor: theme.secondaire,
        paddingVertical: 5,
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

/** Score gauge — simplified circle with centered score text (opt 29) */
export const ScoreGauge: React.FC<{ score: number; max: number; color: string }> = ({
  score,
  max,
  color,
}) => {
  const clamped = Math.max(0, Math.min(max, score));
  return (
    <View style={{ width: 66, height: 66, alignItems: "center", justifyContent: "center" }}>
      <Svg viewBox="0 0 66 66" style={{ width: 66, height: 66 }}>
        {/* Background circle */}
        <Circle cx="33" cy="33" r="28" fill="none" stroke="#E8E8E8" strokeWidth={4} />
        {/* Colored ring */}
        <Circle cx="33" cy="33" r="28" fill="none" stroke={color} strokeWidth={4} opacity={0.25} />
        {/* Inner fill */}
        <Circle cx="33" cy="33" r="20" fill={color} opacity={0.08} />
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
        <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color }}>{clamped}</Text>
        <Text style={{ fontSize: 7, color: "#999999", marginTop: -1 }}>/ {max}</Text>
      </View>
    </View>
  );
};

/** Badge arrondi coloré (opt 30-31) */
export const Badge: React.FC<{ text: string; bgColor: string; textColor: string }> = ({
  text,
  bgColor,
  textColor,
}) => (
  <View
    style={{
      backgroundColor: bgColor,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      alignSelf: "flex-start",
    }}
  >
    <Text style={{ fontSize: 7.5, color: textColor, fontFamily: "Helvetica-Bold" }}>{text}</Text>
  </View>
);

/** Séparateur premium (opt 4) */
export const Separator: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 8 }}>
    <View style={{ flex: 1, height: 1.5, backgroundColor: color }} />
    <View style={{ width: 6 }} />
    <View style={{ flex: 3, height: 0.5, backgroundColor: color, opacity: 0.3 }} />
  </View>
);

/** Encadré signature premium avec pointillés et "Lu et approuvé" */
export const SignatureBox: React.FC<{
  label: string;
  name?: string;
  signatureImage?: string;
  boldName?: boolean;
}> = ({ label, name, signatureImage, boldName }) => (
  <View
    style={{
      width: "42%",
      borderWidth: 0.8,
      borderColor: "#CCCCCC",
      borderStyle: "dashed",
      borderRadius: 4,
      padding: 10,
      alignItems: "center",
      minHeight: 100,
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
      <View style={{ flex: 1, minHeight: 40 }} />
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
    <Text style={{ fontSize: 7, color: "#999999", marginTop: 3 }}>Lu et approuvé</Text>
  </View>
);

/** SVG Checkmark icon for tables (opt 26) */
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

/** Ligne d'information clé-valeur premium pour la page de garde (opt 5) */
export const InfoRow: React.FC<{
  label: string;
  value: string;
  bold?: boolean;
  theme: PdfTheme;
}> = ({ label, value, bold, theme }) => (
  <View
    style={{
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 3,
      borderBottomWidth: 0.3,
      borderBottomColor: "#E8E8E8",
    }}
  >
    <Text style={{ fontSize: 8.5, color: theme.muted }}>{label}</Text>
    <Text
      style={{
        fontSize: 9,
        fontFamily: bold !== false ? "Helvetica-Bold" : "Helvetica",
        color: theme.text,
      }}
    >
      {value}
    </Text>
  </View>
);

/** Wrapper for rounded tables (opt 17, 22, 25) */
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

/** Annexe signature box (simplified for annexes) (opt 39, 43) */
export const AnnexeSignatureBox: React.FC<{
  text: string;
  sublabel: string;
}> = ({ text, sublabel }) => (
  <View
    style={{
      marginTop: 24,
      borderWidth: 0.8,
      borderColor: "#CCCCCC",
      borderStyle: "dashed",
      borderRadius: 4,
      padding: 14,
      paddingBottom: 44,
    }}
  >
    <Text style={{ fontSize: 9, color: "#333333", fontFamily: "Helvetica-Oblique" }}>
      {text}
    </Text>
    <Text style={{ fontSize: 8, color: "#666666", marginTop: 14 }}>{sublabel}</Text>
  </View>
);

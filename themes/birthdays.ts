import type { CSSProperties } from "react";

export const AUTO_THEME_ID = "auto" as const;

export const BIRTHDAY_THEME_IDS = [
  "newyear",
  "hearts",
  "womens-month",
  "pastel-spring",
  "fiesta",
  "rainy-season",
  "independence",
  "green-harvest",
  "emerald",
  "halloween",
  "november-fall",
  "holidays",
] as const;

export type BirthdayThemeId = (typeof BIRTHDAY_THEME_IDS)[number];
export type BirthdayThemeMode = typeof AUTO_THEME_ID | BirthdayThemeId;

export type OrnamentKind =
  | "none"
  | "confetti"
  | "snow"
  | "stars"
  | "leaves"
  | "bats"
  | "bunting";

type CSSVarMap = Record<`--${string}`, string>;

export interface BirthdayTheme {
  id: BirthdayThemeId;
  label: string;
  cssVars: CSSVarMap;
  exportSafeCssVars?: CSSVarMap;
  ornament?: OrnamentKind;
  badge?: string;
  headerStyle?: "gradient" | "solid";
  headingFont?: string;
  watermarkText?: string;
  watermarkOpacity?: number;
  accentColor: string;
  accentSoftColor?: string;
  accentTextColor?: string;
  exportSafeDefaults?: boolean;
}

const headingFallback = "'Bebas Neue', 'Oswald', 'Impact', 'Arial Black', sans-serif";

const birthdayThemePresets: Record<BirthdayThemeId, BirthdayTheme> = {
  "newyear": {
    id: "newyear",
    label: "New Year Sparkle (Jan)",
    ornament: "stars",
    badge: "🎇",
    headerStyle: "gradient",
    headingFont: headingFallback,
    watermarkText: "SPARKLE",
    watermarkOpacity: 0.06,
    accentColor: "#facc15",
    accentSoftColor: "#fde68a",
    accentTextColor: "#0f172a",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #0b1120 0%, #020617 52%, #111827 100%)",
      "--bday-border": "rgba(148, 163, 184, 0.38)",
      "--bday-board-shadow": "0 30px 60px rgba(15, 23, 42, 0.45)",
      "--bday-board-shadow-safe": "0 18px 36px rgba(15, 23, 42, 0.28)",
      "--bday-heading-gradient": "linear-gradient(90deg, #fde68a 0%, #facc15 42%, #fef3c7 100%)",
      "--bday-heading-color": "#facc15",
      "--bday-heading-shadow": "0 12px 26px rgba(8, 47, 73, 0.6)",
      "--bday-subheading-color": "#fefce8",
      "--bday-card-surface": "rgba(15, 23, 42, 0.55)",
      "--bday-card-border": "rgba(148, 163, 184, 0.6)",
      "--bday-card-shadow": "0 22px 44px rgba(15, 23, 42, 0.55)",
      "--bday-card-shadow-safe": "0 12px 22px rgba(15, 23, 42, 0.3)",
      "--bday-namebar-bg": "linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(8, 47, 73, 0.9) 100%)",
      "--bday-namebar-text-color": "#f8fafc",
      "--bday-namebar-text-shadow": "0 3px 8px rgba(2, 6, 23, 0.9)",
      "--bday-badge-bg": "rgba(250, 204, 21, 0.9)",
      "--bday-badge-color": "#111827",
      "--bday-watermark-color": "rgba(250, 204, 21, 0.12)",
      "--bday-accent": "#facc15",
      "--bday-accent-soft": "rgba(250, 204, 21, 0.28)",
      "--bday-ornament-color": "rgba(253, 230, 138, 0.75)",
      "--bday-foreground": "#e2e8f0",
    },
    exportSafeCssVars: {
      "--bday-bg": "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      "--bday-card-surface": "rgba(15, 23, 42, 0.12)",
      "--bday-card-border": "rgba(148, 163, 184, 0.5)",
    },
  },
  "hearts": {
    id: "hearts",
    label: "Hearts (Feb)",
    ornament: "confetti",
    badge: "❤️",
    headerStyle: "gradient",
    headingFont: headingFallback,
    watermarkText: "LOVE",
    watermarkOpacity: 0.06,
    accentColor: "#f43f5e",
    accentSoftColor: "#fda4af",
    accentTextColor: "#831843",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #fce7f3 0%, #f43f5e 50%, #be123c 100%)",
      "--bday-border": "rgba(244, 114, 182, 0.42)",
      "--bday-board-shadow": "0 28px 48px rgba(190, 24, 93, 0.36)",
      "--bday-board-shadow-safe": "0 18px 32px rgba(190, 24, 93, 0.24)",
      "--bday-heading-gradient": "linear-gradient(90deg, #fda4af 0%, #f43f5e 40%, #fb7185 100%)",
      "--bday-heading-color": "#fb7185",
      "--bday-heading-shadow": "0 10px 22px rgba(190, 24, 93, 0.5)",
      "--bday-subheading-color": "#fee2e2",
      "--bday-card-surface": "rgba(255, 255, 255, 0.7)",
      "--bday-card-border": "rgba(244, 114, 182, 0.45)",
      "--bday-card-shadow": "0 18px 32px rgba(244, 63, 94, 0.25)",
      "--bday-card-shadow-safe": "0 12px 22px rgba(244, 63, 94, 0.2)",
      "--bday-namebar-bg": "linear-gradient(180deg, rgba(244, 63, 94, 0) 0%, rgba(190, 24, 93, 0.85) 100%)",
      "--bday-namebar-text-color": "#fff1f2",
      "--bday-namebar-text-shadow": "0 2px 6px rgba(131, 24, 67, 0.8)",
      "--bday-badge-bg": "rgba(244, 63, 94, 0.88)",
      "--bday-badge-color": "#fff1f2",
      "--bday-watermark-color": "rgba(244, 114, 182, 0.12)",
      "--bday-accent": "#f43f5e",
      "--bday-accent-soft": "rgba(244, 114, 182, 0.38)",
      "--bday-ornament-color": "rgba(249, 168, 212, 0.8)",
      "--bday-foreground": "#fff7f9",
    },
    exportSafeCssVars: {
      "--bday-bg": "linear-gradient(135deg, #fdf2f8 0%, #fbcfe8 100%)",
      "--bday-card-surface": "rgba(255, 255, 255, 0.92)",
      "--bday-card-border": "rgba(251, 182, 206, 0.6)",
    },
  },
  "womens-month": {
    id: "womens-month",
    label: "Women's Month Orchid (Mar)",
    ornament: "confetti",
    badge: "💜",
    headerStyle: "gradient",
    headingFont: headingFallback,
    watermarkText: "EMPOWER",
    watermarkOpacity: 0.05,
    accentColor: "#a855f7",
    accentSoftColor: "#d8b4fe",
    accentTextColor: "#3b0764",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #f5d0fe 0%, #a855f7 45%, #6b21a8 100%)",
      "--bday-border": "rgba(192, 132, 252, 0.45)",
      "--bday-board-shadow": "0 28px 50px rgba(76, 29, 149, 0.4)",
      "--bday-board-shadow-safe": "0 18px 32px rgba(76, 29, 149, 0.28)",
      "--bday-heading-gradient": "linear-gradient(90deg, #f0abfc 0%, #c084fc 45%, #a855f7 100%)",
      "--bday-heading-color": "#c084fc",
      "--bday-heading-shadow": "0 10px 24px rgba(59, 7, 100, 0.55)",
      "--bday-subheading-color": "#f5d0fe",
      "--bday-card-surface": "rgba(255, 255, 255, 0.74)",
      "--bday-card-border": "rgba(216, 180, 254, 0.55)",
      "--bday-card-shadow": "0 18px 36px rgba(168, 85, 247, 0.28)",
      "--bday-card-shadow-safe": "0 12px 24px rgba(168, 85, 247, 0.18)",
      "--bday-namebar-bg": "linear-gradient(180deg, rgba(168, 85, 247, 0) 0%, rgba(107, 33, 168, 0.86) 100%)",
      "--bday-namebar-text-color": "#faf5ff",
      "--bday-namebar-text-shadow": "0 3px 8px rgba(59, 7, 100, 0.85)",
      "--bday-badge-bg": "rgba(168, 85, 247, 0.88)",
      "--bday-badge-color": "#faf5ff",
      "--bday-watermark-color": "rgba(192, 132, 252, 0.12)",
      "--bday-accent": "#a855f7",
      "--bday-accent-soft": "rgba(192, 132, 252, 0.38)",
      "--bday-ornament-color": "rgba(216, 180, 254, 0.7)",
      "--bday-foreground": "#f9f5ff",
    },
    exportSafeCssVars: {
      "--bday-bg": "linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%)",
      "--bday-card-surface": "rgba(255, 255, 255, 0.96)",
      "--bday-card-border": "rgba(196, 181, 253, 0.6)",
    },
  },
  "pastel-spring": {
    id: "pastel-spring",
    label: "Pastel Spring (Apr)",
    ornament: "leaves",
    badge: "🌸",
    headerStyle: "gradient",
    headingFont: headingFallback,
    watermarkText: "SPRING",
    watermarkOpacity: 0.05,
    accentColor: "#34d399",
    accentSoftColor: "#a7f3d0",
    accentTextColor: "#064e3b",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #ecfeff 0%, #a7f3d0 45%, #bfdbfe 100%)",
      "--bday-border": "rgba(165, 243, 252, 0.45)",
      "--bday-board-shadow": "0 24px 46px rgba(14, 116, 144, 0.28)",
      "--bday-board-shadow-safe": "0 16px 28px rgba(14, 116, 144, 0.2)",
      "--bday-heading-gradient": "linear-gradient(90deg, #99f6e4 0%, #34d399 40%, #60a5fa 100%)",
      "--bday-heading-color": "#0ea5e9",
      "--bday-heading-shadow": "0 8px 18px rgba(6, 78, 59, 0.4)",
      "--bday-subheading-color": "#0f766e",
      "--bday-card-surface": "rgba(255, 255, 255, 0.82)",
      "--bday-card-border": "rgba(134, 239, 172, 0.55)",
      "--bday-card-shadow": "0 16px 30px rgba(14, 116, 144, 0.25)",
      "--bday-card-shadow-safe": "0 10px 20px rgba(14, 116, 144, 0.18)",
      "--bday-namebar-bg": "linear-gradient(180deg, rgba(20, 184, 166, 0) 0%, rgba(14, 116, 144, 0.8) 100%)",
      "--bday-namebar-text-color": "#ecfeff",
      "--bday-namebar-text-shadow": "0 2px 5px rgba(6, 78, 59, 0.75)",
      "--bday-badge-bg": "rgba(134, 239, 172, 0.9)",
      "--bday-badge-color": "#064e3b",
      "--bday-watermark-color": "rgba(45, 212, 191, 0.12)",
      "--bday-accent": "#34d399",
      "--bday-accent-soft": "rgba(134, 239, 172, 0.4)",
      "--bday-ornament-color": "rgba(134, 239, 172, 0.6)",
      "--bday-foreground": "#0f172a",
    },
    exportSafeCssVars: {
      "--bday-bg": "linear-gradient(135deg, #f0fdfa 0%, #bae6fd 100%)",
      "--bday-card-surface": "rgba(255, 255, 255, 0.96)",
      "--bday-card-border": "rgba(103, 232, 249, 0.45)",
    },
  },
  "fiesta": {
    id: "fiesta",
    label: "Fiesta Colors (May)",
    ornament: "bunting",
    badge: "🎉",
    headerStyle: "gradient",
    headingFont: headingFallback,
    watermarkText: "FIESTA",
    watermarkOpacity: 0.06,
    accentColor: "#0ea5e9",
    accentSoftColor: "#f97316",
    accentTextColor: "#0c4a6e",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #99f6e4 0%, #0ea5e9 45%, #f97316 100%)",
      "--bday-border": "rgba(14, 165, 233, 0.42)",
      "--bday-board-shadow": "0 28px 52px rgba(14, 165, 233, 0.3)",
      "--bday-board-shadow-safe": "0 18px 32px rgba(14, 165, 233, 0.22)",
      "--bday-heading-gradient": "linear-gradient(90deg, #f97316 0%, #facc15 35%, #0ea5e9 100%)",
      "--bday-heading-color": "#f59e0b",
      "--bday-heading-shadow": "0 10px 24px rgba(8, 145, 178, 0.5)",
      "--bday-subheading-color": "#0f172a",
      "--bday-card-surface": "rgba(255, 255, 255, 0.75)",
      "--bday-card-border": "rgba(14, 165, 233, 0.5)",
      "--bday-card-shadow": "0 20px 36px rgba(14, 165, 233, 0.28)",
      "--bday-card-shadow-safe": "0 12px 22px rgba(14, 165, 233, 0.2)",
      "--bday-namebar-bg": "linear-gradient(180deg, rgba(14, 165, 233, 0) 0%, rgba(8, 145, 178, 0.86) 100%)",
      "--bday-namebar-text-color": "#f8fafc",
      "--bday-namebar-text-shadow": "0 3px 8px rgba(8, 47, 73, 0.85)",
      "--bday-badge-bg": "rgba(14, 165, 233, 0.9)",
      "--bday-badge-color": "#f8fafc",
      "--bday-watermark-color": "rgba(14, 165, 233, 0.12)",
      "--bday-accent": "#0ea5e9",
      "--bday-accent-soft": "rgba(14, 165, 233, 0.35)",
      "--bday-ornament-color": "rgba(249, 115, 22, 0.65)",
      "--bday-foreground": "#082f49",
    },
    exportSafeCssVars: {
      "--bday-bg": "linear-gradient(135deg, #cffafe 0%, #bae6fd 50%, #fee2b7 100%)",
      "--bday-card-surface": "rgba(255, 255, 255, 0.94)",
      "--bday-card-border": "rgba(14, 165, 233, 0.38)",
    },
  },
  "rainy-season": {
    id: "rainy-season",
    label: "Rainy Season (Jun)",
    ornament: "snow",
    badge: "💧",
    headerStyle: "gradient",
    headingFont: headingFallback,
    watermarkText: "RAIN",
    watermarkOpacity: 0.05,
    accentColor: "#38bdf8",
    accentSoftColor: "#bae6fd",
    accentTextColor: "#082f49",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #0f172a 0%, #164e63 48%, #38bdf8 100%)",
      "--bday-border": "rgba(125, 211, 252, 0.45)",
      "--bday-board-shadow": "0 30px 56px rgba(8, 47, 73, 0.4)",
      "--bday-board-shadow-safe": "0 20px 32px rgba(8, 47, 73, 0.28)",
      "--bday-heading-gradient": "linear-gradient(90deg, #bae6fd 0%, #38bdf8 45%, #0ea5e9 100%)",
      "--bday-heading-color": "#e0f2fe",
      "--bday-heading-shadow": "0 12px 26px rgba(15, 118, 110, 0.45)",
      "--bday-subheading-color": "#e0f2fe",
      "--bday-card-surface": "rgba(15, 118, 110, 0.3)",
      "--bday-card-border": "rgba(125, 211, 252, 0.52)",
      "--bday-card-shadow": "0 20px 42px rgba(14, 116, 144, 0.4)",
      "--bday-card-shadow-safe": "0 14px 26px rgba(14, 116, 144, 0.28)",
      "--bday-namebar-bg": "linear-gradient(180deg, rgba(14, 116, 144, 0) 0%, rgba(8, 47, 73, 0.85) 100%)",
      "--bday-namebar-text-color": "#e0f2fe",
      "--bday-namebar-text-shadow": "0 3px 8px rgba(8, 47, 73, 0.85)",
      "--bday-badge-bg": "rgba(56, 189, 248, 0.9)",
      "--bday-badge-color": "#082f49",
      "--bday-watermark-color": "rgba(56, 189, 248, 0.12)",
      "--bday-accent": "#38bdf8",
      "--bday-accent-soft": "rgba(56, 189, 248, 0.35)",
      "--bday-ornament-color": "rgba(125, 211, 252, 0.6)",
      "--bday-foreground": "#e0f2fe",
    },
    exportSafeCssVars: {
      "--bday-bg": "linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)",
      "--bday-card-surface": "rgba(3, 105, 161, 0.12)",
      "--bday-card-border": "rgba(125, 211, 252, 0.45)",
    },
  },
  "independence": {
    id: "independence",
    label: "Independence (Jul)",
    ornament: "stars",
    badge: "🎆",
    headerStyle: "solid",
    headingFont: headingFallback,
    watermarkText: "FREEDOM",
    watermarkOpacity: 0.05,
    accentColor: "#2563eb",
    accentSoftColor: "#f87171",
    accentTextColor: "#0f172a",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #0f172a 0%, #1d4ed8 50%, #ef4444 100%)",
      "--bday-border": "rgba(148, 163, 184, 0.42)",
      "--bday-board-shadow": "0 30px 52px rgba(15, 23, 42, 0.42)",
      "--bday-board-shadow-safe": "0 20px 34px rgba(15, 23, 42, 0.3)",
      "--bday-heading-gradient": "linear-gradient(90deg, #eff6ff 0%, #2563eb 45%, #ef4444 100%)",
      "--bday-heading-color": "#f8fafc",
      "--bday-heading-shadow": "0 12px 26px rgba(15, 23, 42, 0.65)",
      "--bday-subheading-color": "#f8fafc",
      "--bday-card-surface": "rgba(255, 255, 255, 0.8)",
      "--bday-card-border": "rgba(37, 99, 235, 0.5)",
      "--bday-card-shadow": "0 20px 36px rgba(30, 64, 175, 0.36)",
      "--bday-card-shadow-safe": "0 12px 22px rgba(30, 64, 175, 0.25)",
      "--bday-namebar-bg": "linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(30, 64, 175, 0.85) 100%)",
      "--bday-namebar-text-color": "#f8fafc",
      "--bday-namebar-text-shadow": "0 3px 8px rgba(15, 23, 42, 0.88)",
      "--bday-badge-bg": "rgba(37, 99, 235, 0.9)",
      "--bday-badge-color": "#f8fafc",
      "--bday-watermark-color": "rgba(37, 99, 235, 0.12)",
      "--bday-accent": "#2563eb",
      "--bday-accent-soft": "rgba(37, 99, 235, 0.35)",
      "--bday-ornament-color": "rgba(248, 113, 113, 0.6)",
      "--bday-foreground": "#e2e8f0",
    },
    exportSafeCssVars: {
      "--bday-bg": "linear-gradient(135deg, #1e3a8a 0%, #ef4444 100%)",
      "--bday-card-surface": "rgba(255, 255, 255, 0.95)",
      "--bday-card-border": "rgba(37, 99, 235, 0.45)",
    },
  },
  "green-harvest": {
    id: "green-harvest",
    label: "Green Harvest (Aug)",
    ornament: "leaves",
    badge: "🌿",
    headerStyle: "gradient",
    headingFont: headingFallback,
    watermarkText: "HARVEST",
    watermarkOpacity: 0.05,
    accentColor: "#22c55e",
    accentSoftColor: "#bbf7d0",
    accentTextColor: "#022c22",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #ecfccb 0%, #4ade80 45%, #166534 100%)",
      "--bday-border": "rgba(74, 222, 128, 0.48)",
      "--bday-board-shadow": "0 26px 48px rgba(22, 101, 52, 0.4)",
      "--bday-board-shadow-safe": "0 18px 30px rgba(22, 101, 52, 0.28)",
      "--bday-heading-gradient": "linear-gradient(90deg, #bbf7d0 0%, #4ade80 50%, #15803d 100%)",
      "--bday-heading-color": "#15803d",
      "--bday-heading-shadow": "0 10px 22px rgba(2, 44, 34, 0.5)",
      "--bday-subheading-color": "#052e16",
      "--bday-card-surface": "rgba(255, 255, 255, 0.78)",
      "--bday-card-border": "rgba(134, 239, 172, 0.55)",
      "--bday-card-shadow": "0 18px 32px rgba(22, 101, 52, 0.32)",
      "--bday-card-shadow-safe": "0 12px 20px rgba(22, 101, 52, 0.22)",
      "--bday-namebar-bg": "linear-gradient(180deg, rgba(21, 128, 61, 0) 0%, rgba(21, 128, 61, 0.86) 100%)",
      "--bday-namebar-text-color": "#ecfccb",
      "--bday-namebar-text-shadow": "0 3px 7px rgba(2, 44, 34, 0.8)",
      "--bday-badge-bg": "rgba(34, 197, 94, 0.92)",
      "--bday-badge-color": "#022c22",
      "--bday-watermark-color": "rgba(34, 197, 94, 0.12)",
      "--bday-accent": "#22c55e",
      "--bday-accent-soft": "rgba(34, 197, 94, 0.35)",
      "--bday-ornament-color": "rgba(74, 222, 128, 0.6)",
      "--bday-foreground": "#052e16",
    },
    exportSafeCssVars: {
      "--bday-bg": "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
      "--bday-card-surface": "rgba(255, 255, 255, 0.95)",
      "--bday-card-border": "rgba(134, 239, 172, 0.45)",
    },
  },
  "emerald": {
    id: "emerald",
    label: "Emerald Classic (Sep)",
    ornament: "stars",
    badge: "💎",
    headerStyle: "solid",
    headingFont: headingFallback,
    watermarkText: "EMERALD",
    watermarkOpacity: 0.045,
    accentColor: "#047857",
    accentSoftColor: "#bbf7d0",
    accentTextColor: "#022c22",
    exportSafeDefaults: true,
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #0f172a 0%, #14532d 45%, #059669 100%)",
      "--bday-border": "rgba(34, 197, 94, 0.45)",
      "--bday-board-shadow": "0 30px 52px rgba(4, 78, 53, 0.45)",
      "--bday-board-shadow-safe": "0 18px 28px rgba(4, 78, 53, 0.32)",
      "--bday-heading-gradient": "linear-gradient(90deg, #bbf7d0 0%, #34d399 45%, #047857 100%)",
      "--bday-heading-color": "#bbf7d0",
      "--bday-heading-shadow": "0 12px 28px rgba(4, 47, 46, 0.6)",
      "--bday-subheading-color": "#bbf7d0",
      "--bday-card-surface": "rgba(4, 120, 87, 0.28)",
      "--bday-card-border": "rgba(52, 211, 153, 0.55)",
      "--bday-card-shadow": "0 22px 42px rgba(4, 78, 53, 0.45)",
      "--bday-card-shadow-safe": "0 14px 26px rgba(4, 78, 53, 0.3)",
      "--bday-namebar-bg": "linear-gradient(180deg, rgba(4, 120, 87, 0) 0%, rgba(6, 95, 70, 0.88) 100%)",
      "--bday-namebar-text-color": "#ecfdf5",
      "--bday-namebar-text-shadow": "0 3px 8px rgba(2, 44, 34, 0.85)",
      "--bday-badge-bg": "rgba(6, 95, 70, 0.9)",
      "--bday-badge-color": "#d1fae5",
      "--bday-watermark-color": "rgba(52, 211, 153, 0.1)",
      "--bday-accent": "#047857",
      "--bday-accent-soft": "rgba(16, 185, 129, 0.35)",
      "--bday-ornament-color": "rgba(16, 185, 129, 0.6)",
      "--bday-foreground": "#d1fae5",
    },
    exportSafeCssVars: {
      "--bday-bg": "linear-gradient(135deg, #064e3b 0%, #047857 60%)",
      "--bday-card-surface": "rgba(4, 78, 53, 0.12)",
      "--bday-card-border": "rgba(74, 222, 128, 0.45)",
    },
  },
  "halloween": {
    id: "halloween",
    label: "Halloween Night (Oct)",
    ornament: "bats",
    badge: "🎃",
    headerStyle: "gradient",
    headingFont: headingFallback,
    watermarkText: "HALLOWEEN",
    watermarkOpacity: 0.055,
    accentColor: "#f97316",
    accentSoftColor: "#facc15",
    accentTextColor: "#1c1917",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #111827 0%, #1f2937 48%, #6d28d9 100%)",
      "--bday-border": "rgba(168, 85, 247, 0.45)",
      "--bday-board-shadow": "0 32px 56px rgba(67, 20, 87, 0.5)",
      "--bday-board-shadow-safe": "0 20px 32px rgba(67, 20, 87, 0.3)",
      "--bday-heading-gradient": "linear-gradient(90deg, #f97316 0%, #facc15 35%, #a855f7 100%)",
      "--bday-heading-color": "#f97316",
      "--bday-heading-shadow": "0 12px 28px rgba(35, 16, 63, 0.6)",
      "--bday-subheading-color": "#fbbf24",
      "--bday-card-surface": "rgba(31, 41, 55, 0.65)",
      "--bday-card-border": "rgba(59, 7, 100, 0.52)",
      "--bday-card-shadow": "0 24px 44px rgba(35, 16, 63, 0.45)",
      "--bday-card-shadow-safe": "0 16px 26px rgba(35, 16, 63, 0.32)",
      "--bday-namebar-bg": "linear-gradient(180deg, rgba(17, 24, 39, 0) 0%, rgba(55, 30, 90, 0.9) 100%)",
      "--bday-namebar-text-color": "#f3f4f6",
      "--bday-namebar-text-shadow": "0 3px 8px rgba(15, 23, 42, 0.9)",
      "--bday-badge-bg": "rgba(249, 115, 22, 0.9)",
      "--bday-badge-color": "#1f2937",
      "--bday-watermark-color": "rgba(249, 115, 22, 0.12)",
      "--bday-accent": "#f97316",
      "--bday-accent-soft": "rgba(249, 115, 22, 0.3)",
      "--bday-ornament-color": "rgba(168, 85, 247, 0.55)",
      "--bday-foreground": "#e5e7eb",
    },
    exportSafeCssVars: {
      "--bday-bg": "linear-gradient(135deg, #312e81 0%, #7c3aed 100%)",
      "--bday-card-surface": "rgba(55, 30, 90, 0.16)",
      "--bday-card-border": "rgba(167, 139, 250, 0.45)",
    },
  },
  "november-fall": {
    id: "november-fall",
    label: "All Saints Warmth (Nov)",
    ornament: "leaves",
    badge: "🍂",
    headerStyle: "gradient",
    headingFont: headingFallback,
    watermarkText: "GRATITUDE",
    watermarkOpacity: 0.05,
    accentColor: "#f59e0b",
    accentSoftColor: "#fed7aa",
    accentTextColor: "#7c2d12",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #78350f 0%, #ea580c 50%, #facc15 100%)",
      "--bday-border": "rgba(245, 158, 11, 0.5)",
      "--bday-board-shadow": "0 30px 54px rgba(120, 53, 15, 0.48)",
      "--bday-board-shadow-safe": "0 18px 32px rgba(120, 53, 15, 0.32)",
      "--bday-heading-gradient": "linear-gradient(90deg, #fed7aa 0%, #f97316 45%, #facc15 100%)",
      "--bday-heading-color": "#fef3c7",
      "--bday-heading-shadow": "0 12px 26px rgba(120, 53, 15, 0.6)",
      "--bday-subheading-color": "#fef3c7",
      "--bday-card-surface": "rgba(254, 243, 199, 0.72)",
      "--bday-card-border": "rgba(249, 115, 22, 0.52)",
      "--bday-card-shadow": "0 22px 40px rgba(120, 53, 15, 0.36)",
      "--bday-card-shadow-safe": "0 14px 24px rgba(120, 53, 15, 0.24)",
      "--bday-namebar-bg": "linear-gradient(180deg, rgba(120, 53, 15, 0) 0%, rgba(124, 45, 18, 0.86) 100%)",
      "--bday-namebar-text-color": "#fef3c7",
      "--bday-namebar-text-shadow": "0 3px 7px rgba(67, 20, 7, 0.8)",
      "--bday-badge-bg": "rgba(249, 115, 22, 0.92)",
      "--bday-badge-color": "#451a03",
      "--bday-watermark-color": "rgba(245, 158, 11, 0.12)",
      "--bday-accent": "#f59e0b",
      "--bday-accent-soft": "rgba(245, 158, 11, 0.35)",
      "--bday-ornament-color": "rgba(251, 191, 36, 0.6)",
      "--bday-foreground": "#fef3c7",
    },
    exportSafeCssVars: {
      "--bday-bg": "linear-gradient(135deg, #f97316 0%, #fed7aa 100%)",
      "--bday-card-surface": "rgba(255, 247, 237, 0.94)",
      "--bday-card-border": "rgba(248, 153, 34, 0.45)",
    },
  },
  "holidays": {
    id: "holidays",
    label: "Holiday Ribbon (Dec)",
    ornament: "snow",
    badge: "❄️",
    headerStyle: "gradient",
    headingFont: headingFallback,
    watermarkText: "JOY",
    watermarkOpacity: 0.055,
    accentColor: "#16a34a",
    accentSoftColor: "#f43f5e",
    accentTextColor: "#022c22",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #052e16 0%, #14532d 45%, #991b1b 100%)",
      "--bday-border": "rgba(248, 250, 252, 0.45)",
      "--bday-board-shadow": "0 32px 60px rgba(15, 46, 32, 0.48)",
      "--bday-board-shadow-safe": "0 20px 36px rgba(15, 46, 32, 0.32)",
      "--bday-heading-gradient": "linear-gradient(90deg, #bbf7d0 0%, #16a34a 40%, #f43f5e 100%)",
      "--bday-heading-color": "#bbf7d0",
      "--bday-heading-shadow": "0 12px 28px rgba(15, 46, 32, 0.6)",
      "--bday-subheading-color": "#fef2f2",
      "--bday-card-surface": "rgba(15, 46, 32, 0.4)",
      "--bday-card-border": "rgba(252, 231, 243, 0.55)",
      "--bday-card-shadow": "0 24px 44px rgba(71, 85, 105, 0.45)",
      "--bday-card-shadow-safe": "0 16px 26px rgba(71, 85, 105, 0.3)",
      "--bday-namebar-bg": "linear-gradient(180deg, rgba(15, 46, 32, 0) 0%, rgba(15, 46, 32, 0.88) 100%)",
      "--bday-namebar-text-color": "#f8fafc",
      "--bday-namebar-text-shadow": "0 3px 8px rgba(2, 44, 34, 0.85)",
      "--bday-badge-bg": "rgba(22, 163, 74, 0.9)",
      "--bday-badge-color": "#fef2f2",
      "--bday-watermark-color": "rgba(59, 130, 246, 0.12)",
      "--bday-accent": "#16a34a",
      "--bday-accent-soft": "rgba(22, 163, 74, 0.3)",
      "--bday-ornament-color": "rgba(243, 244, 246, 0.6)",
      "--bday-foreground": "#f8fafc",
    },
    exportSafeCssVars: {
      "--bday-bg": "linear-gradient(135deg, #166534 0%, #dc2626 100%)",
      "--bday-card-surface": "rgba(15, 46, 32, 0.14)",
      "--bday-card-border": "rgba(226, 232, 240, 0.5)",
    },
  },
};

export const DEFAULT_THEME_ID: BirthdayThemeId = "pastel-spring";

export function getBirthdayTheme(id: BirthdayThemeId): BirthdayTheme {
  return birthdayThemePresets[id] ?? birthdayThemePresets[DEFAULT_THEME_ID];
}

export function isBirthdayThemeId(value: unknown): value is BirthdayThemeId {
  return typeof value === "string" && (BIRTHDAY_THEME_IDS as readonly string[]).includes(value);
}

export function isBirthdayThemeMode(value: unknown): value is BirthdayThemeMode {
  if (typeof value !== "string") return false;
  return value === AUTO_THEME_ID || isBirthdayThemeId(value);
}

export function resolveBirthdayTheme(
  mode: BirthdayThemeMode,
  monthIndex: number
): { id: BirthdayThemeId; theme: BirthdayTheme } {
  const fallbackId = getAutoThemeId(monthIndex);
  if (mode === AUTO_THEME_ID) {
    return { id: fallbackId, theme: getBirthdayTheme(fallbackId) };
  }
  return { id: isBirthdayThemeId(mode) ? mode : fallbackId, theme: getBirthdayTheme(isBirthdayThemeId(mode) ? mode : fallbackId) };
}

export const birthdayThemeOptions: Array<{ id: BirthdayThemeMode; label: string }> = [
  { id: AUTO_THEME_ID, label: "Auto (by month)" },
  ...BIRTHDAY_THEME_IDS.map((id) => ({ id, label: birthdayThemePresets[id].label })),
];

export function getAutoThemeId(monthIndex: number): BirthdayThemeId {
  const month = ((monthIndex % 12) + 12) % 12;
  switch (month) {
    case 0:
      return "newyear";
    case 1:
      return "hearts";
    case 2:
      return "womens-month";
    case 3:
      return "pastel-spring";
    case 4:
      return "fiesta";
    case 5:
      return "rainy-season";
    case 6:
      return "independence";
    case 7:
      return "green-harvest";
    case 8:
      return "emerald";
    case 9:
      return "halloween";
    case 10:
      return "november-fall";
    case 11:
    default:
      return "holidays";
  }
}

export function createThemeStyle(theme: BirthdayTheme, exportSafe: boolean): CSSProperties {
  const vars: CSSProperties = {
    ...theme.cssVars,
    ...(exportSafe ? theme.exportSafeCssVars ?? {} : {}),
  } as CSSProperties;
  return vars;
}

export const birthdayThemePresetsList = birthdayThemePresets;

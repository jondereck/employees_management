export type OrnamentType =
  | "none"
  | "confetti"
  | "snow"
  | "stars"
  | "leaves"
  | "bats"
  | "bunting"
  | "raindrops";

type HeaderStyle = "gradient" | "solid";

export type BirthdayTheme = {
  id: BirthdayThemeId;
  label: string;
  description?: string;
  cssVars: Record<string, string>;
  ornament: OrnamentType;
  headerStyle: HeaderStyle;
  exportSafeDefaults?: boolean;
  fontFamily?: string;
};

export const birthdayThemes = {
  "newyear-sparkle": {
    id: "newyear-sparkle",
    label: "New Year Sparkle",
    description: "Deep navy gradient with gold accents and star sprinkles.",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #050b2b 0%, #0f1b4c 55%, #0a1024 100%)",
      "--bday-bg-safe": "linear-gradient(135deg, #101c3f 0%, #17285b 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 18% 20%, rgba(59, 130, 246, 0.35) 0 18%, transparent 62%)",
        "radial-gradient(circle at 82% 26%, rgba(250, 204, 21, 0.32) 0 16%, transparent 65%)",
        "radial-gradient(circle at 48% 82%, rgba(124, 58, 237, 0.28) 0 20%, transparent 68%)",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 20% 24%, rgba(96, 165, 250, 0.18) 0 24%, transparent 70%)",
        "radial-gradient(circle at 78% 30%, rgba(250, 204, 21, 0.2) 0 18%, transparent 70%)",
      ].join(","),
      "--bday-accent": "#facc15",
      "--bday-accent-2": "#f97316",
      "--bday-ornament-color": "rgba(250, 204, 21, 0.25)",
      "--bday-ornament-alt": "rgba(56, 189, 248, 0.25)",
      "--bday-header-gradient": "linear-gradient(90deg, #facc15 0%, #fde68a 45%, #f97316 100%)",
      "--bday-header-solid": "#fde68a",
      "--bday-card-bg": "rgba(10, 17, 45, 0.65)",
      "--bday-card-border": "rgba(250, 204, 21, 0.35)",
      "--bday-watermark-color": "rgba(250, 204, 21, 0.05)",
    },
    ornament: "stars",
    headerStyle: "gradient",
    fontFamily: '\"Playfair Display\", "Times New Roman", serif',
  },
  hearts: {
    id: "hearts",
    label: "Rose Hearts",
    description: "Romantic rose gradient with soft heart confetti.",
    cssVars: {
      "--bday-bg": "linear-gradient(140deg, #f472b6 0%, #ec4899 50%, #be123c 100%)",
      "--bday-bg-safe": "linear-gradient(140deg, #f472b6 0%, #f43f5e 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 16% 24%, rgba(255, 228, 230, 0.4) 0 22%, transparent 64%)",
        "radial-gradient(circle at 80% 18%, rgba(244, 114, 182, 0.3) 0 20%, transparent 68%)",
        "radial-gradient(circle at 50% 88%, rgba(244, 63, 94, 0.25) 0 24%, transparent 70%)",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 18% 30%, rgba(255, 228, 230, 0.28) 0 26%, transparent 70%)",
        "radial-gradient(circle at 74% 26%, rgba(244, 114, 182, 0.18) 0 22%, transparent 74%)",
      ].join(","),
      "--bday-accent": "#fff1f2",
      "--bday-accent-2": "#fb7185",
      "--bday-ornament-color": "rgba(255, 241, 242, 0.25)",
      "--bday-ornament-alt": "rgba(244, 114, 182, 0.18)",
      "--bday-header-gradient": "linear-gradient(90deg, #fff1f2 0%, #fbcfe8 45%, #f43f5e 100%)",
      "--bday-header-solid": "#fff1f2",
      "--bday-card-bg": "rgba(255, 255, 255, 0.78)",
      "--bday-card-border": "rgba(244, 114, 182, 0.45)",
      "--bday-watermark-color": "rgba(190, 18, 60, 0.06)",
    },
    ornament: "confetti",
    headerStyle: "gradient",
    fontFamily: '\"Great Vibes\", "Segoe Script", cursive',
  },
  "orchid-ribbon": {
    id: "orchid-ribbon",
    label: "Orchid Ribbon",
    description: "Women’s Month purple orchid gradient with ribbon glow.",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #c084fc 100%)",
      "--bday-bg-safe": "linear-gradient(135deg, #6d28d9 0%, #a855f7 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 18% 30%, rgba(192, 132, 252, 0.38) 0 22%, transparent 68%)",
        "radial-gradient(circle at 78% 20%, rgba(236, 233, 254, 0.28) 0 18%, transparent 70%)",
        "radial-gradient(circle at 54% 82%, rgba(244, 114, 182, 0.22) 0 26%, transparent 72%)",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 20% 34%, rgba(224, 222, 255, 0.22) 0 26%, transparent 74%)",
        "radial-gradient(circle at 74% 26%, rgba(192, 132, 252, 0.22) 0 24%, transparent 76%)",
      ].join(","),
      "--bday-accent": "#f5d0fe",
      "--bday-accent-2": "#c084fc",
      "--bday-ornament-color": "rgba(245, 208, 254, 0.22)",
      "--bday-ornament-alt": "rgba(167, 139, 250, 0.24)",
      "--bday-header-gradient": "linear-gradient(90deg, #ede9fe 0%, #f5d0fe 50%, #f472b6 100%)",
      "--bday-header-solid": "#ede9fe",
      "--bday-card-bg": "rgba(29, 10, 66, 0.65)",
      "--bday-card-border": "rgba(236, 233, 254, 0.45)",
      "--bday-watermark-color": "rgba(167, 139, 250, 0.05)",
    },
    ornament: "stars",
    headerStyle: "gradient",
    fontFamily: '\"Montserrat\", "Helvetica Neue", sans-serif',
  },
  "pastel-spring": {
    id: "pastel-spring",
    label: "Pastel Spring",
    description: "Mint and sky pastel gradient with floating petals.",
    cssVars: {
      "--bday-bg": "linear-gradient(120deg, #d1fae5 0%, #a5f3fc 40%, #bfdbfe 100%)",
      "--bday-bg-safe": "linear-gradient(120deg, #a7f3d0 0%, #bfdbfe 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 20% 28%, rgba(59, 130, 246, 0.26) 0 26%, transparent 68%)",
        "radial-gradient(circle at 78% 24%, rgba(16, 185, 129, 0.24) 0 24%, transparent 70%)",
        "radial-gradient(circle at 48% 86%, rgba(14, 165, 233, 0.22) 0 30%, transparent 72%)",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 24% 34%, rgba(125, 211, 252, 0.18) 0 32%, transparent 74%)",
        "radial-gradient(circle at 70% 30%, rgba(52, 211, 153, 0.18) 0 28%, transparent 76%)",
      ].join(","),
      "--bday-accent": "#047857",
      "--bday-accent-2": "#0891b2",
      "--bday-ornament-color": "rgba(59, 130, 246, 0.2)",
      "--bday-ornament-alt": "rgba(16, 185, 129, 0.18)",
      "--bday-header-gradient": "linear-gradient(90deg, #0f766e 0%, #10b981 45%, #0ea5e9 100%)",
      "--bday-header-solid": "#047857",
      "--bday-card-bg": "rgba(255, 255, 255, 0.85)",
      "--bday-card-border": "rgba(14, 165, 233, 0.35)",
      "--bday-watermark-color": "rgba(14, 165, 233, 0.05)",
    },
    ornament: "leaves",
    headerStyle: "gradient",
    fontFamily: '\"Poppins\", "Gill Sans", sans-serif',
  },
  fiesta: {
    id: "fiesta",
    label: "Fiesta",
    description: "Vibrant teal and coral with bunting across the top.",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #0f766e 0%, #0ea5e9 50%, #fb7185 100%)",
      "--bday-bg-safe": "linear-gradient(135deg, #0f766e 0%, #f97316 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 18% 26%, rgba(34, 211, 238, 0.32) 0 22%, transparent 64%)",
        "radial-gradient(circle at 76% 20%, rgba(250, 204, 21, 0.3) 0 20%, transparent 66%)",
        "linear-gradient(120deg, rgba(15, 118, 110, 0.16), rgba(15, 118, 110, 0) 45%, rgba(251, 113, 133, 0.22))",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 20% 32%, rgba(125, 211, 252, 0.18) 0 26%, transparent 72%)",
        "radial-gradient(circle at 72% 28%, rgba(253, 224, 71, 0.2) 0 22%, transparent 74%)",
      ].join(","),
      "--bday-accent": "#facc15",
      "--bday-accent-2": "#fb7185",
      "--bday-ornament-color": "rgba(250, 204, 21, 0.2)",
      "--bday-ornament-alt": "rgba(14, 197, 212, 0.2)",
      "--bday-header-gradient": "linear-gradient(90deg, #f97316 0%, #facc15 40%, #22d3ee 100%)",
      "--bday-header-solid": "#facc15",
      "--bday-card-bg": "rgba(15, 118, 110, 0.4)",
      "--bday-card-border": "rgba(250, 204, 21, 0.45)",
      "--bday-watermark-color": "rgba(251, 113, 133, 0.05)",
    },
    ornament: "bunting",
    headerStyle: "gradient",
    fontFamily: '\"Fredoka\", "Trebuchet MS", sans-serif',
  },
  "rainy-season": {
    id: "rainy-season",
    label: "Rainy Season",
    description: "Cool blue gradient with raindrop overlay.",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #0f172a 0%, #1d4ed8 45%, #38bdf8 100%)",
      "--bday-bg-safe": "linear-gradient(135deg, #1e3a8a 0%, #38bdf8 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 20% 24%, rgba(37, 99, 235, 0.32) 0 24%, transparent 68%)",
        "radial-gradient(circle at 76% 18%, rgba(56, 189, 248, 0.3) 0 22%, transparent 70%)",
        "linear-gradient(160deg, rgba(30, 64, 175, 0.22), transparent 55%, rgba(56, 189, 248, 0.18))",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 24% 30%, rgba(96, 165, 250, 0.2) 0 30%, transparent 74%)",
        "radial-gradient(circle at 70% 26%, rgba(56, 189, 248, 0.18) 0 26%, transparent 76%)",
      ].join(","),
      "--bday-accent": "#bae6fd",
      "--bday-accent-2": "#38bdf8",
      "--bday-ornament-color": "rgba(59, 130, 246, 0.25)",
      "--bday-ornament-alt": "rgba(14, 165, 233, 0.2)",
      "--bday-header-gradient": "linear-gradient(90deg, #bae6fd 0%, #60a5fa 55%, #2563eb 100%)",
      "--bday-header-solid": "#bae6fd",
      "--bday-card-bg": "rgba(15, 23, 42, 0.6)",
      "--bday-card-border": "rgba(14, 165, 233, 0.4)",
      "--bday-watermark-color": "rgba(190, 227, 248, 0.05)",
    },
    ornament: "raindrops",
    headerStyle: "gradient",
    fontFamily: '\"Raleway\", "Helvetica Neue", sans-serif',
  },
  independence: {
    id: "independence",
    label: "Independence",
    description: "Navy, white, and red accents with stripe motif.",
    cssVars: {
      "--bday-bg": "linear-gradient(130deg, #0f172a 0%, #1e293b 35%, #334155 70%, #0f172a 100%)",
      "--bday-bg-safe": "linear-gradient(130deg, #0f172a 0%, #1e293b 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 18% 28%, rgba(59, 130, 246, 0.3) 0 20%, transparent 66%)",
        "radial-gradient(circle at 78% 22%, rgba(239, 68, 68, 0.28) 0 18%, transparent 68%)",
        "repeating-linear-gradient(135deg, rgba(248, 250, 252, 0.16) 0 14px, transparent 14px 28px)",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 20% 32%, rgba(148, 163, 184, 0.22) 0 24%, transparent 72%)",
        "radial-gradient(circle at 72% 28%, rgba(96, 165, 250, 0.18) 0 22%, transparent 74%)",
      ].join(","),
      "--bday-accent": "#f97316",
      "--bday-accent-2": "#ef4444",
      "--bday-ornament-color": "rgba(248, 250, 252, 0.22)",
      "--bday-ornament-alt": "rgba(37, 99, 235, 0.25)",
      "--bday-header-gradient": "linear-gradient(90deg, #f8fafc 0%, #38bdf8 45%, #ef4444 100%)",
      "--bday-header-solid": "#f8fafc",
      "--bday-card-bg": "rgba(15, 23, 42, 0.65)",
      "--bday-card-border": "rgba(248, 250, 252, 0.35)",
      "--bday-watermark-color": "rgba(255, 255, 255, 0.05)",
    },
    ornament: "stars",
    headerStyle: "solid",
    fontFamily: '\"Oswald\", "Arial Narrow", sans-serif',
  },
  "green-harvest": {
    id: "green-harvest",
    label: "Green Harvest",
    description: "Fresh green gradient with leaf confetti.",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #14532d 0%, #15803d 45%, #4ade80 100%)",
      "--bday-bg-safe": "linear-gradient(135deg, #166534 0%, #4ade80 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 18% 26%, rgba(34, 197, 94, 0.32) 0 22%, transparent 66%)",
        "radial-gradient(circle at 76% 20%, rgba(253, 224, 71, 0.28) 0 20%, transparent 68%)",
        "linear-gradient(150deg, rgba(21, 128, 61, 0.22), transparent 55%, rgba(74, 222, 128, 0.18))",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 22% 32%, rgba(74, 222, 128, 0.2) 0 26%, transparent 72%)",
        "radial-gradient(circle at 72% 28%, rgba(190, 242, 100, 0.18) 0 24%, transparent 74%)",
      ].join(","),
      "--bday-accent": "#fef9c3",
      "--bday-accent-2": "#22c55e",
      "--bday-ornament-color": "rgba(74, 222, 128, 0.22)",
      "--bday-ornament-alt": "rgba(253, 224, 71, 0.18)",
      "--bday-header-gradient": "linear-gradient(90deg, #facc15 0%, #bef264 50%, #22c55e 100%)",
      "--bday-header-solid": "#facc15",
      "--bday-card-bg": "rgba(15, 118, 110, 0.4)",
      "--bday-card-border": "rgba(253, 224, 71, 0.35)",
      "--bday-watermark-color": "rgba(74, 222, 128, 0.05)",
    },
    ornament: "leaves",
    headerStyle: "gradient",
    fontFamily: '\"Nunito\", "Helvetica", sans-serif',
  },
  emerald: {
    id: "emerald",
    label: "Emerald",
    description: "Jewel tone emerald gradient with minimal sparkle.",
    cssVars: {
      "--bday-bg": "linear-gradient(140deg, #022c22 0%, #064e3b 50%, #047857 100%)",
      "--bday-bg-safe": "linear-gradient(140deg, #064e3b 0%, #0f766e 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 18% 28%, rgba(16, 185, 129, 0.32) 0 20%, transparent 66%)",
        "radial-gradient(circle at 76% 20%, rgba(45, 212, 191, 0.26) 0 22%, transparent 68%)",
        "radial-gradient(circle at 50% 88%, rgba(4, 120, 87, 0.28) 0 24%, transparent 72%)",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 22% 34%, rgba(110, 231, 183, 0.18) 0 26%, transparent 74%)",
        "radial-gradient(circle at 70% 28%, rgba(52, 211, 153, 0.18) 0 24%, transparent 76%)",
      ].join(","),
      "--bday-accent": "#a7f3d0",
      "--bday-accent-2": "#34d399",
      "--bday-ornament-color": "rgba(167, 243, 208, 0.24)",
      "--bday-ornament-alt": "rgba(52, 211, 153, 0.2)",
      "--bday-header-gradient": "linear-gradient(90deg, #a7f3d0 0%, #6ee7b7 45%, #34d399 100%)",
      "--bday-header-solid": "#a7f3d0",
      "--bday-card-bg": "rgba(4, 78, 59, 0.55)",
      "--bday-card-border": "rgba(16, 185, 129, 0.32)",
      "--bday-watermark-color": "rgba(167, 243, 208, 0.05)",
    },
    ornament: "stars",
    headerStyle: "solid",
    fontFamily: '\"Cinzel\", "Garamond", serif',
  },
  halloween: {
    id: "halloween",
    label: "Midnight Halloween",
    description: "Charcoal to violet gradient with tiny bats and stars.",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #0f172a 0%, #312e81 50%, #581c87 100%)",
      "--bday-bg-safe": "linear-gradient(135deg, #1f2937 0%, #4c1d95 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 18% 28%, rgba(147, 51, 234, 0.32) 0 22%, transparent 66%)",
        "radial-gradient(circle at 78% 22%, rgba(249, 115, 22, 0.3) 0 20%, transparent 68%)",
        "radial-gradient(circle at 52% 84%, rgba(15, 23, 42, 0.35) 0 26%, transparent 72%)",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 22% 34%, rgba(167, 139, 250, 0.18) 0 28%, transparent 74%)",
        "radial-gradient(circle at 72% 28%, rgba(249, 115, 22, 0.2) 0 24%, transparent 76%)",
      ].join(","),
      "--bday-accent": "#f97316",
      "--bday-accent-2": "#facc15",
      "--bday-ornament-color": "rgba(250, 204, 21, 0.22)",
      "--bday-ornament-alt": "rgba(249, 115, 22, 0.25)",
      "--bday-header-gradient": "linear-gradient(90deg, #f97316 0%, #facc15 50%, #a855f7 100%)",
      "--bday-header-solid": "#f97316",
      "--bday-card-bg": "rgba(17, 24, 39, 0.65)",
      "--bday-card-border": "rgba(249, 115, 22, 0.4)",
      "--bday-watermark-color": "rgba(249, 115, 22, 0.05)",
    },
    ornament: "bats",
    headerStyle: "gradient",
    fontFamily: '\"Bebas Neue\", "Impact", sans-serif',
  },
  "amber-fall": {
    id: "amber-fall",
    label: "Amber Fall",
    description: "Warm amber gradient with falling leaves.",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #78350f 0%, #b45309 45%, #f59e0b 100%)",
      "--bday-bg-safe": "linear-gradient(135deg, #92400e 0%, #f59e0b 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 20% 28%, rgba(251, 191, 36, 0.32) 0 22%, transparent 66%)",
        "radial-gradient(circle at 78% 22%, rgba(249, 115, 22, 0.3) 0 20%, transparent 68%)",
        "linear-gradient(150deg, rgba(120, 53, 15, 0.25), transparent 55%, rgba(234, 179, 8, 0.22))",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 24% 34%, rgba(253, 230, 138, 0.2) 0 28%, transparent 74%)",
        "radial-gradient(circle at 70% 30%, rgba(249, 115, 22, 0.18) 0 24%, transparent 76%)",
      ].join(","),
      "--bday-accent": "#fef3c7",
      "--bday-accent-2": "#fbbf24",
      "--bday-ornament-color": "rgba(251, 191, 36, 0.22)",
      "--bday-ornament-alt": "rgba(249, 115, 22, 0.2)",
      "--bday-header-gradient": "linear-gradient(90deg, #fde68a 0%, #fbbf24 50%, #f97316 100%)",
      "--bday-header-solid": "#fde68a",
      "--bday-card-bg": "rgba(120, 53, 15, 0.55)",
      "--bday-card-border": "rgba(251, 191, 36, 0.35)",
      "--bday-watermark-color": "rgba(251, 191, 36, 0.05)",
    },
    ornament: "leaves",
    headerStyle: "gradient",
    fontFamily: '\"Merriweather\", "Georgia", serif',
  },
  "all-saints": {
    id: "all-saints",
    label: "All Saints Minimal",
    description: "Quiet pearl gradient with minimal ornaments.",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 50%, #f8fafc 100%)",
      "--bday-bg-safe": "linear-gradient(135deg, #f3f4f6 0%, #f8fafc 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 20% 26%, rgba(148, 163, 184, 0.18) 0 26%, transparent 72%)",
        "radial-gradient(circle at 76% 24%, rgba(209, 213, 219, 0.16) 0 24%, transparent 74%)",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 22% 32%, rgba(203, 213, 225, 0.12) 0 30%, transparent 76%)",
      ].join(","),
      "--bday-accent": "#1f2937",
      "--bday-accent-2": "#4b5563",
      "--bday-ornament-color": "rgba(55, 65, 81, 0.08)",
      "--bday-ornament-alt": "rgba(148, 163, 184, 0.08)",
      "--bday-header-gradient": "linear-gradient(90deg, #1f2937 0%, #4b5563 50%, #9ca3af 100%)",
      "--bday-header-solid": "#1f2937",
      "--bday-card-bg": "rgba(255, 255, 255, 0.92)",
      "--bday-card-border": "rgba(148, 163, 184, 0.35)",
      "--bday-watermark-color": "rgba(71, 85, 105, 0.04)",
    },
    ornament: "none",
    headerStyle: "solid",
    fontFamily: '\"Libre Baskerville\", "Georgia", serif',
    exportSafeDefaults: true,
  },
  holidays: {
    id: "holidays",
    label: "Holiday Ribbon",
    description: "Pine and cranberry gradient with snowflakes and ribbon glow.",
    cssVars: {
      "--bday-bg": "linear-gradient(135deg, #064e3b 0%, #065f46 40%, #991b1b 100%)",
      "--bday-bg-safe": "linear-gradient(135deg, #047857 0%, #9f1239 100%)",
      "--bday-backdrop": [
        "radial-gradient(circle at 18% 28%, rgba(16, 185, 129, 0.32) 0 22%, transparent 66%)",
        "radial-gradient(circle at 78% 22%, rgba(248, 113, 113, 0.3) 0 20%, transparent 68%)",
        "radial-gradient(circle at 48% 86%, rgba(15, 118, 110, 0.28) 0 24%, transparent 72%)",
      ].join(","),
      "--bday-backdrop-safe": [
        "radial-gradient(circle at 22% 34%, rgba(74, 222, 128, 0.18) 0 28%, transparent 74%)",
        "radial-gradient(circle at 72% 30%, rgba(248, 113, 113, 0.2) 0 24%, transparent 76%)",
      ].join(","),
      "--bday-accent": "#fef9c3",
      "--bday-accent-2": "#f87171",
      "--bday-ornament-color": "rgba(248, 250, 252, 0.24)",
      "--bday-ornament-alt": "rgba(248, 113, 113, 0.22)",
      "--bday-header-gradient": "linear-gradient(90deg, #fef9c3 0%, #fde68a 45%, #f87171 100%)",
      "--bday-header-solid": "#fef9c3",
      "--bday-card-bg": "rgba(15, 118, 110, 0.45)",
      "--bday-card-border": "rgba(248, 113, 113, 0.38)",
      "--bday-watermark-color": "rgba(248, 113, 113, 0.05)",
    },
    ornament: "snow",
    headerStyle: "gradient",
    fontFamily: '\"Quicksand\", "Helvetica", sans-serif',
  },
} as const;

export type BirthdayThemeId = keyof typeof birthdayThemes;

const monthMap: BirthdayThemeId[] = [
  "newyear-sparkle",
  "hearts",
  "orchid-ribbon",
  "pastel-spring",
  "fiesta",
  "rainy-season",
  "independence",
  "green-harvest",
  "emerald",
  "halloween",
  "amber-fall",
  "holidays",
];

export function getAutoTheme(monthIndex: number): BirthdayThemeId {
  const safeIndex = Number.isFinite(monthIndex) ? Math.max(0, Math.min(11, monthIndex)) : 0;
  return monthMap[safeIndex] ?? "newyear-sparkle";
}

export const birthdayThemeOrder: Array<"auto" | BirthdayThemeId> = [
  "auto",
  "newyear-sparkle",
  "hearts",
  "orchid-ribbon",
  "pastel-spring",
  "fiesta",
  "rainy-season",
  "independence",
  "green-harvest",
  "emerald",
  "halloween",
  "amber-fall",
  "all-saints",
  "holidays",
];

export type BirthdayThemeMode = "auto" | BirthdayThemeId;

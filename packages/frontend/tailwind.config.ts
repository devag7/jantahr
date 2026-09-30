import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        divider: "hsl(var(--divider))",
        "on-dark-muted": "hsl(var(--on-dark-muted))",
        "primary-on-dark": "hsl(var(--primary-on-dark))", /* Sky Link Blue: links and outlines on dark tiles only */ /* body-muted: secondary copy on dark tiles */
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        info: { DEFAULT: "hsl(var(--info))", foreground: "hsl(var(--info-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        nav: { DEFAULT: "hsl(var(--nav))", foreground: "hsl(var(--nav-foreground))" },
        tile: { 1: "#272729", 2: "#2a2a2c", 3: "#252527" },
        attendance: {
          present: "hsl(var(--color-attendance-present))", absent: "hsl(var(--color-attendance-absent))", half: "hsl(var(--color-attendance-half))",
          leave: "hsl(var(--color-attendance-leave))", off: "hsl(var(--color-attendance-off))",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Text"', '"SF Pro Display"', "var(--font-inter)", "system-ui", "sans-serif"],
      },
      /* Type ladder from the reference: [size, { lineHeight, letterSpacing }] */
      fontSize: {
        /* apple-DESIGN.md typography, value for value (names shortened) */
        hero: ["56px", { lineHeight: "1.07", letterSpacing: "-0.28px" }],        // hero-display
        display: ["40px", { lineHeight: "1.1", letterSpacing: "0" }],            // display-lg
        title: ["34px", { lineHeight: "1.47", letterSpacing: "-0.374px" }],      // display-md
        lead: ["28px", { lineHeight: "1.14", letterSpacing: "0.196px" }],
        /* phone steps from the reference's responsive table: 56 → 40 → 28 */
        "display-sm": ["28px", { lineHeight: "1.14", letterSpacing: "-0.28px" }],
        "lead-airy": ["24px", { lineHeight: "1.5", letterSpacing: "0" }],       // weight 300
        tagline: ["21px", { lineHeight: "1.19", letterSpacing: "0.231px" }],
        "body-strong": ["17px", { lineHeight: "1.24", letterSpacing: "-0.374px", fontWeight: "600" }],
        body: ["17px", { lineHeight: "1.47", letterSpacing: "-0.374px" }],
        "dense-link": ["17px", { lineHeight: "2.41", letterSpacing: "0" }],
        "button-large": ["18px", { lineHeight: "1", letterSpacing: "0", fontWeight: "300" }],
        caption: ["14px", { lineHeight: "1.43", letterSpacing: "-0.224px" }],
        "caption-strong": ["14px", { lineHeight: "1.29", letterSpacing: "-0.224px", fontWeight: "600" }],
        "button-utility": ["14px", { lineHeight: "1.29", letterSpacing: "-0.224px" }],
        /* fine-print is 12/1.0 in the reference, measured on single-line legal rows; wrapped hints need 1.33 to keep
           descenders clear, so `fine` wraps and `nav-link` is the exact single-line token */
        fine: ["12px", { lineHeight: "1.33", letterSpacing: "-0.12px" }],
        "nav-link": ["12px", { lineHeight: "1", letterSpacing: "-0.12px" }],
        micro: ["10px", { lineHeight: "1.3", letterSpacing: "-0.08px" }],       // micro-legal
      },
      borderRadius: {
        xs: "5px",
        sm: "8px",
        md: "11px",
        lg: "18px",
      },
      boxShadow: {
        /* the only shadow in the system: product imagery resting on a surface */
        product: "3px 5px 30px 0 rgba(0, 0, 0, 0.22)",
      },
      height: { nav: "44px", subnav: "52px" },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
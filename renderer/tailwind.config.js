module.exports = {
  content: {
    relative: true,
    files: ["./index.html", "./src/**/*.{js,jsx}"]
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ["Segoe UI", "Inter", "Arial", "sans-serif"]
      },
      colors: {
        anubis: {
          bg: "#02020a",
          panel: "#100a1e",
          text: "#f6f1ff",
          muted: "rgba(246, 241, 255, 0.72)",
          faint: "rgba(246, 241, 255, 0.45)",
          violet: "#9b6cff",
          bright: "#c4a6ff",
          deep: "#44217d"
        }
      },
      boxShadow: {
        orb: "0 0 30px rgba(155,108,255,.24), 0 0 80px rgba(155,108,255,.18), 0 0 180px rgba(155,108,255,.14)",
        panel: "0 0 0 1px rgba(155,108,255,.04), 0 0 26px rgba(155,108,255,.08)"
      },
      keyframes: {
        cinematicWordIn: {
          "0%": { opacity: "0", transform: "scale(.88)", filter: "blur(10px)" },
          "45%": { opacity: "1", transform: "scale(1.02)", filter: "blur(0)" },
          "100%": { opacity: "1", transform: "scale(1)", filter: "blur(0)" }
        },
        cinematicWordOut: {
          "0%": { opacity: "1", transform: "scale(1)", filter: "blur(0)" },
          "100%": { opacity: "0", transform: "scale(1.05)", filter: "blur(10px)" }
        },
        orbIdle: {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-8px) scale(1.015)" }
        },
        orbThinking: {
          "0%, 100%": { transform: "scale(.985)" },
          "50%": { transform: "scale(1.04)" }
        },
        orbSpeaking: {
          "0%, 100%": { transform: "scale(.99)", filter: "brightness(1)" },
          "35%": { transform: "scale(1.08)", filter: "brightness(1.14)" },
          "70%": { transform: "scale(1.01)", filter: "brightness(1.05)" }
        },
        orbShimmer: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" }
        },
        slowPulse: {
          "0%, 100%": { transform: "scale(.98)", opacity: ".38" },
          "50%": { transform: "scale(1.02)", opacity: ".62" }
        },
        particleFloat: {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "50%": { transform: "translateY(-8px) translateX(4px)" }
        }
      },
      animation: {
        cinematicWordIn: "cinematicWordIn 1200ms ease forwards",
        cinematicWordOut: "cinematicWordOut 700ms ease forwards",
        orbIdle: "orbIdle 5.5s ease-in-out infinite",
        orbThinking: "orbThinking 1.6s ease-in-out infinite",
        orbSpeaking: "orbSpeaking .72s ease-in-out infinite",
        orbShimmer: "orbShimmer 7s linear infinite",
        slowPulse: "slowPulse 6s ease-in-out infinite",
        slowPulseReverse: "slowPulse 4.8s ease-in-out infinite reverse",
        particleFloat: "particleFloat 18s linear infinite",
        particleFloatSlow: "particleFloat 28s linear infinite"
      }
    }
  },
  plugins: []
};

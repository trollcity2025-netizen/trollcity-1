import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        gray: colors.slate,
        neutral: colors.slate,
        zinc: colors.slate,
        stone: colors.slate,
        'troll-neon-blue': 'var(--troll-blue-neon)',
        'troll-neon-pink': 'var(--troll-pink-neon)',
        'troll-neon-purple': 'var(--troll-purple-300)',
        'troll-neon-green': 'var(--troll-green-neon)',
        'troll-neon-gold': 'var(--troll-gold-neon)',
        'troll-neon-orange': 'var(--troll-orange-neon)',
        'troll-neon-red': 'var(--troll-red-neon)',
        'troll-gold': 'var(--troll-gold)',
        'troll-purple': 'var(--troll-purple-600)',
        'troll-purple-dark': 'var(--troll-purple-900)',
        'troll-purple-300': 'var(--troll-purple-300)',
        'troll-green': 'var(--troll-green-neon)',
        'troll-green-dark': 'var(--troll-green-glow)',
        'troll-dark-bg': 'var(--troll-dark-bg)',
        'troll-dark-card': 'var(--troll-dark-card)',
        troll: {
          purple: {
            50: 'var(--troll-purple-950)',
            100: 'var(--troll-purple-900)',
            200: 'var(--troll-purple-800)',
            300: 'var(--troll-purple-300)',
            400: 'var(--troll-blue-neon)',
            500: 'var(--troll-pink-neon)',
            600: 'var(--troll-purple-600)',
            700: 'var(--troll-purple-700)',
            800: 'var(--troll-purple-800)',
            900: 'var(--troll-purple-900)',
            950: 'var(--troll-purple-950)',
          },
          green: {
            50: 'var(--troll-purple-950)',
            100: 'var(--troll-purple-900)',
            200: 'var(--troll-purple-800)',
            300: 'var(--troll-blue-neon)',
            400: 'var(--troll-blue-neon)',
            500: 'var(--troll-blue-neon)',
            600: 'var(--troll-green-glow)',
            700: 'var(--troll-green-glow)',
            800: 'var(--troll-purple-800)',
            900: 'var(--troll-purple-900)',
            950: 'var(--troll-purple-950)',
            neon: 'var(--troll-blue-neon)',
            glow: 'var(--troll-green-glow)',
          },
          gold: {
            50: 'var(--troll-pink-glow)',
            100: 'var(--troll-pink-neon)',
            200: 'var(--troll-pink-neon)',
            300: 'var(--troll-pink-neon)',
            400: 'var(--troll-pink-neon)',
            500: 'var(--troll-gold)',
            600: 'var(--troll-gold)',
            700: 'var(--troll-pink-glow)',
            800: 'var(--troll-pink-glow)',
            900: 'var(--troll-purple-900)',
            950: 'var(--troll-purple-950)',
            bright: 'var(--troll-pink-neon)',
            metallic: 'var(--troll-pink-glow)',
          },
        },
      },
      fontFamily: {
        troll: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-glow': 'bounce 1s infinite, glow 2s ease-in-out infinite alternate',
        'fadeIn': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 255, 65, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 255, 65, 0.8), 0 0 30px rgba(0, 255, 65, 0.6)' },
        },
        fadeIn: {
          from: {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
      boxShadow: {
        'troll-glow': '0 0 15px rgba(42, 168, 255, 0.5), 0 0 30px rgba(255, 58, 200, 0.3)',
        'troll-green': '0 0 15px rgba(42, 168, 255, 0.5), 0 0 30px rgba(42, 168, 255, 0.3)',
        'troll-gold': '0 0 15px rgba(255, 58, 200, 0.5), 0 0 30px rgba(255, 58, 200, 0.3)',
      },
    },
  },
  plugins: [],
};

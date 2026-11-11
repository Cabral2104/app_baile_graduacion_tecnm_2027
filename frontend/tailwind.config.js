/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        display: ['"Cinzel"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      // Paleta "La Noche Estrellada" — Azul Medianoche, Plata Estelar y Oro de Gala
      colors: {
        gala: {
          obsidian: '#040818', // Cielo nocturno profundo
          velvet: '#091330', // Azul estelar para paneles
          surface: '#112250', // Superficies elevadas
          card: '#193170', // Azul galaxia activo / hover
          royal: '#3867E0', // Azul nebulosa brillante
          silver: '#E2E8F0', // Plata estelar principal
          platinum: '#CBD5E1', // Plata satinado
          starlight: '#F8FAFC', // Blanco luz de estrella
          gold: '#E5B85B', // Dorado gala
          champagne: '#F6E2A8', // Dorado champaña claro
          bronze: '#A8802F',
          ivory: '#F8FAFC', // Texto principal claro
          parchment: '#CBD5E1', // Texto secundario plateado
          muted: '#8A9CC2', // Texto atenuado azul-plata
          rose: '#F48CA4', // Alertas suaves
          leaf: '#4FD1A1', // Estados activos
        },
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(229,184,91,0.42)' },
          '50%': { boxShadow: '0 0 0 12px rgba(229,184,91,0)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        marquee: {
          from: { transform: 'translate3d(0, 0, 0)' },
          to: { transform: 'translate3d(-50%, 0, 0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 5s linear infinite',
        float: 'float 5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2.4s ease-out infinite',
        'spin-slow': 'spin-slow 40s linear infinite',
        marquee: 'marquee 22s linear infinite',
      },
    },
  },
  plugins: [],
};

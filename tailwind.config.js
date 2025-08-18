/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      // Mobile-first breakpoints
      'mobile': '640px',
      'tablet': '1024px',
      'desktop': '1280px',
      // Touch-specific breakpoints
      'touch': { 'raw': '(hover: none) and (pointer: coarse)' },
      'no-touch': { 'raw': '(hover: hover) and (pointer: fine)' },
      // Orientation breakpoints
      'portrait': { 'raw': '(orientation: portrait)' },
      'landscape': { 'raw': '(orientation: landscape)' },
      // High-DPI breakpoints
      'retina': { 'raw': '(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)' },
    },
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "2rem",
        lg: "4rem",
        xl: "5rem",
        "2xl": "6rem",
      },
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Financial color palette
        finance: {
          positive: "hsl(142 71% 45%)", // green-600
          negative: "hsl(0 84% 60%)", // red-500
          neutral: "hsl(215 16% 47%)", // gray-600
          warning: "hsl(38 92% 50%)", // amber-500
          info: "hsl(217 91% 60%)", // blue-500
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      spacing: {
        'safe-top': 'var(--mobile-safe-area-top)',
        'safe-bottom': 'var(--mobile-safe-area-bottom)',
        'safe-left': 'var(--mobile-safe-area-left)',
        'safe-right': 'var(--mobile-safe-area-right)',
        'touch': 'var(--mobile-touch-target)',
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      minHeight: {
        'touch': 'var(--mobile-touch-target)',
        'chart-mobile': 'var(--chart-mobile-height)',
        'chart-tablet': 'var(--chart-tablet-height)',
        'chart-desktop': 'var(--chart-desktop-height)',
      },
      maxHeight: {
        'chart-mobile': 'var(--chart-mobile-height)',
        'chart-tablet': 'var(--chart-tablet-height)',
        'chart-desktop': 'var(--chart-desktop-height)',
        'screen-mobile': '100dvh',
      },
      height: {
        'chart-mobile': 'var(--chart-mobile-height)',
        'chart-tablet': 'var(--chart-tablet-height)',
        'chart-desktop': 'var(--chart-desktop-height)',
        'screen-mobile': '100dvh',
        'screen-desktop': '100vh',
      },
      minWidth: {
        'touch': 'var(--mobile-touch-target)',
      },
      fontSize: {
        'mobile-xs': ['10px', { lineHeight: '14px' }],
        'mobile-sm': ['12px', { lineHeight: '16px' }],
        'mobile-base': ['14px', { lineHeight: '20px' }],
        'mobile-lg': ['16px', { lineHeight: '24px' }],
        'mobile-xl': ['18px', { lineHeight: '28px' }],
      },
      fontFamily: {
        'tabular': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      backdropBlur: {
        'xs': '2px',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "mobile-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "mobile-slide-up": {
          from: { 
            opacity: "0",
            transform: "translateY(20px)"
          },
          to: { 
            opacity: "1",
            transform: "translateY(0)"
          },
        },
        "mobile-scale-in": {
          from: { 
            opacity: "0",
            transform: "scale(0.95)"
          },
          to: { 
            opacity: "1",
            transform: "scale(1)"
          },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        "skeleton-loading": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "mobile-fade-in": "mobile-fade-in 0.3s ease-out",
        "mobile-slide-up": "mobile-slide-up 0.3s ease-out",
        "mobile-scale-in": "mobile-scale-in 0.2s ease-out",
        "pulse-subtle": "pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "skeleton-loading": "skeleton-loading 1.5s ease-in-out infinite",
      },
      transitionTimingFunction: {
        'mobile': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        '250': '250ms',
        '400': '400ms',
      },
      zIndex: {
        'mobile-nav': '50',
        'modal': '100',
        'toast': '110',
        'tooltip': '120',
      },
      aspectRatio: {
        'chart': '16 / 9',
        'chart-mobile': '4 / 3',
        'card': '3 / 2',
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms")({
      strategy: 'class',
    }),
    require("@tailwindcss/typography"),
    // Custom plugin for mobile utilities
    function({ addUtilities, theme, addComponents }) {
      const newUtilities = {
        // Touch-friendly utilities
        '.touch-manipulation': {
          'touch-action': 'manipulation',
        },
        '.touch-pan-x': {
          'touch-action': 'pan-x',
        },
        '.touch-pan-y': {
          'touch-action': 'pan-y',
        },
        '.touch-none': {
          'touch-action': 'none',
        },
        // Disable text selection
        '.select-none-important': {
          '-webkit-user-select': 'none !important',
          '-moz-user-select': 'none !important',
          '-ms-user-select': 'none !important',
          'user-select': 'none !important',
        },
        // Remove tap highlight
        '.tap-highlight-transparent': {
          '-webkit-tap-highlight-color': 'transparent',
        },
        // Momentum scrolling
        '.scroll-momentum': {
          '-webkit-overflow-scrolling': 'touch',
          'scroll-behavior': 'smooth',
          'overscroll-behavior': 'contain',
        },
        // Hardware acceleration
        '.gpu-accelerated': {
          'transform': 'translateZ(0)',
          'will-change': 'transform',
        },
        // Font smoothing
        '.font-smoothing': {
          '-webkit-font-smoothing': 'antialiased',
          '-moz-osx-font-smoothing': 'grayscale',
        },
        // Safe area padding
        '.pt-safe': {
          'padding-top': 'var(--mobile-safe-area-top)',
        },
        '.pb-safe': {
          'padding-bottom': 'var(--mobile-safe-area-bottom)',
        },
        '.pl-safe': {
          'padding-left': 'var(--mobile-safe-area-left)',
        },
        '.pr-safe': {
          'padding-right': 'var(--mobile-safe-area-right)',
        },
        // Hide scrollbars
        '.scrollbar-hide': {
          'scrollbar-width': 'none',
          '-ms-overflow-style': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        // Custom scrollbar
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          'scrollbar-color': `${theme('colors.muted.DEFAULT')} transparent`,
        },
      }

      const newComponents = {
        // Mobile-optimized button
        '.btn-mobile': {
          '@apply min-h-touch min-w-touch px-4 py-2 touch-manipulation tap-highlight-transparent select-none-important': {},
          '@apply transition-colors duration-200 font-medium rounded-md': {},
          '@apply focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring': {},
        },
        // Mobile card
        '.card-mobile': {
          '@apply bg-card border border-border rounded-lg shadow-sm': {},
          '@apply backdrop-blur-sm': {},
        },
        // Financial performance indicators
        '.perf-indicator': {
          '@apply inline-flex items-center px-2 py-1 rounded text-xs font-medium': {},
        },
        '.perf-positive': {
          '@apply perf-indicator bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300': {},
        },
        '.perf-negative': {
          '@apply perf-indicator bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300': {},
        },
        '.perf-neutral': {
          '@apply perf-indicator bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300': {},
        },
      }

      addUtilities(newUtilities)
      addComponents(newComponents)
    },
  ],
}
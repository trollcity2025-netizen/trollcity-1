// TrollCity Global Theme Configuration
// Applied across all pages for consistent branding

export const trollCityTheme = {
  // Background Gradients
  backgrounds: {
    app: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
    primary: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
    card: 'bg-slate-900/60 backdrop-blur-xl',
    glass: 'bg-white/5 backdrop-blur-xl',
    modal: 'bg-slate-950/95 backdrop-blur-2xl',
  },
  
  // Gradient Overlays (for depth)
  overlays: {
    radialPurple: 'bg-[radial-gradient(circle_at_20%_30%,rgba(147,51,234,0.18),transparent)]',
    radialPink: 'bg-[radial-gradient(circle_at_80%_70%,rgba(236,72,153,0.15),transparent)]',
    radialCyan: 'bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.12),transparent)]',
  },
  
  // Brand Gradients
  gradients: {
    primary: 'bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500',
    primaryHover: 'hover:shadow-[0_15px_50px_rgba(236,72,153,0.5)]',
    text: 'bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent',
    button: 'bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500',
    goLive: 'bg-gradient-to-r from-red-600 to-orange-600',
  },
  
  // Borders
  borders: {
    glass: 'border border-white/10',
    glassHover: 'hover:border-purple-500/30',
    active: 'border-purple-500/40',
    accent: 'border-l-2 border-transparent',
    accentActive: 'border-l-2 bg-gradient-to-b from-purple-600 to-cyan-600',
  },
  
  // Shadows
  shadows: {
    card: 'shadow-[0_10px_30px_rgba(0,0,0,0.3)]',
    cardHover: 'hover:shadow-[0_15px_40px_rgba(147,51,234,0.3)]',
    glow: 'shadow-[0_10px_40px_rgba(147,51,234,0.4)]',
    glowPink: 'shadow-[0_10px_40px_rgba(236,72,153,0.4)]',
    glowCyan: 'shadow-[0_8px_24px_rgba(56,189,248,0.3)]',
    button: 'shadow-[0_10px_40px_rgba(147,51,234,0.35)]',
  },
  
  // Text Colors
  text: {
    primary: 'text-white',
    secondary: 'text-slate-300',
    muted: 'text-slate-400',
    mutedDark: 'text-slate-500',
    gradient: 'bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent',
  },
  
  // Interactive States
  interactive: {
    hover: 'hover:-translate-y-0.5 transition-all duration-300',
    hoverScale: 'hover:scale-105 transition-transform duration-300',
    active: 'bg-slate-800/70',
  },

  // Button Styles (lighter version without padding/rounding)
  buttons: {
    primary: 'bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white shadow-[0_10px_40px_rgba(147,51,234,0.4)] hover:shadow-[0_15px_50px_rgba(236,72,153,0.5)]',
    secondary: 'bg-slate-900/60 backdrop-blur-xl border border-white/10 text-slate-50 hover:border-cyan-400/40 hover:bg-slate-800/70',
    danger: 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg hover:shadow-red-500/50',
  },
  
  // Component Specific
  components: {
    // Cards
    card: 'p-6 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:border-purple-500/30 hover:bg-slate-800/70 transition-all duration-300',
    
    // Buttons
    buttonPrimary: 'px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 rounded-2xl font-bold text-lg text-white shadow-[0_10px_40px_rgba(147,51,234,0.4)] hover:shadow-[0_15px_50px_rgba(236,72,153,0.5)] transition-all duration-300 hover:-translate-y-0.5',
    buttonSecondary: 'px-8 py-4 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl font-semibold text-lg text-slate-50 hover:border-cyan-400/40 hover:bg-slate-800/70 transition-all duration-300 hover:-translate-y-0.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]',
    
    // Input Fields
    input: 'w-full px-4 py-3 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-slate-400 focus:border-purple-500/40 focus:ring-2 focus:ring-purple-500/20 transition-all',
    
    // Badges
    badge: 'px-4 py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/20',
    badgePrimary: 'px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full',
  },
  
  // Animation Classes
  animations: {
    fadeInUp: 'animate-fade-in-up',
    float: 'animate-float',
    floatSlow: 'animate-float-slow',
    pulseSlow: 'animate-pulse-slow',
  },
};

// Helper function to combine theme classes
export const combineThemeClasses = (...classes: string[]) => {
  return classes.filter(Boolean).join(' ');
};

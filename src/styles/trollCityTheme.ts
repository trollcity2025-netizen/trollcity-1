// TrollCity Global Theme Configuration
// Applied across all pages for consistent branding

export const trollCityTheme = {
  // Background Gradients
  backgrounds: {
    app: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
    primary: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
    card: 'bg-slate-900/60 backdrop-blur-xl',
    glass: 'bg-white/[0.04] backdrop-blur-2xl',
    modal: 'bg-slate-950/95 backdrop-blur-2xl',
    input: 'bg-slate-800/50',
  },
  
  // Gradient Overlays (for depth)
  overlays: {
    radialPurple: 'bg-[radial-gradient(circle_at_20%_30%,rgba(147,51,234,0.12),transparent)]',
    radialPink: 'bg-[radial-gradient(circle_at_80%_70%,rgba(236,72,153,0.1),transparent)]',
    radialCyan: 'bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.08),transparent)]',
  },
  
  // Brand Gradients
  gradients: {
    primary: 'bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500',
    primaryHover: 'hover:shadow-[0_15px_50px_rgba(236,72,153,0.4)] hover:brightness-110',
    text: 'bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent',
    button: 'bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500',
    goLive: 'bg-gradient-to-r from-red-600 to-orange-600',
  },
  
  // Borders
  borders: {
    glass: 'border border-white/[0.08]',
    glassHover: 'hover:border-white/[0.14]',
    active: 'border-purple-500/30',
    accent: 'border-l-2 border-transparent',
    accentActive: 'border-l-2 bg-gradient-to-b from-purple-600 to-cyan-600',
  },
  
  // Shadows
  shadows: {
    card: 'shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
    cardHover: 'hover:shadow-[0_12px_40px_rgba(147,51,234,0.15)]',
    glow: 'shadow-[0_10px_40px_rgba(147,51,234,0.25)]',
    glowPink: 'shadow-[0_10px_40px_rgba(236,72,153,0.25)]',
    glowCyan: 'shadow-[0_8px_24px_rgba(56,189,248,0.2)]',
    button: 'shadow-[0_8px_32px_rgba(147,51,234,0.25)]',
  },
  
  // Text Colors
  text: {
    primary: 'text-white',
    secondary: 'text-slate-300',
    muted: 'text-slate-400',
    mutedDark: 'text-slate-500',
    highlight: 'text-cyan-400',
    accent: 'text-purple-400',
    heading: 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400',
    gradient: 'bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent',
  },
  
  // Interactive States
  interactive: {
    hover: 'hover:-translate-y-px transition-all duration-300',
    hoverScale: 'hover:scale-[1.03] transition-transform duration-300',
    active: 'bg-slate-800/60',
    disabled: 'opacity-40 cursor-not-allowed',
  },

  // Button Styles (lighter version without padding/rounding)
  buttons: {
    primary: 'bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white shadow-[0_8px_32px_rgba(147,51,234,0.3)] hover:shadow-[0_12px_40px_rgba(236,72,153,0.4)] hover:brightness-110',
    secondary: 'bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] text-slate-50 hover:border-white/[0.15] hover:bg-slate-800/60',
    danger: 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg hover:shadow-red-500/40',
  },
  
  // Component Specific
  components: {
    // Cards
    card: 'p-6 bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-white/[0.14] hover:bg-slate-800/50 transition-all duration-300',
    
    // Buttons
    buttonPrimary: 'px-8 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 rounded-xl font-bold text-white shadow-[0_8px_32px_rgba(147,51,234,0.3)] hover:shadow-[0_12px_40px_rgba(236,72,153,0.4)] transition-all duration-300 hover:-translate-y-px hover:brightness-110',
    buttonSecondary: 'px-8 py-3 bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] rounded-xl font-semibold text-slate-50 hover:border-white/[0.15] hover:bg-slate-800/60 transition-all duration-300 hover:-translate-y-px shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
    
    // Input Fields
    input: 'w-full px-4 py-3 bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] rounded-xl text-white placeholder:text-slate-500 focus:border-purple-500/30 focus:ring-2 focus:ring-purple-500/15 transition-all duration-300',
    
    // Badges
    badge: 'px-3 py-1 bg-white/[0.04] backdrop-blur-sm rounded-full border border-white/[0.08]',
    badgePrimary: 'px-3 py-1 bg-purple-500/10 border border-purple-500/15 rounded-full',
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

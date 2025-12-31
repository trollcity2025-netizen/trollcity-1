import React, { createContext, useContext, useState } from 'react'

export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  border: string
  text: string
  textSecondary: string
  background: string
}

const defaultTheme: ThemeColors = {
  primary: 'purple',
  secondary: 'purple',
  accent: 'purple',
  border: 'purple-500',
  text: 'purple-300',
  textSecondary: 'purple-400',
  background: 'from-gray-950 via-purple-950 to-gray-950',
}

interface ThemeContextType {
  theme: ThemeColors
  setTheme: (theme: Partial<ThemeColors>) => void
  resetTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeColors>(defaultTheme)

  const setTheme = (newTheme: Partial<ThemeColors>) => {
    setThemeState((prev) => ({ ...prev, ...newTheme }))
  }

  const resetTheme = () => {
    setThemeState(defaultTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

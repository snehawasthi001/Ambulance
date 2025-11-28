'use client'

import * as React from 'react'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: 'light' | 'dark'
}

type ThemeContextType = {
  theme: string
  setTheme: (theme: string) => void
}

const ThemeContext = React.createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => null
})

export function ThemeProvider({ 
  children,
  defaultTheme = 'dark'
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState(defaultTheme)
  
  React.useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])
  
  const value = React.useMemo(() => ({
    theme,
    setTheme: (newTheme: string) => setTheme(newTheme as 'light' | 'dark')
  }), [theme])
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => React.useContext(ThemeContext)

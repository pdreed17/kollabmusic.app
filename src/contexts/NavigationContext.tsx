import React, { createContext, useContext, useState, ReactNode } from 'react'

interface NavigationContextType {
  isNavExpanded: boolean
  setIsNavExpanded: (expanded: boolean) => void
  toggleNav: () => void
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isNavExpanded, setIsNavExpanded] = useState(false)

  const toggleNav = () => {
    setIsNavExpanded(!isNavExpanded)
  }

  return (
    <NavigationContext.Provider value={{ isNavExpanded, setIsNavExpanded, toggleNav }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigationPill() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigationPill must be used within NavigationProvider')
  }
  return context
}

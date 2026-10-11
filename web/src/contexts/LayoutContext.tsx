import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'

// Keep shared page spacing while ignoring obsolete centered preferences.
interface LayoutContextValue {
  containerClass: (expandable?: boolean) => string
}

const value: LayoutContextValue = {
  containerClass: () => 'w-full min-w-0 px-4 sm:px-5 lg:px-6',
}
const LayoutContext = createContext<LayoutContextValue | null>(null)

export function LayoutProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    localStorage.setItem('montask_layout', 'expanded')
  }, [])
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export function useLayout() {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider')
  return ctx
}

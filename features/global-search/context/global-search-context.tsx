'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface GlobalSearchContextValue {
  isOpen: boolean
  open:   () => void
  close:  () => void
  userId: string
}

const GlobalSearchContext = createContext<GlobalSearchContextValue>({
  isOpen: false,
  open:   () => {},
  close:  () => {},
  userId: '',
})

export function useGlobalSearch(): GlobalSearchContextValue {
  return useContext(GlobalSearchContext)
}

interface GlobalSearchProviderProps {
  children: ReactNode
  userId:   string
}

export function GlobalSearchProvider({ children, userId }: GlobalSearchProviderProps) {
  const [isOpen, setIsOpen] = useState(false)

  const open  = useCallback(() => setIsOpen(true),  [])
  const close = useCallback(() => setIsOpen(false), [])

  return (
    <GlobalSearchContext.Provider value={{ isOpen, open, close, userId }}>
      {children}
    </GlobalSearchContext.Provider>
  )
}

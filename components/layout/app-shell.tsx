'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/client-utils'
import { Header } from './header'
import { Sidebar } from './sidebar'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [showSidebar, setShowSidebar] = React.useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
  const { data: session, status } = useSession()

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)
  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  React.useEffect(() => {
    setShowSidebar(!!session?.user)
  }, [session])

  // Prevent body scroll when mobile menu is open
  React.useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobileMenuOpen])

  return (
    <div className="flex h-screen">
      <Header onMenuToggle={toggleMobileMenu} isMenuOpen={isMobileMenuOpen} />
      {status !== 'loading' && showSidebar && <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />}
      <main className={cn(
        "flex-1 min-h-screen pt-16 overflow-auto px-4",
        status !== 'loading' && showSidebar ? "md:ml-64 md:px-8" : ""
      )}>
        {children}
      </main>
    </div>
  )
}
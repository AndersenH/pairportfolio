'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  BarChart3,
  User,
  LogOut,
  Settings,
  Menu,
  X,
  TrendingUp,
  LogIn,
} from 'lucide-react'

interface HeaderProps {
  onMenuToggle?: () => void
  isMenuOpen?: boolean
}

// Helper function to get user initials
function getInitials(user: any): string {
  if (!user) return 'U'
  
  // Try to get name from various sources
  const name = user.user_metadata?.name || user.user_metadata?.full_name || user.user_metadata?.display_name
  
  if (name) {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return parts[0][0].toUpperCase()
  }
  
  // Fallback to email
  if (user.email) {
    return user.email[0].toUpperCase()
  }
  
  return 'U'
}

export function Header({ onMenuToggle, isMenuOpen }: HeaderProps) {
  const router = useRouter()
  const [user, setUser] = React.useState<any>(null)
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false)
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const supabase = createClient()

  React.useEffect(() => {
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      console.log('Header: Current user data:', user, 'Error:', error) // Debug log
      if (error) {
        console.log('Header: Auth error, clearing user state')
        setUser(null)
      } else {
        setUser(user)
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Header: Auth state changed:', { event, user: session?.user }) // Debug log
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      setIsUserMenuOpen(false) // Close menu immediately
      await supabase.auth.signOut()
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Sign out error:', error)
      // Still redirect to home even if sign out fails
      router.push('/')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <header className="border-b bg-background">
      <div className="flex h-16 items-center px-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden mr-2"
          onClick={onMenuToggle}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <TrendingUp className="h-6 w-6 text-indigo-600" />
          <span className="hidden font-bold sm:inline-block text-gray-900">
            ETF Portfolio
          </span>
        </Link>

        {/* Main navigation - hidden on mobile */}
        <nav className="mx-6 hidden md:flex items-center space-x-4 lg:space-x-6">
          <Link
            href="/dashboard"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Dashboard
          </Link>
          <Link
            href="/portfolios"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Portfolios
          </Link>
          <Link
            href="/backtests"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Backtests
          </Link>
          <Link
            href="/market-data"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Market Data
          </Link>
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-indigo-600" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </Button>
              <div className="relative">
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full hover:bg-accent"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={user.user_metadata?.avatar_url || user.user_metadata?.picture || ''} 
                      alt="User Avatar" 
                    />
                    <AvatarFallback className="bg-indigo-100 text-indigo-600 font-semibold">
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              
              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md border bg-popover p-1 shadow-lg z-50">
                    <div className="px-3 py-2">
                      {user.user_metadata?.name && (
                        <div className="text-sm font-medium text-foreground">
                          {user.user_metadata.name}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                    <div className="h-px bg-border my-1" />
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Button>
                    <div className="h-px bg-border my-1" />
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {isSigningOut ? 'Signing out...' : 'Sign out'}
                    </Button>
                  </div>
                </>
              )}
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/login" className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Link>
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" asChild>
                <Link href="/auth/register">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
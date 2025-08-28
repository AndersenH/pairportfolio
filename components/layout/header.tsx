'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { NavigationMenu } from '@/components/ui/navigation-menu'
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
  
  // Try to get name from NextAuth user object
  const name = user.name
  
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
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false)
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const { data: session, status } = useSession()

  const user = session?.user

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      setIsUserMenuOpen(false) // Close menu immediately
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Sign out error:', error)
      router.push('/')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background">
      <div className="flex h-16 items-center px-4">
        {/* Mobile menu button - only show when authenticated */}
        {status !== 'loading' && user && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden mr-2"
            onClick={onMenuToggle}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        )}

        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <TrendingUp className="h-6 w-6 text-indigo-600" />
          <span className="hidden font-bold sm:inline-block text-gray-900">
            ETF Portfolio
          </span>
        </Link>

        {/* Main navigation - hidden on mobile and when not authenticated */}
        {status !== 'loading' && user && (
          <div className="mx-6 hidden md:flex">
            <NavigationMenu
              items={[
                {
                  title: 'Dashboard',
                  href: '/dashboard',
                },
                {
                  title: 'Portfolios',
                  href: '/portfolios',
                },
                {
                  title: 'Backtest',
                  items: [
                    {
                      title: 'New Backtest',
                      href: '/backtests/new',
                      description: 'Run a new portfolio backtest',
                    },
                    {
                      title: 'Results History',
                      href: '/backtests',
                      description: 'View your past backtests',
                    },
                    {
                      title: 'Compare Strategies',
                      href: '/backtests/compare',
                      description: 'Compare multiple strategies',
                    },
                  ],
                },
                {
                  title: 'Research',
                  items: [
                    {
                      title: 'Market Scanner',
                      href: '/research/scanner',
                      description: 'Screen and filter ETFs',
                    },
                    {
                      title: 'Correlation Matrix',
                      href: '/research/correlation',
                      description: 'Analyze asset relationships',
                    },
                    {
                      title: 'Risk Analysis',
                      href: '/research/risk',
                      description: 'Portfolio risk metrics',
                    },
                    {
                      title: 'Sector Analysis',
                      href: '/research/sectors',
                      description: 'Sector performance data',
                    },
                  ],
                },
                {
                  title: 'Learn',
                  items: [
                    {
                      title: 'Strategy Guide',
                      href: '/learn/strategies',
                      description: 'Understanding each strategy',
                    },
                    {
                      title: 'ETF Basics',
                      href: '/learn/etf-basics',
                      description: 'Introduction to ETF investing',
                    },
                    {
                      title: 'Tutorials',
                      href: '/learn/tutorials',
                      description: 'Step-by-step guides',
                    },
                    {
                      title: 'Glossary',
                      href: '/learn/glossary',
                      description: 'Financial terms explained',
                    },
                  ],
                },
                {
                  title: 'About',
                  items: [
                    {
                      title: 'How It Works',
                      href: '/about/methodology',
                      description: 'Our calculation methods',
                    },
                    {
                      title: 'Data Sources',
                      href: '/about/data',
                      description: 'Where our data comes from',
                    },
                    {
                      title: 'Team',
                      href: '/about/team',
                      description: 'Meet the team',
                    },
                    {
                      title: 'Changelog',
                      href: '/about/changelog',
                      description: 'Version history',
                    },
                  ],
                },
              ]}
            />
          </div>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center space-x-4" suppressHydrationWarning>
          {status === 'loading' ? (
            <div className="flex items-center space-x-2">
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
          ) : user ? (
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
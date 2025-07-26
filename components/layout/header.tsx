'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  BarChart3,
  User,
  LogOut,
  Settings,
  Menu,
  X,
} from 'lucide-react'

interface HeaderProps {
  onMenuToggle?: () => void
  isMenuOpen?: boolean
}

export function Header({ onMenuToggle, isMenuOpen }: HeaderProps) {
  const { data: session } = useSession()
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false)

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
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
          <BarChart3 className="h-6 w-6 text-primary" />
          <span className="hidden font-bold sm:inline-block">
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
          {session ? (
            <div className="relative">
              <Button
                variant="ghost"
                className="relative h-8 w-8 rounded-full"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session.user?.image || ''} alt="User" />
                  <AvatarFallback>
                    {session.user?.name?.[0]?.toUpperCase() || 'U'}
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
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {session.user?.email}
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
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/signin">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/signup">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
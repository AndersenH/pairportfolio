'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/client-utils'
import {
  LayoutDashboard,
  Briefcase,
  TrendingUp,
  Database,
  Settings,
  HelpCircle,
  ChevronLeft,
  Plus,
  FileBarChart,
  FlaskConical,
  Info,
  ChevronRight,
  GraduationCap,
  Search,
  BarChart3,
  BookOpen,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const sidebarItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Portfolios',
    href: '/portfolios',
    icon: Briefcase,
  },
  {
    title: 'Backtest',
    icon: TrendingUp,
    children: [
      {
        title: 'New Backtest',
        href: '/backtests/new',
        icon: Plus,
      },
      {
        title: 'Results History',
        href: '/backtests',
        icon: FileBarChart,
      },
      {
        title: 'Compare Strategies',
        href: '/backtests/compare',
        icon: BarChart3,
      },
    ],
  },
  {
    title: 'Research',
    icon: FlaskConical,
    children: [
      {
        title: 'Market Scanner',
        href: '/research/scanner',
        icon: Search,
      },
      {
        title: 'Correlation Matrix',
        href: '/research/correlation',
        icon: Target,
      },
      {
        title: 'Risk Analysis',
        href: '/research/risk',
        icon: Database,
      },
      {
        title: 'Sector Analysis',
        href: '/research/sectors',
        icon: BarChart3,
      },
    ],
  },
  {
    title: 'Learn',
    icon: GraduationCap,
    children: [
      {
        title: 'Strategy Guide',
        href: '/learn/strategies',
        icon: BookOpen,
      },
      {
        title: 'ETF Basics',
        href: '/learn/etf-basics',
        icon: Info,
      },
      {
        title: 'Tutorials',
        href: '/learn/tutorials',
        icon: Plus,
      },
      {
        title: 'Glossary',
        href: '/learn/glossary',
        icon: BookOpen,
      },
    ],
  },
  {
    title: 'About',
    icon: Info,
    children: [
      {
        title: 'How It Works',
        href: '/about/methodology',
        icon: Settings,
      },
      {
        title: 'Data Sources',
        href: '/about/data',
        icon: Database,
      },
      {
        title: 'Team',
        href: '/about/team',
        icon: Info,
      },
    ],
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
  {
    title: 'Help',
    href: '/help',
    icon: HelpCircle,
  },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = React.useState<string[]>([])

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev => 
      prev.includes(title)
        ? prev.filter(item => item !== title)
        : [...prev, title]
    )
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-16 left-0 z-50 h-[calc(100vh-4rem)] w-64 transform border-r bg-background transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:top-0 md:h-full',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 md:hidden">
            <span className="text-lg font-semibold">Menu</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {sidebarItems.map((item) => {
              const isExpanded = expandedItems.includes(item.title)
              const isActive = pathname === item.href
              const hasChildren = item.children && item.children.length > 0

              return (
                <div key={item.title}>
                  {hasChildren ? (
                    <>
                      <button
                        onClick={() => toggleExpanded(item.title)}
                        className={cn(
                          'w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                        )}
                      >
                        <div className="flex items-center space-x-3">
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                        </div>
                        <ChevronRight 
                          className={cn(
                            "h-4 w-4 transition-transform",
                            isExpanded && "rotate-90"
                          )} 
                        />
                      </button>
                      {isExpanded && (
                        <div className="ml-8 mt-1 space-y-1">
                          {item.children.map((child) => {
                            const isChildActive = pathname === child.href
                            return (
                              <Link
                                key={child.href}
                                href={child.href as any}
                                onClick={onClose}
                                className={cn(
                                  'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                                  isChildActive
                                    ? 'bg-accent text-accent-foreground'
                                    : 'text-muted-foreground'
                                )}
                              >
                                <child.icon className="h-4 w-4" />
                                <span>{child.title}</span>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href! as any}
                      onClick={onClose}
                      className={cn(
                        'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="text-xs text-muted-foreground">
              ETF Portfolio Backtesting
            </div>
            <div className="text-xs text-muted-foreground">
              v2.0.0
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
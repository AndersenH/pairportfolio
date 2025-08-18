'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/client-utils'

interface NavItem {
  title: string
  href?: string
  items?: {
    title: string
    href: string
    description?: string
  }[]
}

interface NavigationMenuProps {
  items: NavItem[]
  className?: string
}

export function NavigationMenu({ items, className }: NavigationMenuProps) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null)

  React.useEffect(() => {
    const handleClickOutside = () => setOpenIndex(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <nav className={cn("flex items-center space-x-4 lg:space-x-6", className)}>
      {items.map((item, index) => (
        <div key={item.title} className="relative">
          {item.items ? (
            <>
              <button
                className="flex items-center space-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenIndex(openIndex === index ? null : index)
                }}
              >
                <span>{item.title}</span>
                <ChevronDown className={cn(
                  "h-3 w-3 transition-transform",
                  openIndex === index && "rotate-180"
                )} />
              </button>
              {openIndex === index && (
                <div className="absolute left-0 top-full mt-2 w-64 rounded-md border bg-popover p-2 shadow-lg z-50">
                  {item.items.map((subItem) => (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className="block rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                      onClick={() => setOpenIndex(null)}
                    >
                      <div className="font-medium">{subItem.title}</div>
                      {subItem.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {subItem.description}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Link
              href={item.href || '#'}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              {item.title}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
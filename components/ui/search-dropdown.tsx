'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/client-utils'

interface SearchResult {
  symbol: string
  name: string
  exchangeShortName: string
  type?: string
  currency?: string
}

interface SearchDropdownProps {
  placeholder?: string
  onSelect: (result: SearchResult) => void
  className?: string
  disabled?: boolean
  debounceMs?: number
  minChars?: number
  maxResults?: number
}

export function SearchDropdown({
  placeholder = 'Search for stocks/ETFs...',
  onSelect,
  className,
  disabled = false,
  debounceMs = 300,
  minChars = 2,
  maxResults = 15
}: SearchDropdownProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Debounced search function
  const debouncedSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < minChars) {
        setResults([])
        setIsOpen(false)
        return
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController()

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/search-symbols?query=${encodeURIComponent(searchQuery)}&limit=${maxResults}`,
          {
            signal: abortControllerRef.current.signal,
          }
        )

        if (!response.ok) {
          throw new Error('Failed to fetch search results')
        }

        const data = await response.json()

        if (data.success) {
          setResults(data.data || [])
          setIsOpen(data.data?.length > 0)
        } else {
          setError(data.error || 'Search failed')
          setResults([])
          setIsOpen(false)
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Search error:', error)
          setError('Search failed. Please try again.')
          setResults([])
          setIsOpen(false)
        }
      } finally {
        setIsLoading(false)
      }
    },
    [minChars, maxResults]
  )

  // Debounce effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        debouncedSearch(query.trim())
      } else {
        setResults([])
        setIsOpen(false)
      }
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [query, debouncedSearch, debounceMs])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  // Handle selection
  const handleSelect = (result: SearchResult) => {
    onSelect(result)
    setQuery('')
    setResults([])
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.blur()
  }

  // Handle clear
  const handleClear = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    setSelectedIndex(-1)
    setError(null)
    inputRef.current?.focus()
  }

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 text-gray-400 -translate-y-1/2" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true)
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10 pr-10"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
          {isLoading && (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          )}
          {query && !isLoading && (
            <button
              onClick={handleClear}
              className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto"
        >
          {error ? (
            <div className="p-3 text-sm text-red-600">
              {error}
            </div>
          ) : results.length === 0 && !isLoading ? (
            <div className="p-3 text-sm text-gray-500">
              {query.length < minChars 
                ? `Type at least ${minChars} characters to search`
                : 'No results found'
              }
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.symbol}-${result.exchangeShortName}`}
                onClick={() => handleSelect(result)}
                className={cn(
                  'w-full text-left p-3 hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-b-0',
                  selectedIndex === index && 'bg-indigo-50'
                )}
                type="button"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {result.symbol}
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        {result.exchangeShortName}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 truncate mt-1">
                      {result.name}
                    </div>
                  </div>
                  {result.type && (
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {result.type.toUpperCase()}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Helper text */}
      <div className="text-xs text-gray-500 mt-1">
        Type {minChars}+ characters to search thousands of stocks and ETFs
      </div>
    </div>
  )
}
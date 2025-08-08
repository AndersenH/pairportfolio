'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { 
  Plus, 
  Search, 
  Briefcase, 
  TrendingUp, 
  Calendar,
  Edit,
  Trash2,
  Play,
  Share2,
  Lock,
  Unlock
} from 'lucide-react'

interface Portfolio {
  id: string
  name: string
  description?: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
  holdings: {
    id: string
    symbol: string
    allocation: number
    name?: string
  }[]
  user: {
    id: string
    name: string
    email: string
  }
  _count: {
    backtests: number
  }
}

export default function PortfoliosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  // Fetch portfolios
  useEffect(() => {
    if (session) {
      fetchPortfolios()
    }
  }, [session])

  const fetchPortfolios = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/portfolios')
      
      if (!response.ok) {
        throw new Error('Failed to fetch portfolios')
      }

      const result = await response.json()
      setPortfolios(result.data || [])
    } catch (error) {
      console.error('Error fetching portfolios:', error)
      setError(error instanceof Error ? error.message : 'Failed to load portfolios')
    } finally {
      setIsLoading(false)
    }
  }

  const deletePortfolio = async (portfolioId: string) => {
    if (!confirm('Are you sure you want to delete this portfolio?')) {
      return
    }

    try {
      const response = await fetch(`/api/portfolios/${portfolioId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete portfolio')
      }

      // Remove from local state
      setPortfolios(prev => prev.filter(p => p.id !== portfolioId))
    } catch (error) {
      console.error('Error deleting portfolio:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete portfolio')
    }
  }

  const togglePortfolioVisibility = async (portfolioId: string, currentVisibility: boolean) => {
    try {
      const response = await fetch(`/api/portfolios/${portfolioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !currentVisibility }),
      })

      if (!response.ok) {
        throw new Error('Failed to update portfolio visibility')
      }

      // Update local state
      setPortfolios(prev => prev.map(p => 
        p.id === portfolioId 
          ? { ...p, isPublic: !currentVisibility }
          : p
      ))
    } catch (error) {
      console.error('Error updating portfolio:', error)
      setError(error instanceof Error ? error.message : 'Failed to update portfolio')
    }
  }

  // Filter portfolios based on search query
  const filteredPortfolios = portfolios.filter(portfolio =>
    portfolio.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    portfolio.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    portfolio.holdings.some(holding => 
      holding.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  if (status === 'loading' || !session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Portfolios</h1>
          <p className="text-gray-600 mt-1">
            Manage your saved portfolios and run backtests
          </p>
        </div>
        <Button asChild>
          <Link href="/">
            <Plus className="w-4 h-4 mr-2" />
            Create Portfolio
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search portfolios, holdings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchPortfolios}
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPortfolios.length === 0 ? (
        /* Empty State */
        <Card className="text-center py-12">
          <CardContent>
            <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No portfolios found' : 'No portfolios yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Create your first portfolio to start backtesting'
              }
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link href="/">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Portfolio
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Portfolio Grid */
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredPortfolios.map((portfolio) => (
            <Card key={portfolio.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{portfolio.name}</CardTitle>
                    {portfolio.description && (
                      <CardDescription className="mt-1">
                        {portfolio.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {portfolio.isPublic ? (
                      <Unlock className="w-4 h-4 text-green-600" title="Public" />
                    ) : (
                      <Lock className="w-4 h-4 text-gray-400" title="Private" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Holdings Summary */}
                <div className="mb-4">
                  {portfolio.holdings.slice(0, 3).map((holding) => (
                    <div key={holding.id} className="flex justify-between items-center text-sm mb-1">
                      <span className="font-medium">{holding.symbol}</span>
                      <span className="text-gray-600">
                        {(holding.allocation * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                  {portfolio.holdings.length > 3 && (
                    <div className="text-sm text-gray-500">
                      +{portfolio.holdings.length - 3} more holdings
                    </div>
                  )}
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    {portfolio.holdings.length} holdings
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {portfolio._count.backtests} backtests
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(portfolio.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Play className="w-3 h-3 mr-1" />
                    Backtest
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => togglePortfolioVisibility(portfolio.id, portfolio.isPublic)}
                  >
                    {portfolio.isPublic ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => deletePortfolio(portfolio.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
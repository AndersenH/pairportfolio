'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AllocationChart } from '@/components/charts/allocation-chart'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Edit,
  Trash2,
  TrendingUp,
  Calendar,
  DollarSign,
  BarChart3,
  Eye,
  EyeOff,
  Download,
  Share2,
} from 'lucide-react'

interface Portfolio {
  id: string
  name: string
  description?: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
  holdings: Array<{
    id: string
    symbol: string
    allocation: number
    name?: string
  }>
  user?: {
    id: string
    name?: string
    email: string
  }
}

export default function PortfolioDetailPage() {
  const params = useParams()
  const router = useRouter()
  const portfolioId = params?.id as string
  const [portfolio, setPortfolio] = React.useState<Portfolio | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!portfolioId) return

    const fetchPortfolio = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/portfolios/${portfolioId}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch portfolio')
        }

        const data = await response.json()
        if (data.success && data.data) {
          setPortfolio(data.data)
        } else {
          throw new Error('Invalid response format')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPortfolio()
  }, [portfolioId])

  const handleDelete = async () => {
    if (!portfolio || !confirm('Are you sure you want to delete this portfolio?')) return

    try {
      const response = await fetch(`/api/portfolios/${portfolio.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        router.push('/portfolios')
      } else {
        alert('Failed to delete portfolio')
      }
    } catch (err) {
      alert('An error occurred while deleting')
    }
  }

  const handleBacktest = () => {
    router.push(`/backtests/new?portfolio=${portfolioId}`)
  }

  const totalAllocation = portfolio?.holdings.reduce(
    (sum, holding) => sum + holding.allocation,
    0
  ) || 0

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !portfolio) {
    return (
      <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-destructive mb-4">{error || 'Portfolio not found'}</p>
            <Button asChild>
              <Link href="/portfolios">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Portfolios
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/portfolios">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-3xl font-bold tracking-tight">{portfolio.name}</h1>
                <Badge variant={portfolio.isPublic ? 'default' : 'secondary'}>
                  {portfolio.isPublic ? (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      Public
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" />
                      Private
                    </>
                  )}
                </Badge>
              </div>
              {portfolio.description && (
                <p className="text-muted-foreground mt-1">{portfolio.description}</p>
              )}
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/portfolios/${portfolio.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Holdings Table */}
            <Card>
              <CardHeader>
                <CardTitle>Holdings</CardTitle>
                <CardDescription>
                  {portfolio.holdings.length} positions • {(totalAllocation * 100).toFixed(1)}% allocated
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-4 pb-2 border-b text-sm font-medium text-muted-foreground">
                    <div>Symbol</div>
                    <div className="text-right">Allocation</div>
                    <div className="text-right">Weight</div>
                  </div>
                  {portfolio.holdings
                    .sort((a, b) => b.allocation - a.allocation)
                    .map((holding) => (
                      <div
                        key={holding.id}
                        className="grid grid-cols-3 gap-4 py-2 hover:bg-muted/50 rounded-md transition-colors"
                      >
                        <div className="font-medium">{holding.symbol}</div>
                        <div className="text-right">
                          {(holding.allocation * 100).toFixed(2)}%
                        </div>
                        <div className="text-right">
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary rounded-full h-2"
                              style={{ width: `${holding.allocation * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Allocation Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Allocation Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <AllocationChart
                  holdings={portfolio.holdings}
                  title=""
                  showLegend={true}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" onClick={handleBacktest}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Run Backtest
                </Button>
                <Button variant="outline" className="w-full">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Performance
                </Button>
              </CardContent>
            </Card>

            {/* Portfolio Info */}
            <Card>
              <CardHeader>
                <CardTitle>Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Created
                  </span>
                  <span className="text-sm font-medium">
                    {format(new Date(portfolio.createdAt), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Updated
                  </span>
                  <span className="text-sm font-medium">
                    {format(new Date(portfolio.updatedAt), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Allocation
                  </span>
                  <span className="text-sm font-medium">
                    {(totalAllocation * 100).toFixed(1)}%
                  </span>
                </div>
                {portfolio.user && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Owner</span>
                    <span className="text-sm font-medium">
                      {portfolio.user.name || portfolio.user.email}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
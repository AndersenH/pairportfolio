'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AllocationChart } from '@/components/charts/allocation-chart'
import { BacktestResultsDisplay } from '@/components/performance/backtest-results-display'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  LineChart,
  PieChart,
  Activity,
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
  const [performanceData, setPerformanceData] = React.useState<any>(null)
  const [isLoadingPerformance, setIsLoadingPerformance] = React.useState(false)
  const [performanceError, setPerformanceError] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState('performance')
  const [hasTriedAutoLoad, setHasTriedAutoLoad] = React.useState(false)

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

  const fetchPortfolioPerformance = React.useCallback(async () => {
    if (!portfolio) return;

    setIsLoadingPerformance(true);
    setPerformanceError(null);

    try {
      console.log('[fetchPortfolioPerformance] Starting performance analysis');
      // Use 5-year history ending at a safe historical date to ensure data availability
      // Calculate end date by going back to ensure we're on a business day and data exists
      const today = new Date()
      const endDate = new Date(today)
      
      // Go back 5 business days to ensure we have market data available
      // This accounts for weekends, holidays, and market closures
      let businessDaysBack = 0
      while (businessDaysBack < 5) {
        endDate.setDate(endDate.getDate() - 1)
        const dayOfWeek = endDate.getDay()
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          businessDaysBack++
        }
      }
      
      const endDateStr = endDate.toISOString().split('T')[0]
      
      // Calculate start date as exactly 5 years before the end date
      const startDate = new Date(endDate)
      startDate.setFullYear(startDate.getFullYear() - 5)
      const startDateStr = startDate.toISOString().split('T')[0]
      
      console.log(`Creating backtest for portfolio ${portfolio.id} from ${startDateStr} to ${endDateStr}`)
      
      const backtestResponse = await fetch('/api/backtests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          portfolioId: portfolio.id,
          name: `Performance Analysis - ${portfolio.name}`,
          startDate: startDateStr,
          endDate: endDateStr,
          initialCapital: 10000,
          benchmarkSymbol: 'SPY',
        }),
      })

      if (!backtestResponse.ok) {
        const errorData = await backtestResponse.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to create performance analysis')
      }

      const backtestData = await backtestResponse.json();
      console.log('[fetchPortfolioPerformance] Backtest creation response:', backtestData);
      
      if (backtestData.success && backtestData.data?.id) {
        // Poll for completion
        const backtestId = backtestData.data.id
        let attempts = 0
        const maxAttempts = 60 // 60 seconds max wait (increased for better reliability)
        
        const pollForResults = async (): Promise<void> => {
          try {
            console.log(`Polling attempt ${attempts + 1}/${maxAttempts} for backtest ${backtestId}`)
            
            const resultResponse = await fetch(`/api/backtests/${backtestId}`, {
              credentials: 'include',
            })
            
            if (resultResponse.ok) {
              const resultData = await resultResponse.json();
              console.log(`[fetchPortfolioPerformance] Polling attempt ${attempts + 1}:`, resultData);
              
              console.log(`Polling result for backtest ${backtestId}:`, {
                success: resultData.success,
                status: resultData.data?.status,
                hasResults: !!resultData.data?.results,
                dataKeys: Object.keys(resultData.data || {})
              })
              
              if (resultData.success && resultData.data?.status === 'completed') {
                console.log('Backtest completed successfully')
                console.log('Setting performance data:', resultData.data)
                console.log('Performance data structure check:', {
                  hasResults: !!resultData.data?.results,
                  resultKeys: Object.keys(resultData.data?.results || {}),
                  hasPortfolioValues: !!resultData.data?.results?.portfolioValues,
                  portfolioValuesLength: resultData.data?.results?.portfolioValues?.length,
                  dataKeys: Object.keys(resultData.data || {})
                })
                setPerformanceData(resultData.data)
                setIsLoadingPerformance(false)
                return
              } else if (resultData.data?.status === 'failed') {
                console.error('Backtest failed:', resultData.data.errorMessage)
                throw new Error(resultData.data.errorMessage || 'Performance analysis failed')
              } else {
                console.log(`Backtest still processing. Status: ${resultData.data?.status}`)
              }
            }
            
            attempts++
            if (attempts < maxAttempts) {
              setTimeout(pollForResults, 2000) // Poll every 2 seconds for better performance
            } else {
              throw new Error('Performance analysis timed out after 2 minutes')
            }
          } catch (error) {
            console.error('Error polling for results:', error)
            setPerformanceError(error instanceof Error ? error.message : 'Failed to complete performance analysis')
            setIsLoadingPerformance(false)
          }
        }
        
        // Start polling immediately instead of waiting 1 second
        pollForResults()
      } else {
        throw new Error('Invalid response from backtest creation')
      }
    } catch (error) {
      console.error('[fetchPortfolioPerformance] Error in fetchPortfolioPerformance:', error);
      setPerformanceError(error instanceof Error ? error.message : 'An error occurred')
      setIsLoadingPerformance(false)
    }
    // Remove finally block to let polling control the loading state
  }, [portfolio])

  // Reset auto-load flag when portfolio changes
  React.useEffect(() => {
    if (portfolioId) {
      setHasTriedAutoLoad(false)
      setPerformanceData(null)
      setPerformanceError(null)
      setIsLoadingPerformance(false)
    }
  }, [portfolioId])

  // Auto-load performance data when portfolio is loaded
  React.useEffect(() => {
    if (portfolio && !performanceData && !isLoadingPerformance && !performanceError && !hasTriedAutoLoad) {
      console.log('Auto-loading performance data for portfolio:', portfolio.id)
      setHasTriedAutoLoad(true)
      fetchPortfolioPerformance()
    }
  }, [portfolio?.id, performanceData, isLoadingPerformance, performanceError, hasTriedAutoLoad, fetchPortfolioPerformance]) // Include all dependencies

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
            {/* <Button variant="outline" size="sm" asChild>
              <Link href={`/portfolios/${portfolio.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button> */}
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <PieChart className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center space-x-2">
              <LineChart className="h-4 w-4" />
              <span>Performance</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
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
                      holdings={portfolio.holdings.map(h => ({
                        ...h,
                        name: h.name || null,
                        portfolioId: portfolio.id
                      }))}
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
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setActiveTab('performance')}
                    >
                      <Activity className="h-4 w-4 mr-2" />
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
          </TabsContent>

          <TabsContent value="performance" className="space-y-6 mt-6">
            {isLoadingPerformance ? (
              <div className="space-y-6">
                <Card>
                  <CardContent className="text-center py-12">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="text-muted-foreground">Calculating portfolio performance...</p>
                      <p className="text-sm text-muted-foreground">This may take a few moments</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : performanceError ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="flex flex-col items-center space-y-4">
                    <p className="text-destructive">{performanceError}</p>
                    <Button onClick={fetchPortfolioPerformance} variant="outline">
                      <Activity className="h-4 w-4 mr-2" />
                      Retry Analysis
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : performanceData?.results ? (
              <BacktestResultsDisplay
                results={performanceData.results}
                portfolioAllocation={portfolio.holdings.reduce((acc, holding) => {
                  acc[holding.symbol] = holding.allocation
                  return acc
                }, {} as Record<string, number>)}
                preCalculatedAssetPerformance={performanceData.assetPerformance || []}
                benchmarkSymbol="SPY"
                initialCapital={10000}
              />
            ) : performanceData ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="flex flex-col items-center space-y-4">
                    <p className="text-muted-foreground">Performance data available but results not found</p>
                    <div className="text-sm text-left bg-gray-100 p-4 rounded">
                      <p><strong>Performance Data Structure:</strong></p>
                      <pre>{JSON.stringify({
                        hasResults: !!performanceData.results,
                        status: performanceData.status,
                        keys: Object.keys(performanceData || {})
                      }, null, 2)}</pre>
                    </div>
                    <Button onClick={fetchPortfolioPerformance} variant="outline">
                      <Activity className="h-4 w-4 mr-2" />
                      Retry Analysis
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="flex flex-col items-center space-y-4">
                    <Activity className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">Click "View Performance" to analyze portfolio performance</p>
                    <Button onClick={fetchPortfolioPerformance}>
                      <Activity className="h-4 w-4 mr-2" />
                      Analyze Performance
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
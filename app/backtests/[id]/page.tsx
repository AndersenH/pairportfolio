'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PerformanceChart } from '@/components/charts/performance-chart'
// import { MetricsCard } from '@/components/portfolio/metrics-card'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Download,
  Share2,
  Save,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Percent,
  Calendar,
  BarChart3,
} from 'lucide-react'
import { SavePortfolioDialog } from '@/components/backtest/save-portfolio-dialog'

interface BacktestData {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: string
  startDate: string
  endDate: string
  initialCapital: number
  portfolio: {
    id: string
    name: string
    holdings: Array<{
      symbol: string
      allocation: number
    }>
  }
  strategy: {
    name: string
    type: string
  }
  results?: {
    portfolioValue: number[]
    dates: string[]
    returns: number[]
    drawdown: number[]
    benchmarkReturns?: number[]
  }
  performanceMetrics?: {
    totalReturn: number
    annualizedReturn: number
    volatility: number
    sharpeRatio: number
    maxDrawdown: number
    calmarRatio: number
    sortinoRatio: number
    winRate: number
  }
  backtestHoldings?: Array<{
    symbol: string
    allocation: number
    name?: string
  }>
}

export default function BacktestResultsPage() {
  const params = useParams()
  const router = useRouter()
  const backtestId = params.id as string
  
  const [backtest, setBacktest] = React.useState<BacktestData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isPolling, setIsPolling] = React.useState(false)

  // Fetch backtest data
  const fetchBacktest = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/backtests/${backtestId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Backtest not found')
        }
        throw new Error('Failed to fetch backtest')
      }

      const result = await response.json()
      if (result.success && result.data) {
        setBacktest(result.data)
        
        // Start polling if backtest is pending or running
        if (result.data.status === 'pending' || result.data.status === 'running') {
          setIsPolling(true)
        } else {
          setIsPolling(false)
        }
      } else {
        throw new Error('Invalid response format')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsPolling(false)
    } finally {
      setIsLoading(false)
    }
  }, [backtestId])

  // Initial fetch
  React.useEffect(() => {
    fetchBacktest()
  }, [fetchBacktest])

  // Polling for status updates
  React.useEffect(() => {
    if (!isPolling) return

    const interval = setInterval(() => {
      fetchBacktest()
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(interval)
  }, [isPolling, fetchBacktest])

  // Export results
  const handleExport = async () => {
    try {
      const response = await fetch(`/api/backtests/${backtestId}/export`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to export results')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backtest-${backtestId}-results.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export results')
    }
  }

  if (isLoading && !backtest) {
    return (
      <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!backtest) {
    return null
  }

  const isCompleted = backtest.status === 'completed'
  const isFailed = backtest.status === 'failed'
  const isPending = backtest.status === 'pending' || backtest.status === 'running'

  return (
    <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{backtest.name}</h1>
              <p className="text-muted-foreground">
                Created {format(new Date(backtest.createdAt), 'PPp')}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge
              variant={
                isCompleted ? 'default' :
                isFailed ? 'destructive' :
                isPending ? 'secondary' : 'outline'
              }
            >
              {backtest.status}
            </Badge>
            {isCompleted && (
              <>
                <SavePortfolioDialog
                  backtestId={backtest.id}
                  backtestName={backtest.name}
                  onSuccess={(portfolioId) => {
                    console.log('Portfolio saved with ID:', portfolioId)
                    // Could navigate to the portfolio or show additional success actions
                  }}
                >
                  <Button variant="outline" size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save Portfolio
                  </Button>
                </SavePortfolioDialog>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {isPending && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              {backtest.status === 'pending' 
                ? 'Your backtest is queued and will start processing soon...'
                : 'Your backtest is currently running. This may take a few minutes...'}
            </AlertDescription>
          </Alert>
        )}

        {isFailed && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The backtest failed to complete. Please try again or contact support if the issue persists.
            </AlertDescription>
          </Alert>
        )}

        {/* Backtest Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Backtest parameters and settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                  Date Range
                </div>
                <p className="text-sm font-medium">
                  {format(new Date(backtest.startDate), 'PP')} - {format(new Date(backtest.endDate), 'PP')}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Initial Capital
                </div>
                <p className="text-sm font-medium">
                  ${backtest.initialCapital.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Activity className="h-4 w-4 mr-2" />
                  Strategy
                </div>
                <p className="text-sm font-medium">
                  {backtest.strategy.name}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Portfolio
                </div>
                <p className="text-sm font-medium">
                  {backtest.portfolio.name}
                </p>
              </div>
            </div>

            {/* Holdings */}
            <div className="mt-6">
              <h4 className="text-sm font-medium mb-3">
                {backtest.backtestHoldings ? 'Custom Holdings Used' : 'Portfolio Holdings'}
              </h4>
              <div className="flex flex-wrap gap-2">
                {(backtest.backtestHoldings || backtest.portfolio.holdings).map((holding) => (
                  <Badge key={holding.symbol} variant="secondary">
                    {holding.symbol} ({(holding.allocation * 100).toFixed(1)}%)
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results - Only show if completed */}
        {isCompleted && backtest.results && backtest.performanceMetrics && (
          <>
            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Return</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    {backtest.performanceMetrics.totalReturn >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <p className={`text-2xl font-bold ${
                      backtest.performanceMetrics.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {backtest.performanceMetrics.totalReturn.toFixed(2)}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Annualized Return</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Percent className="h-4 w-4 text-blue-500" />
                    <p className="text-2xl font-bold">
                      {backtest.performanceMetrics.annualizedReturn.toFixed(2)}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Sharpe Ratio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-purple-500" />
                    <p className="text-2xl font-bold">
                      {backtest.performanceMetrics.sharpeRatio.toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Max Drawdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <p className="text-2xl font-bold text-red-500">
                      {backtest.performanceMetrics.maxDrawdown.toFixed(2)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <Tabs defaultValue="performance" className="space-y-4">
              <TabsList>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="returns">Returns</TabsTrigger>
                <TabsTrigger value="drawdown">Drawdown</TabsTrigger>
                <TabsTrigger value="holdings">Holdings Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="performance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio Value Over Time</CardTitle>
                    <CardDescription>
                      Growth of ${backtest.initialCapital.toLocaleString()} initial investment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PerformanceChart
                      data={backtest.results.dates.map((date, i) => ({
                        date,
                        value: backtest.results!.portfolioValue[i] || 0,
                        benchmark: backtest.results!.benchmarkReturns?.[i] || 0,
                      }))}
                      height={400}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="returns" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Returns Distribution</CardTitle>
                    <CardDescription>
                      Daily returns over the backtest period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PerformanceChart
                      data={backtest.results.dates.map((date, i) => ({
                        date,
                        value: backtest.results!.returns[i] || 0,
                      }))}
                      height={400}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="drawdown" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Drawdown Analysis</CardTitle>
                    <CardDescription>
                      Portfolio drawdown from peak values
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PerformanceChart
                      data={backtest.results.dates.map((date, i) => ({
                        date,
                        value: backtest.results!.drawdown[i] || 0,
                      }))}
                      height={400}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="holdings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Individual Holdings Performance</CardTitle>
                    <CardDescription>
                      Performance breakdown by holding
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center text-muted-foreground py-8">
                      Holdings performance data will be displayed here
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Additional Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Metrics</CardTitle>
                <CardDescription>
                  Detailed performance statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Volatility</p>
                    <p className="text-sm font-medium">
                      {backtest.performanceMetrics.volatility.toFixed(2)}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Calmar Ratio</p>
                    <p className="text-sm font-medium">
                      {backtest.performanceMetrics.calmarRatio.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Sortino Ratio</p>
                    <p className="text-sm font-medium">
                      {backtest.performanceMetrics.sortinoRatio.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-sm font-medium">
                      {(backtest.performanceMetrics.winRate * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
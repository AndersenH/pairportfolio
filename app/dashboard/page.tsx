'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { usePortfolios } from '@/hooks/use-portfolios'
import {
  Plus,
  Briefcase,
  BarChart3,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { format } from 'date-fns'

function RecentActivity() {
  const [backtests, setBacktests] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchBacktests = async () => {
      try {
        const response = await fetch('/api/backtests?limit=5')
        if (response.ok) {
          const data = await response.json()
          setBacktests(data.data || [])
        }
      } catch (error) {
        console.error('Error fetching backtests:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchBacktests()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (backtests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No backtests yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {backtests.slice(0, 5).map((backtest) => (
        <Link
          key={backtest.id}
          href={`/backtests/${backtest.id}`}
          className="block p-4 rounded-lg border hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="font-medium">{backtest.portfolio?.name || 'Portfolio'}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(backtest.startDate), 'MMM d, yyyy')} - {format(new Date(backtest.endDate), 'MMM d, yyyy')}
              </p>
            </div>
            {backtest.status === 'completed' && backtest.metrics?.totalReturn !== undefined && (
              <Badge variant={backtest.metrics.totalReturn >= 0 ? 'default' : 'destructive'}>
                {backtest.metrics.totalReturn >= 0 ? '+' : ''}
                {backtest.metrics.totalReturn.toFixed(1)}%
              </Badge>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { data: portfoliosData, isLoading } = usePortfolios(1, 10)
  const portfolios = portfoliosData?.data || []

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-lg text-muted-foreground">
          Build ETF portfolios and analyze their historical performance
        </p>
      </div>

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Create Portfolio */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
          <Link href="/portfolios/new">
            <CardHeader>
              <div className="h-12 w-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-200 transition-colors">
                <Plus className="h-6 w-6 text-indigo-600" />
              </div>
              <CardTitle className="text-xl">Create Portfolio</CardTitle>
              <CardDescription>
                Build a new ETF portfolio with custom allocations
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        {/* View Portfolios */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
          <Link href="/portfolios">
            <CardHeader>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <Briefcase className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl">My Portfolios</CardTitle>
              <CardDescription>
                {isLoading ? (
                  <Skeleton className="h-5 w-24" />
                ) : (
                  `View and manage ${portfolios.length} portfolio${portfolios.length !== 1 ? 's' : ''}`
                )}
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        {/* Run Backtest */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
          <Link href="/backtests">
            <CardHeader>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-xl">Backtests</CardTitle>
              <CardDescription>
                View results and run new backtests
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>

      {/* Recent Activity Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Backtests</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/backtests">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <RecentActivity />
        </CardContent>
      </Card>

      {/* Getting Started (if no portfolios) */}
      {!isLoading && portfolios.length === 0 && (
        <Card className="mt-6 border-indigo-200 bg-indigo-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-medium">
                  1
                </span>
                <div>
                  <p className="font-medium">Create your first portfolio</p>
                  <p className="text-muted-foreground">Add ETF symbols and set allocations</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-medium">
                  2
                </span>
                <div>
                  <p className="font-medium">Run a backtest</p>
                  <p className="text-muted-foreground">Test your strategy with historical data</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-medium">
                  3
                </span>
                <div>
                  <p className="font-medium">Analyze results</p>
                  <p className="text-muted-foreground">Review performance metrics and charts</p>
                </div>
              </li>
            </ol>
            <Button className="mt-6 w-full sm:w-auto" asChild>
              <Link href="/portfolios/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Portfolio
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
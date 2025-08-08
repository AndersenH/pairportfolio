'use client'

import * as React from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PortfolioCard } from '@/components/portfolio/portfolio-card'
import { MetricsDisplay } from '@/components/performance/metrics-display'
import { PerformanceChart } from '@/components/charts/performance-chart'
import { AllocationChart } from '@/components/charts/allocation-chart'
import { usePortfolios } from '@/hooks/use-portfolios'
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Activity,
  Briefcase,
  Target,
  Calendar,
  BarChart3,
  ArrowRight,
} from 'lucide-react'
import type { PortfolioWithHoldings, BacktestWithDetails, ChartDataPoint } from '@/types'

// Mock data for demonstration
const mockRecentBacktests: BacktestWithDetails[] = []
const mockPortfolioData: ChartDataPoint[] = []
const mockBenchmarkData: ChartDataPoint[] = []

interface DashboardStatsProps {
  portfolios: PortfolioWithHoldings[]
  isLoading: boolean
}

function DashboardStats({ portfolios, isLoading }: DashboardStatsProps) {
  const stats = React.useMemo(() => {
    if (isLoading || !portfolios.length) {
      return {
        totalPortfolios: 0,
        totalHoldings: 0,
        avgAllocation: 0,
        fullyAllocated: 0,
      }
    }

    const totalHoldings = portfolios.reduce(
      (sum, p) => sum + p.holdings.length,
      0
    )
    
    const allocations = portfolios.map(p =>
      p.holdings.reduce((sum, h) => sum + Number(h.allocation), 0)
    )
    
    const avgAllocation = allocations.reduce((sum, a) => sum + a, 0) / allocations.length
    const fullyAllocated = allocations.filter(a => a >= 0.99).length

    return {
      totalPortfolios: portfolios.length,
      totalHoldings,
      avgAllocation: avgAllocation * 100,
      fullyAllocated,
    }
  }, [portfolios, isLoading])

  const statCards = [
    {
      title: 'Total Portfolios',
      value: stats.totalPortfolios,
      icon: Briefcase,
      trend: 'up' as const,
      subtitle: 'Active portfolios',
    },
    {
      title: 'Total Holdings',
      value: stats.totalHoldings,
      icon: Target,
      subtitle: 'Unique ETF positions',
    },
    {
      title: 'Avg Allocation',
      value: `${stats.avgAllocation.toFixed(1)}%`,
      icon: Activity,
      trend: stats.avgAllocation > 95 ? 'up' as const : 'neutral' as const,
      subtitle: 'Portfolio allocation',
    },
    {
      title: 'Fully Allocated',
      value: stats.fullyAllocated,
      icon: TrendingUp,
      trend: 'up' as const,
      subtitle: 'Ready for backtesting',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stat.value}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {stat.subtitle}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button className="w-full justify-start" asChild>
          <Link href="/portfolios/new" as="/portfolios/new">
            <Briefcase className="h-4 w-4 mr-2" />
            Create New Portfolio
          </Link>
        </Button>
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href="/backtests/new" as="/backtests/new">
            <BarChart3 className="h-4 w-4 mr-2" />
            Run Backtest
          </Link>
        </Button>
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href="/market-data" as="/market-data">
            <Activity className="h-4 w-4 mr-2" />
            Browse Market Data
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/backtests" as="/backtests">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {mockRecentBacktests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recent backtests</p>
            <p className="text-sm">Create a portfolio and run your first backtest</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mockRecentBacktests.slice(0, 5).map((backtest) => (
              <div
                key={backtest.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="space-y-1">
                  <div className="font-medium">{backtest.portfolio.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {backtest.strategy.name} strategy
                  </div>
                </div>
                <div className="text-right">
                  {backtest.metrics && backtest.metrics.totalReturn !== null ? (
                    <Badge
                      variant={
                        Number(backtest.metrics.totalReturn) > 0 ? 'success' : 'destructive'
                      }
                    >
                      {Number(backtest.metrics.totalReturn) > 0 ? '+' : ''}
                      {(Number(backtest.metrics.totalReturn) * 100).toFixed(1)}%
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Running</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { data: portfoliosData, isLoading } = usePortfolios(1, 10)
  const portfolios = portfoliosData?.data || []

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of your ETF portfolio performance and analysis
            </p>
          </div>
          <Button asChild>
            <Link href="/portfolios/new" as="/portfolios/new">
              <Plus className="h-4 w-4 mr-2" />
              New Portfolio
            </Link>
          </Button>
        </div>

        {/* Dashboard Stats */}
        <DashboardStats portfolios={portfolios} isLoading={isLoading} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Portfolio Performance */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {mockPortfolioData.length > 0 ? (
                  <PerformanceChart
                    data={mockPortfolioData}
                    benchmark={mockBenchmarkData.length > 0 ? mockBenchmarkData : undefined}
                    benchmarkSymbol={mockBenchmarkData.length > 0 ? "SPY" : undefined} // Only show benchmark if data exists
                    title=""
                    height={300}
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No performance data available</p>
                      <p className="text-sm">Run a backtest to see portfolio performance</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Benchmark comparisons will be available after running backtests
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Portfolios */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Portfolios</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/portfolios" as="/portfolios">
                      View All
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : portfolios.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No portfolios created yet</p>
                    <Button className="mt-4" asChild>
                      <Link href="/portfolios/new" as="/portfolios/new">
                        Create Your First Portfolio
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {portfolios.slice(0, 3).map((portfolio) => (
                      <PortfolioCard
                        key={portfolio.id}
                        portfolio={portfolio}
                        variant="compact"
                        onBacktest={() => {
                          // Navigate to backtest page with portfolio pre-selected
                          window.location.href = `/backtests/new?portfolio=${portfolio.id}`
                        }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <QuickActions />

            {/* Recent Activity */}
            <RecentActivity />

            {/* Portfolio Allocation Overview */}
            {portfolios.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Latest Portfolio</CardTitle>
                </CardHeader>
                <CardContent>
                  <AllocationChart
                    holdings={portfolios[0]?.holdings || []}
                    title=""
                    size="sm"
                    showLegend={false}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
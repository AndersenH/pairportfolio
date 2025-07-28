'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SearchDropdown } from '@/components/ui/search-dropdown'
import Link from 'next/link'
import { TrendingUp, BarChart3, PieChart, Search, Star, Play, Trash2, Download, Share2, AlertCircle, Loader2, X, Menu } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend } from 'recharts'
import { PerformanceChart } from '@/components/charts/performance-chart' 
import { AllocationChart } from '@/components/charts/allocation-chart'
import { AssetPerformanceDemo } from '@/components/performance/asset-performance-demo'
import { AssetPerformanceTablePython } from '@/components/performance/asset-performance-table-python'
import { useMobileResponsive } from '@/lib/client-utils'
// Simple toast replacement for now
const useToast = () => ({
  toast: ({ title, description, variant }: { title: string; description: string; variant?: string }) => {
    console.log(`${variant === 'destructive' ? 'ERROR' : 'INFO'}: ${title} - ${description}`)
    // You can replace this with a proper toast implementation later
    if (variant === 'destructive') {
      alert(`Error: ${description}`)
    }
  }
})

interface PortfolioItem {
  symbol: string
  name: string
  allocation: number
  color?: string
}

interface PopularETF {
  symbol: string
  name: string
  type: string
  color: string
}

interface SearchResult {
  symbol: string
  name: string
  exchangeShortName: string
  type?: string
  currency?: string
}

interface BacktestResult {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  message?: string
  finalValue?: number
  totalReturn?: number
  annualizedReturn?: number
  volatility?: number
  sharpeRatio?: number
  maxDrawdown?: number
  portfolioValue?: number[]
  dates?: string[]
  holdings?: Record<string, any[]> // Holdings contains time series objects, not just numbers
  returns?: number[]
  drawdown?: number[]
  performanceMetrics?: {
    totalReturn?: number
    annualizedReturn?: number
    volatility?: number
    sharpeRatio?: number
    maxDrawdown?: number
  }
  assetPerformance?: AssetPerformanceMetrics[] // Pre-calculated asset performance data
  assetPrices?: Record<string, number[]> // Individual asset price data
}

interface BacktestError {
  code: string
  message: string
  details?: any
}

interface AssetPerformanceMetrics {
  symbol: string
  totalReturn: number
  annualizedReturn: number
  volatility: number
  sharpeRatio: number
  maxDrawdown: number
}

const popularETFs: PopularETF[] = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'S&P 500', color: 'from-blue-50 to-blue-100 border-blue-200 text-blue-700' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'NASDAQ', color: 'from-green-50 to-green-100 border-green-200 text-green-700' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market', type: 'Total Market', color: 'from-purple-50 to-purple-100 border-purple-200 text-purple-700' },
  { symbol: 'BND', name: 'Vanguard Total Bond Market', type: 'Bonds', color: 'from-orange-50 to-orange-100 border-orange-200 text-orange-700' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', type: 'Gold', color: 'from-yellow-50 to-yellow-100 border-yellow-200 text-yellow-700' },
  { symbol: 'VXUS', name: 'Vanguard Total International Stock', type: 'International', color: 'from-red-50 to-red-100 border-red-200 text-red-700' }
]

// Color scheme for charts - indigo theme with good contrast
const CHART_COLORS = [
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#ec4899', // pink-500
  '#84cc16', // lime-500
]

// Format chart data for performance line chart
const formatPerformanceData = (portfolioValue: number[], dates: string[]) => {
  if (!portfolioValue || !dates || portfolioValue.length !== dates.length) {
    return []
  }
  
  const baseValue = portfolioValue[0] || 1
  return portfolioValue.map((value, index) => {
    const date = dates[index] || ''
    return {
      date,
      value: value / baseValue, // Normalize to show percentage returns
      formattedDate: date ? new Date(date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }) : ''
    }
  })
}

// Format holdings data for performance chart
const formatHoldingsData = (holdings: Record<string, number[]>, dates: string[]) => {
  if (!holdings || !dates) {
    return {}
  }
  
  const formattedHoldings: Record<string, any[]> = {}
  
  Object.entries(holdings).forEach(([symbol, values]) => {
    if (values && values.length > 0) {
      const baseValue = values[0] || 1
      formattedHoldings[symbol] = values.map((value, index) => ({
        date: dates[index] || '',
        value: value / baseValue, // Normalize to show percentage returns
      }))
    }
  })
  
  return formattedHoldings
}

// Format allocation data for pie chart
const formatAllocationData = (portfolioItems: PortfolioItem[]) => {
  return portfolioItems
    .filter(item => item.allocation > 0)
    .map((item, index) => ({
      symbol: item.symbol,
      name: item.name,
      allocation: item.allocation,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }))
}

// Convert holdings time series data to weights format expected by AssetPerformanceTablePython
const convertHoldingsToWeights = (holdings: Record<string, any[]>): Record<string, number[]> => {
  const weights: Record<string, number[]> = {}
  
  // Convert holdings time series to weight arrays
  Object.keys(holdings).forEach(symbol => {
    const holdingTimeSeries = holdings[symbol]
    if (Array.isArray(holdingTimeSeries)) {
      // Extract weight values from time series objects
      weights[symbol] = holdingTimeSeries.map(point => {
        if (typeof point === 'object' && point !== null) {
          return point.weight || point.value || 0
        }
        return typeof point === 'number' ? point : 0
      })
    } else {
      weights[symbol] = []
    }
  })
  
  return weights
}

// Calculate performance metrics for individual assets
const calculateAssetPerformanceMetrics = (
  symbol: string, 
  values: number[], 
  dates: string[]
): AssetPerformanceMetrics => {
  if (!values || values.length === 0 || !dates || dates.length === 0) {
    return {
      symbol,
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    }
  }

  // Validate data
  const validValues = values.filter(v => isFinite(v) && v > 0);
  if (validValues.length < 2) {
    return {
      symbol,
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    }
  }

  try {
    // Calculate total return
    const initialValue = values[0] || 0
    const finalValue = values[values.length - 1] || 0
    
    if (!isFinite(initialValue) || !isFinite(finalValue) || initialValue <= 0) {
      throw new Error('Invalid initial or final values');
    }
    
    const totalReturn = (finalValue - initialValue) / initialValue

    // Calculate annualized return
    const startDate = new Date(dates[0])
    const endDate = new Date(dates[dates.length - 1])
    const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    
    if (years <= 0) {
      throw new Error('Invalid date range');
    }
    
    const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0

    // Calculate daily returns for volatility and Sharpe ratio
    const dailyReturns = []
    for (let i = 1; i < values.length; i++) {
      const prevValue = values[i - 1];
      const currentValue = values[i];
      if (isFinite(prevValue) && isFinite(currentValue) && prevValue > 0) {
        dailyReturns.push((currentValue - prevValue) / prevValue)
      }
    }

    if (dailyReturns.length === 0) {
      throw new Error('No valid daily returns calculated');
    }

    // Calculate volatility (standard deviation of daily returns, annualized)
    const meanReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length
    const variance = dailyReturns.length > 1 ? 
      dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / (dailyReturns.length - 1) : 0
    const volatility = Math.sqrt(variance * 252) // Annualized (252 trading days)

    // Calculate Sharpe ratio (assuming 2% risk-free rate)
    const riskFreeRate = 0.02
    const sharpeRatio = isFinite(volatility) && volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0

    // Calculate maximum drawdown
    let maxDrawdown = 0
    let peak = values[0]
    for (const value of values) {
      if (isFinite(value) && value > peak) {
        peak = value
      }
      if (isFinite(value) && peak > 0) {
        const drawdown = (peak - value) / peak
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown
        }
      }
    }

    return {
      symbol,
      totalReturn: isFinite(totalReturn) ? totalReturn : 0,
      annualizedReturn: isFinite(annualizedReturn) ? annualizedReturn : 0,
      volatility: isFinite(volatility) ? volatility : 0,
      sharpeRatio: isFinite(sharpeRatio) ? sharpeRatio : 0,
      maxDrawdown: isFinite(maxDrawdown) ? maxDrawdown : 0
    }
  } catch (error) {
    console.warn(`Error calculating performance for ${symbol}:`, error);
    return {
      symbol,
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    }
  }
}


// Custom tooltip for allocation chart
const AllocationTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900">{data.symbol}</p>
        <p className="text-xs text-gray-600 mb-1">{data.name}</p>
        <p className="text-sm text-indigo-600">
          Allocation: <span className="font-bold">{data.allocation.toFixed(1)}%</span>
        </p>
      </div>
    )
  }
  return null
}

export default function HomePage() {
  const { isMobile, isTablet, isTouch, width, height } = useMobileResponsive()
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([
    { symbol: 'VTI', name: 'Vanguard Total Stock Market', allocation: 50 },
    { symbol: 'BND', name: 'Vanguard Total Bond Market', allocation: 50 }
  ])
  const [portfolioName, setPortfolioName] = useState('My ETF Portfolio')
  const [initialInvestment, setInitialInvestment] = useState(10000)
  const [strategy, setStrategy] = useState('buy-hold')
  const [strategyParameters, setStrategyParameters] = useState({
    momentum: {
      lookbackPeriod: 3,
      rebalanceFrequency: 'monthly',
      topN: 3
    },
    'relative-strength': {
      lookbackPeriod: 6,
      rebalanceFrequency: 'monthly',
      topN: 2,
      benchmarkSymbol: 'SPY'
    },
    'mean-reversion': {
      lookbackPeriod: 1,
      rebalanceFrequency: 'weekly',
      zScoreThreshold: 1.5
    },
    'risk-parity': {
      lookbackPeriod: 6,
      rebalanceFrequency: 'monthly',
      targetVolatility: 10
    }
  })
  const [isRunning, setIsRunning] = useState(false)
  const [startDate, setStartDate] = useState('2019-01-01')
  const [endDate, setEndDate] = useState('2024-01-01')
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showIndividualAssets, setShowIndividualAssets] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { toast } = useToast()

  const addETFToPortfolio = (etf: PopularETF) => {
    const exists = portfolioItems.find(item => item.symbol === etf.symbol)
    if (exists) return

    const newItems = [...portfolioItems, {
      symbol: etf.symbol,
      name: etf.name,
      allocation: 0
    }]
    setPortfolioItems(newItems)
    rebalancePortfolio(newItems)
  }

  const addSearchResultToPortfolio = (result: SearchResult) => {
    const exists = portfolioItems.find(item => item.symbol === result.symbol)
    if (exists) {
      toast({
        title: "Already Added",
        description: `${result.symbol} is already in your portfolio.`,
        variant: "destructive",
      })
      return
    }

    const newItems = [...portfolioItems, {
      symbol: result.symbol,
      name: result.name,
      allocation: 0
    }]
    setPortfolioItems(newItems)
    rebalancePortfolio(newItems)
    
    toast({
      title: "Added to Portfolio",
      description: `${result.symbol} (${result.name}) has been added to your portfolio.`,
    })
  }

  const removeFromPortfolio = (symbol: string) => {
    const newItems = portfolioItems.filter(item => item.symbol !== symbol)
    setPortfolioItems(newItems)
    rebalancePortfolio(newItems)
  }

  const rebalancePortfolio = (items: PortfolioItem[]) => {
    if (items.length === 0) return
    const equalWeight = Math.round((100 / items.length) * 100) / 100
    const updatedItems = items.map((item, index) => ({
      ...item,
      allocation: index === items.length - 1 ? 100 - (equalWeight * (items.length - 1)) : equalWeight
    }))
    setPortfolioItems(updatedItems)
  }

  const updateAllocation = (symbol: string, allocation: number) => {
    setPortfolioItems(prev => prev.map(item => 
      item.symbol === symbol ? { ...item, allocation } : item
    ))
  }

  const handleRunBacktest = async () => {
    if (portfolioItems.length === 0) {
      toast({
        title: "No Holdings",
        description: "Please add at least one ETF to your portfolio.",
        variant: "destructive",
      })
      return
    }

    if (Math.abs(totalAllocation - 100) > 0.1) {
      toast({
        title: "Invalid Allocation",
        description: "Portfolio allocation must equal 100%.",
        variant: "destructive",
      })
      return
    }

    setIsRunning(true)
    setError(null)
    setBacktestResult(null)

    try {
      const backtestData = {
        name: portfolioName,
        holdings: portfolioItems.map(item => ({
          symbol: item.symbol,
          allocation: item.allocation / 100, // Convert percentage to decimal
        })),
        startDate,
        endDate,
        initialCapital: initialInvestment,
        strategy,
        strategyParameters: strategy !== 'buy-hold' ? strategyParameters[strategy as keyof typeof strategyParameters] : undefined,
      }

      console.log('Attempting backtest with data:', backtestData)

      // Try demo-backtest first (with real market data), then fall back to simple-backtest
      let response = await fetch('/api/demo-backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backtestData),
      })

      // If demo-backtest fails, try simple-backtest as fallback
      if (!response.ok) {
        console.log('Demo backtest failed, trying simple backtest fallback')
        response = await fetch('/api/simple-backtest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(backtestData),
        })
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to run backtest')
      }

      const result = await response.json()
      const backtest = result.data

      console.log('Backtest result received:', {
        id: backtest.id,
        status: backtest.status,
        portfolioValueLength: backtest.portfolioValue?.length,
        totalReturn: backtest.performanceMetrics?.totalReturn,
        assetPerformanceLength: backtest.assetPerformance?.length || 0,
        hasAssetPrices: !!(backtest.assetPrices && Object.keys(backtest.assetPrices).length > 0)
      })

      // Set results immediately - handle both API response formats
      const metrics = backtest.performanceMetrics || backtest
      setBacktestResult({
        id: backtest.id,
        status: backtest.status,
        finalValue: metrics.totalReturn 
          ? initialInvestment * (1 + metrics.totalReturn)
          : undefined,
        totalReturn: metrics.totalReturn,
        annualizedReturn: metrics.annualizedReturn,
        volatility: metrics.volatility,
        sharpeRatio: metrics.sharpeRatio,
        maxDrawdown: metrics.maxDrawdown,
        portfolioValue: backtest.portfolioValue,
        dates: backtest.dates,
        holdings: backtest.holdings,
        returns: backtest.returns,
        drawdown: backtest.drawdown,
        performanceMetrics: metrics,
        assetPerformance: backtest.assetPerformance || [], // Include pre-calculated asset performance
        assetPrices: backtest.assetPrices || null // Include individual asset price data
      })

      toast({
        title: "Backtest Completed",
        description: "Your backtest results are now available.",
      })

    } catch (error) {
      console.error('Backtest error:', error)
      setError(error instanceof Error ? error.message : 'Unknown error occurred')
      toast({
        title: "Backtest Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      })
    } finally {
      setIsRunning(false)
    }
  }

  const totalAllocation = portfolioItems.reduce((sum, item) => sum + item.allocation, 0)
  
  // Computed chart data
  const performanceData = backtestResult && backtestResult.portfolioValue && backtestResult.dates 
    ? formatPerformanceData(backtestResult.portfolioValue, backtestResult.dates)
    : []
  
  const holdingsData = backtestResult && backtestResult.holdings && backtestResult.dates
    ? formatHoldingsData(backtestResult.holdings, backtestResult.dates)
    : {}
  
  const allocationData = formatAllocationData(portfolioItems)

  // Calculate asset performance metrics
  const assetPerformanceMetrics: AssetPerformanceMetrics[] = useMemo(() => {
    if (!backtestResult?.holdings || !backtestResult?.dates) {
      return []
    }

    return portfolioItems
      .filter(item => item.allocation > 0)
      .map(item => {
        const holdingValues = backtestResult.holdings![item.symbol]
        if (!holdingValues) {
          return {
            symbol: item.symbol,
            totalReturn: 0,
            annualizedReturn: 0,
            volatility: 0,
            sharpeRatio: 0,
            maxDrawdown: 0
          }
        }
        return calculateAssetPerformanceMetrics(item.symbol, holdingValues, backtestResult.dates!)
      })
  }, [backtestResult, portfolioItems])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-indigo-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 md:py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <TrendingUp className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
              <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>ETF Replay</h1>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-6">
              <Link href="#" className="hover:text-indigo-200 transition">Home</Link>
              <Link href="#" className="hover:text-indigo-200 transition">Explore ETFs</Link>
              <Link href="#" className="hover:text-indigo-200 transition">Strategies</Link>
              <Link href="#" className="hover:text-indigo-200 transition">About</Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 hover:bg-indigo-600 rounded transition"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-4 pt-4 border-t border-indigo-600">
              <div className="flex flex-col space-y-3">
                <Link href="#" className="hover:text-indigo-200 transition py-2">Home</Link>
                <Link href="#" className="hover:text-indigo-200 transition py-2">Explore ETFs</Link>
                <Link href="#" className="hover:text-indigo-200 transition py-2">Strategies</Link>
                <Link href="#" className="hover:text-indigo-200 transition py-2">About</Link>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={`container mx-auto px-4 ${isMobile ? 'py-4' : 'py-8'}`}>
        <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3 gap-8'}`}>
          {/* Portfolio Builder Section */}
          <div className={`${isMobile ? 'order-1' : 'lg:col-span-1'}`}>
            <Card className={`${isMobile ? 'p-4' : 'p-6'} ${isMobile ? '' : 'lg:sticky lg:top-4'}`} style={{ maxHeight: isMobile ? 'none' : '90vh', overflowY: isMobile ? 'visible' : 'auto' }}>
              <CardHeader className="px-0 pt-0">
                <CardTitle className={`text-indigo-700 flex items-center gap-2 ${isMobile ? 'text-lg' : ''}`}>
                  <PieChart className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                  Portfolio Builder
                </CardTitle>
              </CardHeader>
              <CardContent className={`px-0 ${isMobile ? 'space-y-4' : 'space-y-6'}`}>
                {/* Portfolio Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Portfolio Name</label>
                  <Input 
                    value={portfolioName}
                    onChange={(e) => setPortfolioName(e.target.value)}
                    placeholder="My ETF Portfolio"
                  />
                </div>

                {/* Initial Investment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Initial Investment ($)</label>
                  <Input 
                    type="number"
                    value={initialInvestment}
                    onChange={(e) => setInitialInvestment(Number(e.target.value))}
                    min={100}
                  />
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                  <div className={`${isMobile ? 'space-y-2' : 'flex space-x-2'}`}>
                    <Input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={isMobile ? 'w-full' : ''}
                    />
                    <span className={`flex items-center text-sm text-gray-500 ${isMobile ? 'justify-center py-1' : ''}`}>to</span>
                    <Input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}  
                      className={isMobile ? 'w-full' : ''}
                    />
                  </div>
                </div>

                {/* Strategy Type */}
                <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
                  <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Strategy Type
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                  >
                    <option value="buy-hold">Buy & Hold</option>
                    <option value="momentum">Momentum</option>
                    <option value="relative-strength">Relative Strength</option>
                    <option value="mean-reversion">Mean Reversion</option>
                    <option value="risk-parity">Risk Parity</option>
                  </select>
                </div>

                {/* Strategy Parameters */}
                {strategy !== 'buy-hold' && (
                  <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Strategy Parameters
                    </label>
                    
                    {strategy === 'momentum' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Lookback Period (months)
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="12"
                            value={strategyParameters.momentum.lookbackPeriod}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              momentum: { ...prev.momentum, lookbackPeriod: parseInt(e.target.value) }
                            }))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>1</span>
                            <span className="font-medium text-indigo-600">
                              {strategyParameters.momentum.lookbackPeriod} months
                            </span>
                            <span>12</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Rebalance Frequency
                          </label>
                          <select
                            value={strategyParameters.momentum.rebalanceFrequency}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              momentum: { ...prev.momentum, rebalanceFrequency: e.target.value as 'weekly' | 'monthly' | 'quarterly' }
                            }))}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Top N Holdings
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={strategyParameters.momentum.topN}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              momentum: { ...prev.momentum, topN: parseInt(e.target.value) }
                            }))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>1</span>
                            <span className="font-medium text-indigo-600">
                              {strategyParameters.momentum.topN} assets
                            </span>
                            <span>10</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {strategy === 'relative-strength' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Lookback Period (months)
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="12"
                            value={strategyParameters['relative-strength'].lookbackPeriod}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              'relative-strength': { ...prev['relative-strength'], lookbackPeriod: parseInt(e.target.value) }
                            }))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>1</span>
                            <span className="font-medium text-indigo-600">
                              {strategyParameters['relative-strength'].lookbackPeriod} months
                            </span>
                            <span>12</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Rebalance Frequency
                          </label>
                          <select
                            value={strategyParameters['relative-strength'].rebalanceFrequency}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              'relative-strength': { ...prev['relative-strength'], rebalanceFrequency: e.target.value as 'weekly' | 'monthly' | 'quarterly' }
                            }))}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Top N Holdings
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={strategyParameters['relative-strength'].topN}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              'relative-strength': { ...prev['relative-strength'], topN: parseInt(e.target.value) }
                            }))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>1</span>
                            <span className="font-medium text-indigo-600">
                              {strategyParameters['relative-strength'].topN} assets
                            </span>
                            <span>5</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Benchmark Symbol
                          </label>
                          <Input
                            type="text"
                            value={strategyParameters['relative-strength'].benchmarkSymbol}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              'relative-strength': { ...prev['relative-strength'], benchmarkSymbol: e.target.value.toUpperCase() }
                            }))}
                            placeholder="SPY"
                            className="text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {strategy === 'mean-reversion' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Lookback Period (months)
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="6"
                            value={strategyParameters['mean-reversion'].lookbackPeriod}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              'mean-reversion': { ...prev['mean-reversion'], lookbackPeriod: parseInt(e.target.value) }
                            }))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>1</span>
                            <span className="font-medium text-indigo-600">
                              {strategyParameters['mean-reversion'].lookbackPeriod} months
                            </span>
                            <span>6</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Rebalance Frequency
                          </label>
                          <select
                            value={strategyParameters['mean-reversion'].rebalanceFrequency}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              'mean-reversion': { ...prev['mean-reversion'], rebalanceFrequency: e.target.value as 'weekly' | 'monthly' | 'quarterly' }
                            }))}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Z-Score Threshold
                          </label>
                          <input
                            type="range"
                            min="0.5"
                            max="3.0"
                            step="0.1"
                            value={strategyParameters['mean-reversion'].zScoreThreshold}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              'mean-reversion': { ...prev['mean-reversion'], zScoreThreshold: parseFloat(e.target.value) }
                            }))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0.5</span>
                            <span className="font-medium text-indigo-600">
                              {strategyParameters['mean-reversion'].zScoreThreshold.toFixed(1)}σ
                            </span>
                            <span>3.0</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {strategy === 'risk-parity' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Lookback Period (months)
                          </label>
                          <input
                            type="range"
                            min="3"
                            max="12"
                            value={strategyParameters['risk-parity'].lookbackPeriod}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              'risk-parity': { ...prev['risk-parity'], lookbackPeriod: parseInt(e.target.value) }
                            }))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>3</span>
                            <span className="font-medium text-indigo-600">
                              {strategyParameters['risk-parity'].lookbackPeriod} months
                            </span>
                            <span>12</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Rebalance Frequency
                          </label>
                          <select
                            value={strategyParameters['risk-parity'].rebalanceFrequency}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              'risk-parity': { ...prev['risk-parity'], rebalanceFrequency: e.target.value as 'weekly' | 'monthly' | 'quarterly' }
                            }))}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Target Volatility (%)
                          </label>
                          <input
                            type="range"
                            min="5"
                            max="20"
                            value={strategyParameters['risk-parity'].targetVolatility}
                            onChange={(e) => setStrategyParameters(prev => ({
                              ...prev,
                              'risk-parity': { ...prev['risk-parity'], targetVolatility: parseInt(e.target.value) }
                            }))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>5%</span>
                            <span className="font-medium text-indigo-600">
                              {strategyParameters['risk-parity'].targetVolatility}%
                            </span>
                            <span>20%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Popular ETFs */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    Popular ETFs
                  </label>
                  <div className={`grid gap-2 mb-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-2'}`}>
                    {popularETFs.map((etf) => (
                      <button
                        key={etf.symbol}
                        onClick={() => addETFToPortfolio(etf)}
                        className={`${isMobile ? 'p-2' : 'p-3'} bg-gradient-to-r ${etf.color} border rounded-lg hover:scale-105 transition-all duration-200 text-left ${isTouch ? 'min-h-[44px] touch-manipulation' : ''}`}
                      >
                        <div className={`font-bold ${isMobile ? 'text-sm' : ''}`}>{etf.symbol}</div>
                        <div className={`text-xs ${isMobile ? 'text-xs' : ''}`}>{etf.type}</div>
                      </button>
                    ))}
                  </div>
                  <div className={`text-xs text-gray-500 italic ${isMobile ? 'text-center' : ''}`}>
                    {isMobile ? 'Tap ETFs to add to portfolio' : 'Click any ETF above to quickly add to your portfolio'}
                  </div>
                </div>

                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Search Stocks & ETFs
                  </label>
                  <SearchDropdown
                    placeholder="Search for stocks/ETFs (e.g., AAPL, SPY, QQQ...)"
                    onSelect={addSearchResultToPortfolio}
                    disabled={isRunning}
                  />
                </div>

                {/* Portfolio Items */}
                <div className={`space-y-3 ${isMobile ? 'space-y-2' : ''}`}>
                  {portfolioItems.map((item) => (
                    <div key={item.symbol} className={`bg-gray-100 ${isMobile ? 'p-2' : 'p-3'} rounded-md ${isMobile ? 'space-y-2' : 'flex justify-between items-center'}`}>
                      {isMobile ? (
                        // Mobile layout - stacked
                        <>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                              <span className="font-medium text-sm">{item.symbol}</span>
                              <span className="text-xs text-gray-600 truncate">{item.name}</span>
                            </div>
                            <button 
                              onClick={() => removeFromPortfolio(item.symbol)}
                              className="text-red-500 hover:text-red-700 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                              aria-label={`Remove ${item.symbol}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Allocation:</span>
                            <div className="flex items-center space-x-2">
                              <Input 
                                type="number"
                                className="w-20 h-10 touch-manipulation"
                                value={item.allocation}
                                onChange={(e) => updateAllocation(item.symbol, Number(e.target.value))}
                                min={0}
                                max={100}
                              />
                              <span className="text-sm">%</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        // Desktop layout - inline
                        <>
                          <div className="flex items-center space-x-3">
                            <span className="font-medium">{item.symbol}</span>
                            <span className="text-sm text-gray-600 truncate max-w-32">{item.name}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Input 
                              type="number"
                              className="w-20"
                              value={item.allocation}
                              onChange={(e) => updateAllocation(item.symbol, Number(e.target.value))}
                              min={0}
                              max={100}
                            />
                            <span className="text-sm">%</span>
                            <button 
                              onClick={() => removeFromPortfolio(item.symbol)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Allocation Warning */}
                {Math.abs(totalAllocation - 100) > 0.1 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="text-sm text-yellow-800">
                      Total allocation: {totalAllocation.toFixed(1)}% (should be 100%)
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className={`pt-4 ${isMobile ? 'space-y-3' : 'flex justify-between'}`}>
                  <Button 
                    variant="outline" 
                    onClick={() => setPortfolioItems([])}
                    className={`flex items-center gap-2 ${isMobile ? 'w-full justify-center min-h-[44px] touch-manipulation' : ''}`}
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear Portfolio
                  </Button>
                  <Button 
                    onClick={handleRunBacktest}
                    disabled={isRunning || portfolioItems.length === 0 || Math.abs(totalAllocation - 100) > 0.1}
                    className={`bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2 ${isMobile ? 'w-full justify-center min-h-[44px] touch-manipulation' : ''}`}
                  >
                    {isRunning ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {isMobile ? 'Running...' : 'Running...'}
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        {isMobile ? 'Run Backtest' : 'Run Backtest'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className={`${isMobile ? 'order-2' : 'lg:col-span-2'} ${isMobile ? 'space-y-6' : 'space-y-8'}`}>
            {/* Performance Summary */}
            <Card className={isMobile ? 'p-4' : 'p-6'}>
              <CardHeader className={`px-0 pt-0 ${isMobile ? 'pb-4' : 'pb-6'}`}>
                <div className={`${isMobile ? 'flex-col space-y-3' : 'flex justify-between items-center'}`}>
                  <CardTitle className={`text-indigo-700 ${isMobile ? 'text-lg' : ''}`}>Performance Summary</CardTitle>
                  <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'space-x-2'}`}>
                    <Button variant="outline" size={isMobile ? 'default' : 'sm'} className={`flex items-center gap-2 ${isMobile ? 'w-full justify-center min-h-[44px] touch-manipulation' : ''}`}>
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                    <Button variant="outline" size={isMobile ? 'default' : 'sm'} className={`flex items-center gap-2 ${isMobile ? 'w-full justify-center min-h-[44px] touch-manipulation' : ''}`}>
                      <Share2 className="w-4 h-4" />
                      Share
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0">
                {/* Error Display */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">Backtest Error</span>
                    </div>
                    <div className="text-sm text-red-600 mt-1">{error}</div>
                  </div>
                )}

                <div className={`grid gap-4 mb-6 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
                  <div className={`bg-indigo-50 ${isMobile ? 'p-3' : 'p-4'} rounded-lg text-center hover:scale-105 transition-transform ${isTouch ? 'touch-manipulation' : ''}`}>
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-indigo-600 font-medium`}>Final Value</div>
                    <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
                      {backtestResult?.finalValue 
                        ? `$${backtestResult.finalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                        : isRunning ? '...' : '-'
                      }
                    </div>
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500`}>
                      {backtestResult?.totalReturn 
                        ? `${(backtestResult.totalReturn * 100).toFixed(1)}% total`
                        : isRunning ? 'Computing...' : 'Run backtest'
                      }
                    </div>
                  </div>
                  <div className={`bg-green-50 ${isMobile ? 'p-3' : 'p-4'} rounded-lg text-center hover:scale-105 transition-transform ${isTouch ? 'touch-manipulation' : ''}`}>
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-green-600 font-medium`}>CAGR</div>
                    <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
                      {backtestResult?.annualizedReturn 
                        ? `${(backtestResult.annualizedReturn * 100).toFixed(1)}%`
                        : isRunning ? '...' : '-'
                      }
                    </div>
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500`}>Annualized</div>
                  </div>
                  <div className={`bg-blue-50 ${isMobile ? 'p-3' : 'p-4'} rounded-lg text-center hover:scale-105 transition-transform ${isTouch ? 'touch-manipulation' : ''}`}>
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-blue-600 font-medium`}>Max Drawdown</div>
                    <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
                      {backtestResult?.maxDrawdown 
                        ? `${(backtestResult.maxDrawdown * 100).toFixed(1)}%`
                        : isRunning ? '...' : '-'
                      }
                    </div>
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500`}>Real Data</div>
                  </div>
                  <div className={`bg-purple-50 ${isMobile ? 'p-3' : 'p-4'} rounded-lg text-center hover:scale-105 transition-transform ${isTouch ? 'touch-manipulation' : ''}`}>
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-purple-600 font-medium`}>Sharpe Ratio</div>
                    <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
                      {backtestResult?.sharpeRatio 
                        ? backtestResult.sharpeRatio.toFixed(2)
                        : isRunning ? '...' : '-'
                      }
                    </div>
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500`}>Risk-Adjusted</div>
                  </div>
                </div>
                
                {/* Chart Controls */}
                {performanceData.length > 0 && Object.keys(holdingsData).length > 0 && (
                  <div className={`mb-4 ${isMobile ? 'flex-col space-y-2' : 'flex items-center justify-between'}`}>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="showIndividualAssets"
                        checked={showIndividualAssets}
                        onChange={(e) => setShowIndividualAssets(e.target.checked)}
                        className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 ${isTouch ? 'touch-manipulation' : ''}`}
                      />
                      <label 
                        htmlFor="showIndividualAssets" 
                        className={`${isMobile ? 'text-sm' : 'text-sm'} font-medium text-gray-700 cursor-pointer ${isTouch ? 'min-h-[44px] flex items-center' : ''}`}
                      >
                        Show Individual Assets
                      </label>
                    </div>
                    <div className={`${isMobile ? 'text-xs text-center' : 'text-xs'} text-gray-500`}>
                      {showIndividualAssets 
                        ? `Showing portfolio + ${Object.keys(holdingsData).length} assets`
                        : 'Showing portfolio only'
                      }
                    </div>
                  </div>
                )}
                
                <PerformanceChart
                  data={performanceData}
                  title="Portfolio Performance"
                  holdings={holdingsData}
                  showHoldings={showIndividualAssets}
                  height={isMobile ? 300 : 350}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            {/* Portfolio Allocation */}
            <Card className={isMobile ? 'p-4' : 'p-6'}>
              <CardHeader className="px-0 pt-0">
                <CardTitle className={`text-indigo-700 ${isMobile ? 'text-lg' : ''}`}>Portfolio Allocation</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className={`grid gap-8 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                  <div className={`${isMobile ? 'col-span-1' : 'lg:col-span-1'}`}>
                    {portfolioItems.length > 0 ? (
                      <AllocationChart
                        holdings={portfolioItems.map(item => ({
                          id: item.symbol,
                          symbol: item.symbol,
                          allocation: item.allocation / 100, // Convert to decimal
                          createdAt: new Date(),
                          updatedAt: new Date(),
                          portfolioId: 'temp'
                        }))}
                        title={isMobile ? "Allocation" : "Current Allocation"}
                        size={isMobile ? 'sm' : 'md'}
                        showLegend={!isMobile}
                      />
                    ) : (
                      <div className={`${isMobile ? 'h-48' : 'h-64'} bg-gray-100 rounded-lg flex items-center justify-center`}>
                        <div className="text-center text-gray-500">
                          <PieChart className={`${isMobile ? 'w-8 h-8' : 'w-12 h-12'} mx-auto mb-2 opacity-50`} />
                          <div className={`font-medium ${isMobile ? 'text-sm' : ''}`}>Portfolio Allocation Chart</div>
                          <div className={`text-sm mt-1 ${isMobile ? 'text-xs' : ''}`}>
                            {portfolioItems.length === 0 
                              ? 'Add ETFs to see interactive allocation breakdown'
                              : 'Adjust allocations to see pie chart'
                            }
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Quick Performance Summary */}
                  {!isMobile && (
                    <div className="lg:col-span-1">
                      <h3 className="font-medium mb-4">Quick Summary</h3>
                      {assetPerformanceMetrics.length > 0 ? (
                        <div className="space-y-3">
                          {assetPerformanceMetrics.slice(0, 5).map((metrics, index) => {
                            const colorIndex = index % CHART_COLORS.length
                            const itemColor = CHART_COLORS[colorIndex]
                            return (
                              <div key={metrics.symbol} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <div 
                                    className="w-3 h-3 rounded-full flex-shrink-0" 
                                    style={{ backgroundColor: itemColor }}
                                  />
                                  <span className="text-sm font-medium text-gray-900">
                                    {metrics.symbol}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-medium ${metrics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {isFinite(metrics.totalReturn) ? (metrics.totalReturn * 100).toFixed(1) : '0.0'}%
                                  </div>
                                  <div className="text-xs text-gray-500">Total Return</div>
                                </div>     
                              </div>
                            )
                          })}
                          {assetPerformanceMetrics.length > 5 && (
                            <div className="text-xs text-gray-500 text-center">
                              +{assetPerformanceMetrics.length - 5} more assets
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-gray-100 rounded-lg p-6 text-center">
                          <div className="text-gray-500">
                            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <div className="font-medium">Performance Metrics</div>
                            <div className="text-sm mt-1">
                              {portfolioItems.length === 0 
                                ? 'Add ETFs to see performance breakdown'
                                : 'Run backtest to see asset performance'
                              }
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Python-Enhanced Asset Performance */}
            {backtestResult && 
             backtestResult.portfolioValue?.length > 0 && 
             backtestResult.holdings && 
             Object.keys(backtestResult.holdings).length > 0 && (
              <AssetPerformanceTablePython
                results={{
                  portfolioValues: backtestResult.portfolioValue,
                  returns: backtestResult.returns || [],
                  dates: backtestResult.dates || [],
                  weights: convertHoldingsToWeights(backtestResult.holdings),
                  metrics: {
                    totalReturn: backtestResult.totalReturn || 0,
                    annualizedReturn: backtestResult.annualizedReturn || 0,
                    volatility: backtestResult.volatility || 0,
                    sharpeRatio: backtestResult.sharpeRatio || 0,
                    maxDrawdown: backtestResult.maxDrawdown || 0,
                    maxDrawdownDuration: 0,
                    sortinoRatio: 0,
                    calmarRatio: 0,
                    var95: 0,
                    cvar95: 0,
                    winRate: 0,
                    profitFactor: 0
                  },
                  drawdown: backtestResult.drawdown || [],
                  assetPrices: backtestResult.assetPrices || null
                }}
                portfolioAllocation={portfolioItems.reduce((acc, item) => {
                  acc[item.symbol] = item.allocation / 100;
                  return acc;
                }, {} as Record<string, number>)}
                preCalculatedAssetPerformance={backtestResult.assetPerformance || []} // Pass pre-calculated data
                usePython={true}
              />
            )}

            {/* Features */}
            <Card className={isMobile ? 'p-4' : 'p-6'}>
              <CardHeader className="px-0 pt-0">
                <CardTitle className={`text-gray-900 ${isMobile ? 'text-lg' : ''}`}>Platform Features</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  <ul className={`space-y-3 ${isMobile ? 'space-y-2' : ''}`}>
                    <li className={`flex items-center gap-3 ${isMobile ? 'text-sm' : ''}`}>
                      <div className={`${isMobile ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-indigo-500 rounded-full flex-shrink-0`}></div>
                      <span>Real market data integration</span>
                    </li>
                    <li className={`flex items-center gap-3 ${isMobile ? 'text-sm' : ''}`}>
                      <div className={`${isMobile ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-indigo-500 rounded-full flex-shrink-0`}></div>
                      <span>Multiple backtesting strategies</span>
                    </li>
                    <li className={`flex items-center gap-3 ${isMobile ? 'text-sm' : ''}`}>
                      <div className={`${isMobile ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-indigo-500 rounded-full flex-shrink-0`}></div>
                      <span>Comprehensive performance metrics</span>
                    </li>
                  </ul>
                  {!isMobile && (
                    <ul className="space-y-3">
                      <li className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0"></div>
                        <span>Interactive charts and visualizations</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0"></div>
                        <span>Portfolio risk analysis</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0"></div>
                        <span>Export and sharing capabilities</span>
                      </li>
                    </ul>
                  )}
                  {isMobile && (
                    <ul className="space-y-2">
                      <li className="flex items-center gap-3 text-sm">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0"></div>
                        <span>Interactive mobile-optimized charts</span>
                      </li>
                      <li className="flex items-center gap-3 text-sm">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0"></div>
                        <span>Touch-friendly interface</span>
                      </li>
                      <li className="flex items-center gap-3 text-sm">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0"></div>
                        <span>Export and sharing capabilities</span>
                      </li>
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={`bg-gray-800 text-white ${isMobile ? 'py-6 mt-8' : 'py-8 mt-16'}`}>
        <div className="container mx-auto px-4">
          <div className={`grid gap-8 ${isMobile ? 'grid-cols-1 gap-6' : 'grid-cols-1 md:grid-cols-4'}`}>
            <div className={isMobile ? 'text-center' : ''}>
              <h3 className={`${isMobile ? 'text-lg' : 'text-lg'} font-semibold mb-4`}>ETF Replay</h3>
              <p className={`text-gray-400 ${isMobile ? 'text-sm' : ''}`}>
                Empowering investors with powerful backtesting tools to make informed decisions.
              </p>
            </div>
            
            {isMobile ? (
              // Mobile simplified footer
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-base font-semibold mb-3">Quick Links</h3>
                  <ul className="space-y-2">
                    <li><Link href="#" className="text-gray-400 hover:text-white transition text-sm">Documentation</Link></li>
                    <li><Link href="#" className="text-gray-400 hover:text-white transition text-sm">Terms</Link></li>
                    <li><Link href="#" className="text-gray-400 hover:text-white transition text-sm">Privacy</Link></li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold mb-3">Connect</h3>
                  <div className="flex space-x-4">
                    <Link 
                      href="#" 
                      className="text-gray-400 hover:text-white transition p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                      aria-label="Twitter"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                    </Link>
                    <Link 
                      href="#" 
                      className="text-gray-400 hover:text-white transition p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                      aria-label="LinkedIn"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </Link>
                    <Link 
                      href="#" 
                      className="text-gray-400 hover:text-white transition p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                      aria-label="GitHub"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              // Desktop full footer
              <>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Resources</h3>
                  <ul className="space-y-2">
                    <li><Link href="#" className="text-gray-400 hover:text-white transition">Documentation</Link></li>
                    <li><Link href="#" className="text-gray-400 hover:text-white transition">API</Link></li>
                    <li><Link href="#" className="text-gray-400 hover:text-white transition">Tutorials</Link></li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Legal</h3>
                  <ul className="space-y-2">
                    <li><Link href="#" className="text-gray-400 hover:text-white transition">Terms of Service</Link></li>
                    <li><Link href="#" className="text-gray-400 hover:text-white transition">Privacy Policy</Link></li>
                    <li><Link href="#" className="text-gray-400 hover:text-white transition">Disclaimer</Link></li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Connect</h3>
                  <div className="flex space-x-4">
                    <Link href="#" className="text-gray-400 hover:text-white transition">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                    </Link>
                    <Link href="#" className="text-gray-400 hover:text-white transition">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </Link>
                    <Link href="#" className="text-gray-400 hover:text-white transition">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className={`border-t border-gray-700 mt-8 pt-8 text-center text-gray-400 ${isMobile ? 'mt-6 pt-6' : ''}`}>
            <p className={isMobile ? 'text-sm' : ''}>© 2024 ETF Replay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
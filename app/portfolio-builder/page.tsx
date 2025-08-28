'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SearchDropdown } from '@/components/ui/search-dropdown'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { TrendingUp, BarChart3, PieChart, Search, Star, Play, Trash2, Download, Share2, AlertCircle, Loader2, X, Menu, Save, ArrowLeft } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend } from 'recharts'
import { PerformanceChart } from '@/components/charts/performance-chart' 
import { AllocationChart } from '@/components/charts/allocation-chart'
import { AssetPerformanceDemo } from '@/components/performance/asset-performance-demo'
import { AssetPerformanceTablePython } from '@/components/performance/asset-performance-table-python'
import { AssetPerformanceSummary } from '@/components/performance/asset-performance-summary'
import { useMobileResponsive } from '@/lib/client-utils'
import { BenchmarkSelector } from '@/components/portfolio/portfolio-form'
import { usePortfolios, useDeletePortfolio } from '@/hooks/use-portfolios'
import { lazyPortfolios, getPortfolioByName, getPortfolioById } from '@/lib/lazy-portfolios'
import { useSearchParams, useRouter } from 'next/navigation'

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
  holdings?: Record<string, any[]>
  returns?: number[]
  drawdown?: number[]
  performanceMetrics?: {
    totalReturn?: number
    annualizedReturn?: number
    volatility?: number
    sharpeRatio?: number
    maxDrawdown?: number
  }
  assetPerformance?: AssetPerformanceMetrics[]
  assetPrices?: Record<string, number[]>
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
  contribution?: number // Return contribution to portfolio
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

// Format holdings data for performance chart (portfolio weights)
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

// Format asset prices data for individual asset performance display
const formatAssetPricesData = (assetPrices: Record<string, number[]>, dates: string[]) => {
  if (!assetPrices || !dates) {
    return {}
  }
  
  const formattedAssetPrices: Record<string, any[]> = {}
  
  Object.entries(assetPrices).forEach(([symbol, prices]) => {
    if (prices && prices.length > 0 && dates.length > 0) {
      // Find first valid price to use as base for normalization
      let basePrice = prices[0]
      for (let i = 0; i < prices.length; i++) {
        const price = prices[i]
        if (price && price > 0 && isFinite(price)) {
          basePrice = price
          break
        }
      }
      
      if (basePrice && basePrice > 0) {
        formattedAssetPrices[symbol] = prices.map((price, index) => ({
          date: dates[index] || '',
          value: price && price > 0 ? price / basePrice : basePrice / basePrice, // Normalize asset prices to show performance
        }))
      }
    }
  })
  
  return formattedAssetPrices
}

// Combine asset prices with timing information from weights (for momentum strategies)
const combineAssetPricesWithTiming = (
  assetPrices: Record<string, any[]>, 
  weights: Record<string, number[]>, 
  dates: string[],
  strategy: string = 'buy-hold'
) => {
  if (!assetPrices || !weights || !dates) {
    return {}
  }
  
  const combined: Record<string, any[]> = {}
  
  Object.keys(assetPrices).forEach(symbol => {
    const priceData = assetPrices[symbol] || []
    const weightData = weights[symbol] || []
    
    if (priceData.length > 0) {
      // For momentum strategy, adjust asset values to reflect strategy impact
      if (strategy === 'momentum') {
        let lastInvestedValue = priceData[0]?.value || 1 // Start with initial value
        
        combined[symbol] = priceData.map((pricePoint, index) => {
          const weight = weightData[index] || 0
          const isInvested = weight > 0
          
          // Strategy-adjusted logic:
          // - During invested periods: use actual asset performance
          // - During cash periods: hold at the last invested value (flat line)
          let adjustedValue: number
          
          if (isInvested) {
            // Invested period: use actual asset performance
            adjustedValue = pricePoint.value
            lastInvestedValue = adjustedValue // Update last invested value
          } else {
            // Cash period: flat line at last invested value
            adjustedValue = lastInvestedValue
          }
          
          return {
            ...pricePoint,
            value: adjustedValue, // Strategy-adjusted value
            originalValue: pricePoint.value, // Preserve original for reference
            weight: weight,
            invested: isInvested ? 1 : 0 // Binary indicator for momentum timing
          }
        })
      } else {
        // For other strategies, preserve original behavior
        combined[symbol] = priceData.map((pricePoint, index) => ({
          ...pricePoint,
          weight: weightData[index] || 0,
          invested: (weightData[index] || 0) > 0 ? 1 : 0 // Binary indicator for timing
        }))
      }
    }
  })
  
  return combined
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
    const firstDate = dates[0]
    const lastDate = dates[dates.length - 1]
    if (!firstDate || !lastDate) {
      throw new Error('No dates available for calculation')
    }
    const startDate = new Date(firstDate)
    const endDate = new Date(lastDate)
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
      if (prevValue !== undefined && currentValue !== undefined && 
          isFinite(prevValue) && isFinite(currentValue) && prevValue > 0) {
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
    let peak = values[0] || 0
    for (const value of values) {
      if (value !== undefined && isFinite(value) && value > peak) {
        peak = value
      }
      if (value !== undefined && isFinite(value) && peak > 0) {
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

export default function PortfolioBuilderPage() {
  const { isMobile, isTablet, isTouch, width, height } = useMobileResponsive()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([
    { symbol: 'VTI', name: 'Vanguard Total Stock Market', allocation: 50 },
    { symbol: 'BND', name: 'Vanguard Total Bond Market', allocation: 50 }
  ])
  const [portfolioName, setPortfolioName] = useState('My ETF Portfolio')
  const [initialInvestment, setInitialInvestment] = useState(10000)
  const [strategy, setStrategy] = useState('buy-hold')
  const [benchmarkSymbol, setBenchmarkSymbol] = useState<string | null>(null)
  const [strategyParameters, setStrategyParameters] = useState({
    momentum: {
      lookbackPeriod: 3,
      rebalanceFrequency: 'monthly',
      topN: 3,
      positiveReturnsOnly: false
    },
    'relative-strength': {
      lookbackPeriod: 6,
      rebalanceFrequency: 'monthly',
      topN: 2,
      positiveReturnsOnly: false
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
  // Calculate default dates: 5-year window ending today
  const getDefaultDates = () => {
    const today = new Date()
    const fiveYearsAgo = new Date(today)
    fiveYearsAgo.setFullYear(today.getFullYear() - 5)
    
    return {
      start: fiveYearsAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    }
  }
  
  const defaultDates = getDefaultDates()
  const [startDate, setStartDate] = useState(defaultDates.start)
  const [endDate, setEndDate] = useState(defaultDates.end)
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showIndividualAssets, setShowIndividualAssets] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [benchmarkData, setBenchmarkData] = useState<any[] | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('')
  const [autoRunBacktest, setAutoRunBacktest] = useState(false)
  const { toast } = useToast()

  // Handle URL parameters for loading preset portfolios
  useEffect(() => {
    const preset = searchParams.get('preset')
    const portfolioNameParam = searchParams.get('portfolioName')
    
    console.log('URL params:', { preset, portfolioNameParam })
    
    if (preset || portfolioNameParam) {
      let portfolioDefinition = null
      
      // Try to get portfolio by ID first, then by name
      if (preset) {
        portfolioDefinition = getPortfolioById(preset)
      }
      if (!portfolioDefinition && portfolioNameParam) {
        portfolioDefinition = getPortfolioByName(portfolioNameParam)
      }
      
      console.log('Portfolio definition found:', !!portfolioDefinition, portfolioDefinition?.name)
      
      if (portfolioDefinition) {
        // Update portfolio form fields
        setPortfolioName(portfolioDefinition.name)
        
        // Clear existing holdings and populate with new ones
        const portfolioHoldings = portfolioDefinition.holdings.map(holding => ({
          symbol: holding.symbol,
          name: holding.name,
          allocation: holding.allocation
        }))
        setPortfolioItems(portfolioHoldings)
        
        // Set date range to last 5 years
        const defaultDates = getDefaultDates()
        setStartDate(defaultDates.start)
        setEndDate(defaultDates.end)
        
        // Keep other settings as they are
        setInitialInvestment(10000)
        setStrategy('buy-hold')
        setBenchmarkSymbol(null)
        
        // Check if there's a pending backtest result from the lazy portfolio click
        const pendingResult = sessionStorage.getItem('pendingBacktestResult')
        console.log('Checking for pending backtest result:', pendingResult ? 'Found' : 'None')
        if (pendingResult) {
          try {
            const backtest = JSON.parse(pendingResult)
            console.log('Found pending backtest result:', backtest)
            
            // Process the backtest result immediately
            const metrics = backtest.performanceMetrics || backtest
            setBacktestResult({
              id: backtest.id,
              status: backtest.status,
              finalValue: metrics.totalReturn ? 10000 * (1 + metrics.totalReturn) : undefined,
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
              assetPerformance: backtest.assetPerformance || [],
              assetPrices: backtest.assetPrices || null
            })
            
            // Clear the pending result
            sessionStorage.removeItem('pendingBacktestResult')
            
            console.log('Portfolio Builder: Setting backtest result with data:', backtest)
            toast({
              title: 'Portfolio Loaded',
              description: `"${portfolioDefinition.name}" backtest results are now available.`,
            })
          } catch (error) {
            console.error('Error parsing pending backtest result:', error)
            toast({
              title: 'Portfolio Loaded',
              description: `Loaded "${portfolioDefinition.name}" template. You can customize it before running the backtest.`,
            })
          }
        } else {
          toast({
            title: 'Portfolio Loaded',
            description: `Loaded "${portfolioDefinition.name}" template. You can customize it before running the backtest.`,
          })
        }
      }
    }
  }, [searchParams, toast]) // Only run when searchParams change


  const { data: session } = useSession()
  // Only fetch portfolios if user is authenticated to avoid auth errors breaking the component
  const shouldFetchPortfolios = !!session?.user
  const { data: portfoliosData, isLoading: portfoliosLoading } = usePortfolios(1, 50, shouldFetchPortfolios)
  const deletePortfolio = useDeletePortfolio()

  // Handle loading saved portfolio
  const handleLoadPortfolio = (portfolioId: string) => {
    const savedPortfolios = portfoliosData?.data || []
    const selectedPortfolio = savedPortfolios.find(p => p.id === portfolioId)
    
    if (selectedPortfolio) {
      setPortfolioName(selectedPortfolio.name)
      setPortfolioItems(selectedPortfolio.holdings.map(h => ({
        symbol: h.symbol,
        name: h.symbol, // We'll use symbol as name for now
        allocation: Number(h.allocation) * 100 // Convert from decimal to percentage
      })))
      setSelectedPortfolioId(portfolioId)
      
      toast({
        title: "Portfolio Loaded",
        description: `Loaded "${selectedPortfolio.name}" with ${selectedPortfolio.holdings.length} holdings.`,
      })
    }
  }

  // Handle deleting saved portfolio
  const handleDeletePortfolio = async (portfolioId: string) => {
    const savedPortfolios = portfoliosData?.data || []
    const portfolioToDelete = savedPortfolios.find(p => p.id === portfolioId)
    
    if (!portfolioToDelete) return

    // Confirmation dialog
    if (!window.confirm(`Are you sure you want to delete "${portfolioToDelete.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deletePortfolio.mutateAsync(portfolioId)
      
      // Clear the selection if we deleted the currently selected portfolio
      if (selectedPortfolioId === portfolioId) {
        setSelectedPortfolioId('')
      }
      
      toast({
        title: 'Portfolio deleted',
        description: `"${portfolioToDelete.name}" has been successfully deleted.`,
      })
    } catch (error) {
      console.error('Error deleting portfolio:', error)
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete portfolio. Please try again.',
        variant: 'destructive'
      })
    }
  }

  // Handle saving portfolio
  const handleSavePortfolio = async () => {
    if (!session) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save portfolios.",
        variant: "destructive",
      })
      return
    }

    if (portfolioItems.length === 0) {
      toast({
        title: "No Holdings",
        description: "Please add at least one ETF to your portfolio before saving.",
        variant: "destructive",
      })
      return
    }

    if (Math.abs(totalAllocation - 100) > 0.1) {
      toast({
        title: "Invalid Allocation",
        description: "Portfolio allocation must equal 100% before saving.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      const portfolioData = {
        name: portfolioName || 'My ETF Portfolio',
        description: `ETF portfolio with ${portfolioItems.length} holdings`,
        isPublic: false,
        holdings: portfolioItems.map(item => ({
          symbol: item.symbol,
          allocation: item.allocation / 100, // Convert percentage to decimal
        })),
      }

      const response = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portfolioData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save portfolio')
      }

      toast({
        title: "Portfolio Saved!",
        description: `"${portfolioName}" has been saved to your account.`,
      })
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : 'Failed to save portfolio',
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Clear benchmark data when benchmark symbol changes
  useEffect(() => {
    setBenchmarkData(null)
  }, [benchmarkSymbol])

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

  const fetchBenchmarkData = async (symbol: string, startDate: string, endDate: string) => {
    try {
      // Calculate appropriate period based on date range
      const start = new Date(startDate)
      const end = new Date(endDate)
      const diffYears = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365)
      
      let period = '5y' // default
      if (diffYears <= 0.08) period = '1mo' // ~1 month
      else if (diffYears <= 0.25) period = '3mo' // ~3 months
      else if (diffYears <= 0.5) period = '6mo' // ~6 months  
      else if (diffYears <= 1) period = '1y' // ~1 year
      else if (diffYears <= 2) period = '2y' // ~2 years
      else period = '5y' // 5+ years
      
      const response = await fetch(`/api/market-data/${symbol}?period=${period}&interval=1d`)
      if (!response.ok) {
        console.warn(`Failed to fetch benchmark data for ${symbol}`)
        return null
      }
      
      const result = await response.json()
      const data = result.data
      
      // Transform the data to match chart format (normalize to starting value)
      if (data && data.length > 0) {
        // Filter data to match the date range as closely as possible
        const filteredData = data.filter((point: any) => {
          const pointDate = new Date(point.date)
          return pointDate >= start && pointDate <= end
        })
        
        if (filteredData.length === 0) return null
        
        const baseValue = filteredData[0].close
        return filteredData.map((point: any) => ({
          date: point.date,
          value: point.close / baseValue, // Normalize like portfolio data
          formattedDate: new Date(point.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        }))
      }
      return null
    } catch (error) {
      console.error('Error fetching benchmark data:', error)
      return null
    }
  }

  const handleRunBacktest = React.useCallback(async () => {
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
    setBenchmarkData(null) // Clear previous benchmark data

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
        benchmarkSymbol,
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
        hasAssetPrices: !!(backtest.assetPrices && Object.keys(backtest.assetPrices).length > 0),
        assetPerformancePreview: backtest.assetPerformance ? backtest.assetPerformance.slice(0, 2) : null,
        assetPricesKeys: backtest.assetPrices ? Object.keys(backtest.assetPrices) : null
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

      // Fetch benchmark data if a benchmark is selected
      if (benchmarkSymbol && startDate && endDate) {
        console.log(`Fetching benchmark data for ${benchmarkSymbol}`)
        const benchmarkTimeSeries = await fetchBenchmarkData(benchmarkSymbol, startDate, endDate)
        setBenchmarkData(benchmarkTimeSeries)
      } else {
        setBenchmarkData(null)
      }

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
  }, [portfolioItems, portfolioName, startDate, endDate, initialInvestment, strategy, strategyParameters, benchmarkSymbol, totalAllocation, toast])

  const totalAllocation = portfolioItems.reduce((sum, item) => sum + item.allocation, 0)
  
  // Computed chart data
  const performanceData = backtestResult && backtestResult.portfolioValue && backtestResult.dates 
    ? formatPerformanceData(backtestResult.portfolioValue, backtestResult.dates)
    : []
  
  // For individual asset display, use asset prices data instead of holdings (weights)
  const assetPricesData = backtestResult && backtestResult.assetPrices && backtestResult.dates
    ? formatAssetPricesData(backtestResult.assetPrices, backtestResult.dates)
    : {}
  
  // Process holdings data based on strategy type
  const holdingsData = React.useMemo(() => {
    if (!backtestResult?.dates) return {}
    
    if (strategy === 'momentum' && backtestResult.assetPrices && backtestResult.holdings) {
      // For momentum, create strategy-adjusted asset performance showing flat lines during cash periods
      const weights = convertHoldingsToWeights(backtestResult.holdings)
      return combineAssetPricesWithTiming(assetPricesData, weights, backtestResult.dates, strategy)
    } else if (backtestResult.assetPrices) {
      // For other strategies, use raw asset prices for individual display
      return assetPricesData
    } else if (backtestResult.holdings) {
      // Fallback to weights if no asset prices available
      return formatHoldingsData(backtestResult.holdings, backtestResult.dates)
    }
    
    return {}
  }, [backtestResult, strategy, assetPricesData])
  
  const allocationData = formatAllocationData(portfolioItems)

  // Calculate asset performance metrics using asset prices data
  const assetPerformanceMetrics: AssetPerformanceMetrics[] = useMemo(() => {
    if (!backtestResult?.dates) {
      return []
    }

    // If we have pre-calculated asset performance from the API, use it
    if (backtestResult.assetPerformance && backtestResult.assetPerformance.length > 0) {
      console.log('Using pre-calculated asset performance:', backtestResult.assetPerformance)
      return backtestResult.assetPerformance
    }

    // Otherwise calculate from asset prices
    if (backtestResult.assetPrices) {
      console.log('Calculating from asset prices:', {
        assetPrices: backtestResult.assetPrices,
        dates: backtestResult.dates.length
      })
      return Object.entries(backtestResult.assetPrices).map(([symbol, prices]) => {
        const metrics = calculateAssetPerformanceMetrics(symbol, prices, backtestResult.dates!)
        console.log(`Calculated metrics for ${symbol}:`, metrics)
        return metrics
      })
    }

    console.log('No asset performance data available')
    return []
  }, [backtestResult])

  return (
    <>
      {/* Header */}
      <header className={`bg-white shadow-sm sticky top-0 z-40 ${isMobile ? 'px-4 py-3' : ''}`}>
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2 text-gray-700 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5" />
                <span className={`${isMobile ? 'hidden' : ''}`}>Back to Home</span>
              </Link>
              <div className="text-xl font-bold text-gray-900">Portfolio Builder</div>
            </div>
            
            {session && (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {session.user?.email}
                </span>
                <Button variant="ghost" size="sm" onClick={() => router.push('/api/auth/signout')}>
                  Sign Out
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className={`container mx-auto px-4 ${isMobile ? 'py-4' : 'py-8'}`}>
        <div className={`grid gap-8 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
          {/* Portfolio Builder Section */}
          <div className={`${isMobile ? 'order-1' : 'lg:col-span-1'}`}>
            <Card id="portfolio-builder" className={isMobile ? 'p-4' : 'p-6'}>
              <CardHeader className="px-0 pt-0">
                <CardTitle className={`text-indigo-700 ${isMobile ? 'text-lg' : ''}`}>
                  Build Your Portfolio
                </CardTitle>
                <CardDescription className={isMobile ? 'text-sm' : ''}>
                  Create a diversified ETF portfolio and test its historical performance
                </CardDescription>
              </CardHeader>
              <CardContent className={`px-0 space-y-6 ${isMobile ? 'space-y-4' : ''}`}>
                {/* Portfolio Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Portfolio Name
                  </label>
                  <Input 
                    value={portfolioName}
                    onChange={(e) => setPortfolioName(e.target.value)}
                    placeholder="My ETF Portfolio"
                    className={isTouch ? 'min-h-[44px] touch-manipulation' : ''}
                  />
                </div>

                {/* Date Range */}
                <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <Input 
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={isTouch ? 'min-h-[44px] touch-manipulation' : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <Input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={isTouch ? 'min-h-[44px] touch-manipulation' : ''}
                    />
                  </div>
                </div>

                {/* Initial Investment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Investment
                  </label>
                  <Input 
                    type="number"
                    value={initialInvestment}
                    onChange={(e) => setInitialInvestment(Number(e.target.value))}
                    placeholder="10000"
                    min={1}
                    step={1000}
                    className={isTouch ? 'min-h-[44px] touch-manipulation' : ''}
                  />
                </div>

                {/* Strategy Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Strategy
                  </label>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${isTouch ? 'min-h-[44px] touch-manipulation' : ''}`}
                  >
                    <option value="buy-hold">Buy & Hold</option>
                    <option value="momentum">Momentum</option>
                    <option value="relative-strength">Relative Strength</option>
                    <option value="mean-reversion">Mean Reversion</option>
                    <option value="risk-parity">Risk Parity</option>
                  </select>
                </div>

                {/* Benchmark Selection */}
                <BenchmarkSelector
                  value={benchmarkSymbol}
                  onValueChange={setBenchmarkSymbol}
                />

                {/* Strategy Parameters */}
                {strategy === 'momentum' && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700">Momentum Parameters</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Lookback Period</label>
                        <Input
                          type="number"
                          value={strategyParameters.momentum.lookbackPeriod}
                          onChange={(e) => setStrategyParameters(prev => ({
                            ...prev,
                            momentum: { ...prev.momentum, lookbackPeriod: Number(e.target.value) }
                          }))}
                          min={1}
                          max={12}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Top N Assets</label>
                        <Input
                          type="number"
                          value={strategyParameters.momentum.topN}
                          onChange={(e) => setStrategyParameters(prev => ({
                            ...prev,
                            momentum: { ...prev.momentum, topN: Number(e.target.value) }
                          }))}
                          min={1}
                          max={portfolioItems.length || 1}
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Rebalance Frequency</label>
                      <select
                        value={strategyParameters.momentum.rebalanceFrequency}
                        onChange={(e) => setStrategyParameters(prev => ({
                          ...prev,
                          momentum: { ...prev.momentum, rebalanceFrequency: e.target.value }
                        }))}
                        className="w-full h-8 px-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="positiveReturnsOnly"
                        checked={strategyParameters.momentum.positiveReturnsOnly}
                        onChange={(e) => setStrategyParameters(prev => ({
                          ...prev,
                          momentum: { ...prev.momentum, positiveReturnsOnly: e.target.checked }
                        }))}
                        className="w-4 h-4"
                      />
                      <label htmlFor="positiveReturnsOnly" className="text-xs text-gray-600">
                        Only invest in assets with positive returns
                      </label>
                    </div>
                    <div className="text-xs text-gray-500 italic">
                      Momentum strategy: Invest in top {strategyParameters.momentum.topN} assets based on {strategyParameters.momentum.lookbackPeriod}-month returns, rebalancing {strategyParameters.momentum.rebalanceFrequency}.
                      {strategyParameters.momentum.positiveReturnsOnly && " Cash is held when assets have negative returns."}
                    </div>
                  </div>
                )}

                {/* Saved Portfolios Dropdown */}
                {session && portfoliosData && portfoliosData.data.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Load Saved Portfolio
                    </label>
                    <div className="space-y-2">
                      <select
                        value={selectedPortfolioId}
                        onChange={(e) => {
                          const portfolioId = e.target.value
                          if (portfolioId) {
                            handleLoadPortfolio(portfolioId)
                          }
                        }}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${isTouch ? 'min-h-[44px] touch-manipulation' : ''}`}
                      >
                        <option value="">Select a saved portfolio...</option>
                        {portfoliosData.data.map((portfolio) => (
                          <option key={portfolio.id} value={portfolio.id}>
                            {portfolio.name} ({portfolio.holdings.length} holdings)
                          </option>
                        ))}
                      </select>
                      {selectedPortfolioId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePortfolio(selectedPortfolioId)}
                          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Selected Portfolio
                        </Button>
                      )}
                    </div>
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
                    placeholder="Search for stocks/ETFs (e.g., AAPL, VTI, QQQ...)"
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
                <div className={`pt-4 ${isMobile ? 'space-y-3' : 'flex justify-between gap-3'}`}>
                  <Button 
                    variant="outline" 
                    onClick={() => setPortfolioItems([])}
                    className={`flex items-center gap-2 ${isMobile ? 'w-full justify-center min-h-[44px] touch-manipulation' : ''}`}
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear Portfolio
                  </Button>
                  
                  {session && (
                    <Button 
                      variant="outline" 
                      onClick={handleSavePortfolio}
                      disabled={isSaving || portfolioItems.length === 0 || Math.abs(totalAllocation - 100) > 0.1}
                      className={`flex items-center gap-2 border-green-300 text-green-700 hover:bg-green-50 ${isMobile ? 'w-full justify-center min-h-[44px] touch-manipulation' : ''}`}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {isMobile ? 'Saving...' : 'Saving...'}
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          {isMobile ? 'Save Portfolio' : 'Save Portfolio'}
                        </>
                      )}
                    </Button>
                  )}
                  
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
                  <div className="flex flex-col space-y-2">
                    <CardTitle className={`text-indigo-700 ${isMobile ? 'text-lg' : ''}`}>Performance Summary</CardTitle>
                    {backtestResult && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Benchmark: {benchmarkSymbol || 'None'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Strategy: {strategy === 'buy-hold' ? 'Buy & Hold' : 
                                   strategy === 'momentum' ? 'Momentum' :
                                   strategy === 'relative-strength' ? 'Relative Strength' :
                                   strategy === 'mean-reversion' ? 'Mean Reversion' :
                                   'Risk Parity'}
                        </Badge>
                      </div>
                    )}
                  </div>
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
                        ? `Showing portfolio + ${Object.keys(holdingsData).length} asset${Object.keys(holdingsData).length === 1 ? '' : 's'} (price performance)`
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
                  benchmark={benchmarkData || undefined}
                  benchmarkSymbol={benchmarkSymbol || undefined}
                  showBenchmark={!!benchmarkSymbol && !!benchmarkData}
                  height={isMobile ? 300 : 350}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            {/* Individual Asset Performance Summary */}
            {assetPerformanceMetrics.length > 0 && (
              <AssetPerformanceSummary
                assets={assetPerformanceMetrics.map((metrics, index) => {
                  const colorIndex = index % CHART_COLORS.length
                  const portfolioItem = portfolioItems.find(item => item.symbol === metrics.symbol)
                  return {
                    symbol: metrics.symbol,
                    name: portfolioItem?.name,
                    cagr: metrics.annualizedReturn,
                    maxDrawdown: metrics.maxDrawdown,
                    volatility: metrics.volatility,
                    sharpeRatio: metrics.sharpeRatio,
                    totalReturn: metrics.totalReturn,
                    returnContribution: metrics.contribution || 0,
                    allocation: (portfolioItem?.allocation || 0) / 100,
                    color: CHART_COLORS[colorIndex]
                  }
                })}
                portfolioMetrics={backtestResult?.performanceMetrics ? {
                  cagr: backtestResult.performanceMetrics.annualizedReturn || 0,
                  maxDrawdown: backtestResult.performanceMetrics.maxDrawdown || 0,
                  volatility: backtestResult.performanceMetrics.volatility || 0,
                  sharpeRatio: backtestResult.performanceMetrics.sharpeRatio || 0,
                  totalReturn: backtestResult.performanceMetrics.totalReturn || 0
                } : undefined}
                showPortfolioComparison={true}
                title="Individual Asset Performance"
                className={isMobile ? 'mt-6' : 'mt-8'}
              />
            )}

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
                          name: null,
                          allocation: item.allocation / 100, // Convert to decimal
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
             backtestResult.portfolioValue && backtestResult.portfolioValue.length > 0 && 
             (backtestResult.holdings || backtestResult.assetPrices) && 
             Object.keys(backtestResult.holdings || backtestResult.assetPrices || {}).length > 0 && (
              <AssetPerformanceTablePython
                results={{
                  portfolioValues: backtestResult.portfolioValue,
                  returns: backtestResult.returns || [],
                  dates: backtestResult.dates || [],
                  weights: backtestResult.holdings ? convertHoldingsToWeights(backtestResult.holdings) : {},
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
                  assetPrices: backtestResult.assetPrices || undefined
                }}
                portfolioAllocation={portfolioItems.reduce((acc, item) => {
                  acc[item.symbol] = item.allocation / 100;
                  return acc;
                }, {} as Record<string, number>)}
                preCalculatedAssetPerformance={undefined} // Type mismatch - let component calculate
                benchmarkSymbol={benchmarkSymbol || undefined}
                strategy={strategy}
                strategyParameters={strategy !== 'buy-hold' ? strategyParameters[strategy as keyof typeof strategyParameters] : {}}
                usePython={true}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
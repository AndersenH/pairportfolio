'use client'

import * as React from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchDropdown } from '@/components/ui/search-dropdown'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Plus,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  TrendingUp,
  Info,
  Settings,
  RotateCcw,
  Edit3,
  Save,
  Bookmark,
} from 'lucide-react'
import { cn } from '@/lib/client-utils'
import type { PortfolioWithHoldings } from '@/types'

// Simple Switch component since it's not in the UI library
function Switch({ 
  checked, 
  onCheckedChange, 
  className,
  disabled = false 
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className
      )}
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  )
}

const portfolioSchema = z.object({
  name: z.string().min(1, 'Portfolio name is required'),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  benchmarkSymbol: z.string().optional().nullable(),
  holdings: z.array(
    z.object({
      symbol: z.string().min(1, 'Stock/ETF symbol is required'),
      name: z.string().optional(),
      type: z.string().optional(),
      allocation: z.number().min(0.001, 'Allocation must be greater than 0').max(1, 'Allocation cannot exceed 100%'),
    })
  ).min(1, 'At least one holding is required'),
})

// More lenient schema for draft saves
const portfolioDraftSchema = z.object({
  name: z.string().min(1, 'Portfolio name is required'),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  benchmarkSymbol: z.string().optional().nullable(),
  holdings: z.array(
    z.object({
      symbol: z.string().min(1, 'Stock/ETF symbol is required'),
      name: z.string().optional(),
      type: z.string().optional(),
      allocation: z.number().min(0).max(1), // Allow 0 allocation for drafts
    })
  ).min(1, 'At least one holding is required'),
})

type PortfolioFormData = z.infer<typeof portfolioSchema>

interface PortfolioFormProps {
  initialData?: Partial<PortfolioFormData>
  onSubmit: (data: PortfolioFormData) => void
  onSaveDraft?: (data: PortfolioFormData) => void
  onCancel?: () => void
  isLoading?: boolean
  isSavingDraft?: boolean
}


// Benchmark categories based on benchmark_service.py
interface BenchmarkOption {
  symbol: string
  name: string
}

interface BenchmarkCategory {
  name: string
  description: string
  benchmarks: BenchmarkOption[]
}

const benchmarkCategories: BenchmarkCategory[] = [
  {
    name: 'No Benchmark',
    description: 'Compare portfolio performance without a benchmark',
    benchmarks: [
      { symbol: '', name: 'None - No benchmark comparison' }
    ]
  },
  {
    name: 'Market Indexes',
    description: 'Broad market benchmarks',
    benchmarks: [
      { symbol: 'SPY', name: 'S&P 500 ETF' },
      { symbol: 'QQQ', name: 'NASDAQ 100 ETF' },
      { symbol: 'IWM', name: 'Russell 2000 ETF' },
      { symbol: 'VTI', name: 'Total Stock Market ETF' },
      { symbol: 'VTSMX', name: 'Vanguard Total Stock Market Index' },
      { symbol: 'DIA', name: 'Dow Jones Industrial Average ETF' },
      { symbol: 'MDY', name: 'Mid-Cap ETF' },
    ]
  },
  {
    name: 'Sector ETFs',
    description: 'Sector-specific benchmarks',
    benchmarks: [
      { symbol: 'XLF', name: 'Financial Sector ETF' },
      { symbol: 'XLK', name: 'Technology Sector ETF' },
      { symbol: 'XLE', name: 'Energy Sector ETF' },
      { symbol: 'XLV', name: 'Healthcare Sector ETF' },
      { symbol: 'XLI', name: 'Industrial Sector ETF' },
      { symbol: 'XLP', name: 'Consumer Staples ETF' },
      { symbol: 'XLY', name: 'Consumer Discretionary ETF' },
      { symbol: 'XLU', name: 'Utilities Sector ETF' },
      { symbol: 'XLB', name: 'Materials Sector ETF' },
      { symbol: 'XLRE', name: 'Real Estate Sector ETF' },
      { symbol: 'XLC', name: 'Communication Services ETF' },
    ]
  },
  {
    name: 'International',
    description: 'International market benchmarks',
    benchmarks: [
      { symbol: 'VEA', name: 'Developed Markets ETF' },
      { symbol: 'VWO', name: 'Emerging Markets ETF' },
      { symbol: 'EFA', name: 'EAFE ETF' },
      { symbol: 'EEM', name: 'Emerging Markets ETF' },
      { symbol: 'VGK', name: 'European ETF' },
      { symbol: 'VPL', name: 'Pacific ETF' },
      { symbol: 'IEMG', name: 'Core MSCI Emerging Markets ETF' },
      { symbol: 'IEFA', name: 'Core MSCI EAFE ETF' },
    ]
  },
  {
    name: 'Asset Classes',
    description: 'Multi-asset class benchmarks',
    benchmarks: [
      // Fixed Income
      { symbol: 'BND', name: 'Total Bond Market' },
      { symbol: 'AGG', name: 'Aggregate Bonds' },
      { symbol: 'TLT', name: 'Long-Term Treasury' },
      { symbol: 'SHY', name: 'Short-Term Treasury' },
      { symbol: 'LQD', name: 'Investment Grade Corporate' },
      { symbol: 'HYG', name: 'High Yield Corporate' },
      // Commodities
      { symbol: 'GLD', name: 'Gold' },
      { symbol: 'SLV', name: 'Silver' },
      { symbol: 'DJP', name: 'Commodities' },
      { symbol: 'USO', name: 'Oil' },
      // Real Estate
      { symbol: 'VNQ', name: 'REITs' },
    ]
  }
]

// Benchmark Selector Component
interface BenchmarkSelectorProps {
  value: string | null | undefined
  onValueChange: (value: string | null) => void
  error?: string
  className?: string
}

function BenchmarkSelector({ value, onValueChange, error, className }: BenchmarkSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')
  
  const selectedBenchmark = React.useMemo(() => {
    if (!value) {
      return { symbol: '', name: 'None - No benchmark comparison' }
    }
    for (const category of benchmarkCategories) {
      const benchmark = category.benchmarks.find(b => b.symbol === value)
      if (benchmark) return benchmark
    }
    return { symbol: value, name: 'Unknown Benchmark' }
  }, [value])

  const filteredCategories = React.useMemo(() => {
    if (!searchTerm) return benchmarkCategories
    
    return benchmarkCategories.map(category => ({
      ...category,
      benchmarks: category.benchmarks.filter(benchmark =>
        benchmark.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        benchmark.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    })).filter(category => category.benchmarks.length > 0)
  }, [searchTerm])

  const handleSelect = (symbol: string) => {
    onValueChange(symbol || null)
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <div className={cn('relative', className)}>
      <div className="space-y-1">
        <label className="text-sm font-medium">Benchmark (Optional)</label>
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-between',
              error && 'border-destructive'
            )}
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {selectedBenchmark.symbol ? (
                <>
                  <span className="font-mono">{selectedBenchmark.symbol}</span>
                  <span className="text-muted-foreground">- {selectedBenchmark.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{selectedBenchmark.name}</span>
              )}
            </div>
            <ChevronDown className={cn(
              'h-4 w-4 transition-transform',
              isOpen && 'rotate-180'
            )} />
          </Button>
          
          {isOpen && (
            <>
              <div
                className="fixed inset-0 bg-transparent z-40"
                onClick={() => setIsOpen(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-96 overflow-hidden">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                    <Input
                      placeholder="Search benchmarks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {filteredCategories.map((category) => (
                    <div key={category.name} className="border-b last:border-b-0">
                      <div className="sticky top-0 bg-muted/50 px-3 py-2 border-b">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">{category.name}</h4>
                          <div className="group relative">
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-popover border rounded-md shadow-md z-10">
                              <p className="text-xs text-popover-foreground">{category.description}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-0">
                        {category.benchmarks.map((benchmark) => (
                          <button
                            key={benchmark.symbol}
                            type="button"
                            className={cn(
                              'w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b last:border-b-0',
                              value === benchmark.symbol && 'bg-primary/10 border-primary/20'
                            )}
                            onClick={() => handleSelect(benchmark.symbol)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium">
                                  {benchmark.symbol}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {benchmark.name}
                                </span>
                              </div>
                              {value === benchmark.symbol && (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {filteredCategories.length === 0 && (
                    <div className="p-6 text-center text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No benchmarks found matching "{searchTerm}"</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        
        <p className="text-xs text-muted-foreground">
          Choose a benchmark to compare your portfolio performance against, or select "None" to track absolute performance only
        </p>
      </div>
    </div>
  )
}

// Export the BenchmarkSelector for use in other components
export { BenchmarkSelector }

// Export the benchmark categories for external usage
export { benchmarkCategories }

// Temporarily adding backtest components here - will be moved to separate files

// =============================================================================
// COMPREHENSIVE BACKTEST COMPONENTS
// =============================================================================

const backtestSchema = z.object({
  name: z.string().min(1, 'Backtest name is required'),
  portfolioId: z.string().min(1, 'Portfolio selection is required'),
  strategyId: z.string().min(1, 'Strategy selection is required'),
  customStrategy: z.any().optional(),
  startDate: z.date({
    required_error: 'Start date is required',
  }),
  endDate: z.date({
    required_error: 'End date is required',
  }),
  initialCapital: z.number().min(1000, 'Initial capital must be at least $1,000').max(10000000, 'Initial capital cannot exceed $10,000,000'),
  rebalancingFrequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually']),
}).refine((data) => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
})

type BacktestFormData = z.infer<typeof backtestSchema>

interface BacktestPortfolio {
  id: string
  name: string
  description?: string
  benchmarkSymbol?: string
  holdings: Array<{
    symbol: string
    allocation: number
  }>
}

interface BacktestResults {
  portfolioValues: number[]
  returns: number[]
  dates: string[]
  weights: Record<string, number[]>
  metrics: {
    totalReturn: number
    annualizedReturn: number
    volatility: number
    sharpeRatio: number
    maxDrawdown: number
    [key: string]: number
  }
  drawdown: number[]
  benchmarkComparison?: {
    benchmarkSymbol: string
    benchmarkReturn: number
    alpha: number
    beta: number
  }
}

// =============================================================================
// COMPREHENSIVE BACKTEST FORM IMPLEMENTATION
// =============================================================================

import { format } from 'date-fns'
import { 
  CalendarIcon, 
  Play, 
  Sliders as SliderIcon,
  Minus, 
  AlertTriangle,
  Briefcase as PortfolioIcon,
  BarChart3,
  TrendingDown,
  X,
  Download,
  Share2
} from 'lucide-react'

// Range Slider Component
function RangeSlider({
  value,
  onValueChange,
  min,
  max,
  step,
  className,
}: {
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step: number
  className?: string
}) {
  return (
    <div className={cn('relative flex items-center space-x-3', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onValueChange(Math.max(min, value - step))}
        disabled={value <= min}
      >
        <Minus className="h-3 w-3" />
      </Button>
      
      <div className="flex-1 px-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onValueChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((value - min) / (max - min)) * 100}%, hsl(var(--secondary)) ${((value - min) / (max - min)) * 100}%, hsl(var(--secondary)) 100%)`
          }}
        />
      </div>
      
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onValueChange(Math.min(max, value + step))}
        disabled={value >= max}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  )
}

// Strategy Parameter Configuration
interface ParameterConfig {
  key: string
  label: string
  description: string
  type: 'integer' | 'float'
  min: number
  max: number
  step: number
  defaultValue: number
  unit?: string
  helpText?: string
}

const parameterConfigs: Record<string, ParameterConfig[]> = {
  momentum: [
    {
      key: 'lookback_period',
      label: 'Lookback Period',
      description: 'Number of days to calculate momentum score',
      type: 'integer',
      min: 10,
      max: 252,
      step: 1,
      defaultValue: 60,
      unit: 'days',
      helpText: 'Shorter periods are more sensitive to recent price movements.'
    },
    {
      key: 'top_n',
      label: 'Top N Assets',
      description: 'Number of top-performing assets to select',
      type: 'integer',
      min: 1,
      max: 20,
      step: 1,
      defaultValue: 3,
      unit: 'assets',
      helpText: 'Fewer assets means higher concentration risk.'
    }
  ],
  mean_reversion: [
    {
      key: 'ma_period',
      label: 'Moving Average Period',
      description: 'Number of days for moving average calculation',
      type: 'integer',
      min: 5,
      max: 200,
      step: 1,
      defaultValue: 50,
      unit: 'days',
      helpText: 'Longer periods create smoother signals.'
    },
    {
      key: 'deviation_threshold',
      label: 'Deviation Threshold',
      description: 'Minimum deviation from MA to trigger position',
      type: 'float',
      min: 0.01,
      max: 0.5,
      step: 0.01,
      defaultValue: 0.1,
      unit: '%',
      helpText: 'Higher thresholds reduce false signals.'
    }
  ],
  risk_parity: [
    {
      key: 'volatility_window',
      label: 'Volatility Window',
      description: 'Number of days to calculate rolling volatility',
      type: 'integer',
      min: 20,
      max: 252,
      step: 1,
      defaultValue: 60,
      unit: 'days',
      helpText: 'Longer windows provide more stable estimates.'
    }
  ],
  tactical_allocation: [
    {
      key: 'risk_on_allocation',
      label: 'Risk-On Allocation',
      description: 'Allocation to growth assets in favorable conditions',
      type: 'float',
      min: 0.1,
      max: 1.0,
      step: 0.05,
      defaultValue: 0.8,
      unit: '%',
      helpText: 'Higher allocations increase potential returns.'
    }
  ],
  rotation: [
    {
      key: 'number_of_sectors',
      label: 'Number of Sectors',
      description: 'Number of top-performing sectors to hold',
      type: 'integer',
      min: 1,
      max: 10,
      step: 1,
      defaultValue: 3,
      unit: 'sectors',
      helpText: 'Fewer sectors means higher concentration.'
    }
  ]
}

const rebalancingOptions = [
  { value: 'daily', label: 'Daily', description: 'Rebalance every trading day' },
  { value: 'weekly', label: 'Weekly', description: 'Rebalance every Monday' },
  { value: 'monthly', label: 'Monthly', description: 'Rebalance first Monday of each month' },
  { value: 'quarterly', label: 'Quarterly', description: 'Rebalance every quarter' },
  { value: 'annually', label: 'Annually', description: 'Rebalance once per year' },
] as const

// Strategy Parameter Form Component
function StrategyParameterForm({ 
  strategy, 
  onParametersChange, 
  className 
}: {
  strategy: any
  onParametersChange: (parameters: any) => void
  className?: string
}) {
  const form = useForm({
    defaultValues: strategy.parameters || {}
  })

  const watchedValues = form.watch()

  React.useEffect(() => {
    onParametersChange(watchedValues)
  }, [watchedValues, onParametersChange])

  const configs = parameterConfigs[strategy.type] || []

  if (configs.length === 0) return null

  const formatValue = (value: number, config: ParameterConfig) => {
    if (config.unit === '%') {
      return `${(value * 100).toFixed(1)}%`
    }
    return config.type === 'integer' ? value.toString() : value.toFixed(2)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SliderIcon className="h-5 w-5" />
          Strategy Parameters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {configs.map((config) => (
          <div key={config.key} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">{config.label}</label>
                  {config.helpText && (
                    <div className="group relative">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-popover border rounded-md shadow-md z-10">
                        <p className="text-xs text-popover-foreground">{config.helpText}</p>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">
                  {formatValue(form.watch(config.key) || config.defaultValue, config)}
                </div>
              </div>
            </div>

            <Controller
              control={form.control}
              name={config.key}
              render={({ field }) => (
                <RangeSlider
                  value={field.value || config.defaultValue}
                  onValueChange={field.onChange}
                  min={config.min}
                  max={config.max}
                  step={config.step}
                />
              )}
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatValue(config.min, config)}</span>
              <span>Default: {formatValue(config.defaultValue, config)}</span>
              <span>{formatValue(config.max, config)}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Portfolio Selector Component
function PortfolioSelector({
  portfolios,
  selectedId,
  onSelect,
  error,
  className
}: {
  portfolios: BacktestPortfolio[]
  selectedId: string
  onSelect: (portfolioId: string) => void
  error?: string
  className?: string
}) {
  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {portfolios.map((portfolio) => (
          <Card
            key={portfolio.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md border-2',
              selectedId === portfolio.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
            onClick={() => onSelect(portfolio.id)}
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <PortfolioIcon className="h-4 w-4" />
                  <h4 className="font-medium">{portfolio.name}</h4>
                </div>
                {portfolio.description && (
                  <p className="text-sm text-muted-foreground">{portfolio.description}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {portfolio.holdings.slice(0, 3).map((holding) => (
                    <Badge key={holding.symbol} variant="outline" className="text-xs">
                      {holding.symbol} {(holding.allocation * 100).toFixed(0)}%
                    </Badge>
                  ))}
                  {portfolio.holdings.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{portfolio.holdings.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}
    </div>
  )
}

// Main Backtest Configuration Form
export function BacktestConfigurationForm({
  portfolios,
  onSubmit,
  onRunQuickBacktest,
  initialData,
  isLoading = false,
  isRunning = false,
}: {
  portfolios: BacktestPortfolio[]
  onSubmit: (data: BacktestFormData) => void
  onRunQuickBacktest?: (data: BacktestFormData) => Promise<BacktestResults>
  initialData?: Partial<BacktestFormData>
  isLoading?: boolean
  isRunning?: boolean
}) {
  const [selectedStrategy, setSelectedStrategy] = React.useState<any>(null)

  const form = useForm<BacktestFormData>({
    resolver: zodResolver(backtestSchema),
    defaultValues: {
      name: initialData?.name || '',
      portfolioId: initialData?.portfolioId || '',
      strategyId: initialData?.strategyId || 'buy-hold',
      startDate: initialData?.startDate || new Date(new Date().getFullYear() - 5, new Date().getMonth(), new Date().getDate()),
      endDate: initialData?.endDate || new Date(),
      initialCapital: initialData?.initialCapital || 10000,
      rebalancingFrequency: initialData?.rebalancingFrequency || 'monthly',
    },
  })

  const watchedStrategyId = form.watch('strategyId')
  const watchedStartDate = form.watch('startDate')
  const watchedEndDate = form.watch('endDate')

  // Mock system strategies
  const systemStrategies = [
    {
      id: 'buy-hold',
      name: 'Buy and Hold',
      type: 'buy_hold',
      description: 'Static portfolio allocation - buy and hold target allocations',
      parameters: {}
    },
    {
      id: 'momentum-60-3',
      name: 'Momentum (60-day, Top 3)',
      type: 'momentum',
      description: 'Select top 3 assets based on 60-day momentum',
      parameters: { lookback_period: 60, top_n: 3 }
    },
    {
      id: 'mean-reversion-50',
      name: 'Mean Reversion (50-day MA)',
      type: 'mean_reversion',
      description: 'Overweight assets trading below 50-day moving average',
      parameters: { ma_period: 50, deviation_threshold: 0.1 }
    },
    {
      id: 'risk-parity-60',
      name: 'Risk Parity (60-day volatility)',
      type: 'risk_parity',
      description: 'Inverse volatility weighting based on 60-day rolling volatility',
      parameters: { volatility_window: 60 }
    }
  ]

  React.useEffect(() => {
    const strategy = systemStrategies.find(s => s.id === watchedStrategyId)
    if (strategy) {
      setSelectedStrategy(strategy)
    }
  }, [watchedStrategyId])

  const getBacktestDuration = () => {
    if (!watchedStartDate || !watchedEndDate) return ''
    const diffTime = Math.abs(watchedEndDate.getTime() - watchedStartDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const years = Math.floor(diffDays / 365)
    const months = Math.floor((diffDays % 365) / 30)
    
    if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''} ${months > 0 ? `${months} month${months > 1 ? 's' : ''}` : ''}`
    }
    return `${months > 0 ? `${months} month${months > 1 ? 's' : ''}` : `${diffDays} days`}`
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Backtest Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Backtest Name</label>
                  <Input
                    {...form.register('name')}
                    placeholder="e.g., Conservative Growth Strategy"
                    className="mt-1"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Initial Capital</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      {...form.register('initialCapital', { valueAsNumber: true })}
                      placeholder="100000"
                      className="pl-8"
                    />
                  </div>
                  {form.formState.errors.initialCapital && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.initialCapital.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Start Date</label>
                    <Controller
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <div className="relative mt-1">
                          <Input
                            type="date"
                            value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      )}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">End Date</label>
                    <Controller
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <div className="relative mt-1">
                          <Input
                            type="date"
                            value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      )}
                    />
                  </div>
                </div>

                {getBacktestDuration() && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    Duration: {getBacktestDuration()}
                  </div>
                )}
              </div>
            </div>

            {/* Portfolio Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">Select Portfolio</label>
              <PortfolioSelector
                portfolios={portfolios}
                selectedId={form.watch('portfolioId')}
                onSelect={(portfolioId) => form.setValue('portfolioId', portfolioId)}
                error={form.formState.errors.portfolioId?.message}
              />
            </div>

            {/* Strategy Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">Investment Strategy</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {systemStrategies.map((strategy) => (
                  <Card
                    key={strategy.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md border-2',
                      form.watch('strategyId') === strategy.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => form.setValue('strategyId', strategy.id)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">{strategy.name}</h4>
                        <p className="text-sm text-muted-foreground">{strategy.description}</p>
                        <Badge variant="outline" className="text-xs">
                          {strategy.type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Strategy Parameters */}
            {selectedStrategy && selectedStrategy.type !== 'buy_hold' && (
              <StrategyParameterForm
                strategy={selectedStrategy}
                onParametersChange={(parameters) => 
                  form.setValue('customStrategy', { ...selectedStrategy, parameters })
                }
              />
            )}

            {/* Rebalancing Frequency */}
            <div>
              <label className="text-sm font-medium mb-3 block">Rebalancing Frequency</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {rebalancingOptions.map((option) => (
                  <Card
                    key={option.value}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md border-2',
                      form.watch('rebalancingFrequency') === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => form.setValue('rebalancingFrequency', option.value as any)}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="space-y-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
              {onRunQuickBacktest && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (form.formState.isValid && onRunQuickBacktest) {
                      onRunQuickBacktest(form.getValues())
                    }
                  }}
                  disabled={isRunning || !form.formState.isValid}
                  className="flex-1 sm:flex-none"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  {isRunning ? 'Running...' : 'Quick Preview'}
                </Button>
              )}
              <Button
                type="submit"
                disabled={isLoading || isRunning}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                {isLoading ? 'Creating Backtest...' : 'Run Full Backtest'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// EXAMPLE USAGE AND DOCUMENTATION
// =============================================================================

// Mock data for demonstration
export const mockPortfoliosForBacktest = [
  {
    id: '1',
    name: 'Growth Portfolio',
    description: 'High-growth technology and innovation focus',
    benchmarkSymbol: 'QQQ', // NASDAQ 100 for tech-focused portfolio
    holdings: [
      { symbol: 'QQQ', allocation: 0.4 },
      { symbol: 'VTI', allocation: 0.3 },
      { symbol: 'VEA', allocation: 0.2 },
      { symbol: 'VWO', allocation: 0.1 }
    ]
  },
  {
    id: '2',
    name: 'Balanced Portfolio',
    description: 'Diversified mix of stocks and bonds',
    benchmarkSymbol: 'SPY', // S&P 500 for balanced portfolio
    holdings: [
      { symbol: 'SPY', allocation: 0.4 },
      { symbol: 'BND', allocation: 0.3 },
      { symbol: 'VTI', allocation: 0.2 },
      { symbol: 'VNQ', allocation: 0.1 }
    ]
  },
  {
    id: '3',
    name: 'Conservative Portfolio',
    description: 'Low-risk with focus on bonds and dividends',
    benchmarkSymbol: null, // No benchmark - track absolute performance only
    holdings: [
      { symbol: 'BND', allocation: 0.5 },
      { symbol: 'TLT', allocation: 0.2 },
      { symbol: 'SPY', allocation: 0.2 },
      { symbol: 'VNQ', allocation: 0.1 }
    ]
  }
]

export const mockBacktestResults = {
  portfolioValues: [100000, 105000, 110250, 115762, 121550, 127628],
  returns: [0, 0.05, 0.05, 0.05, 0.05, 0.05],
  dates: ['2022-01-01', '2022-04-01', '2022-07-01', '2022-10-01', '2023-01-01', '2023-04-01'],
  weights: {
    'SPY': [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
    'BND': [0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
    'VTI': [0.2, 0.2, 0.2, 0.2, 0.2, 0.2],
    'VNQ': [0.1, 0.1, 0.1, 0.1, 0.1, 0.1]
  },
  metrics: {
    totalReturn: 0.27628,
    annualizedReturn: 0.12,
    volatility: 0.15,
    sharpeRatio: 0.8,
    maxDrawdown: -0.05,
    winRate: 0.65,
    profitFactor: 1.8
  },
  drawdown: [0, -0.02, -0.01, -0.03, -0.01, 0],
  benchmarkComparison: {
    benchmarkSymbol: 'SPY',
    benchmarkReturn: 0.25,
    alpha: 0.02,
    beta: 0.85
  }
}

// =============================================================================
// BENCHMARK SELECTOR USAGE EXAMPLES
// =============================================================================

/*
Example usage of the BenchmarkSelector component:

import { BenchmarkSelector, benchmarkCategories } from '@/components/portfolio/portfolio-form'

// Basic usage with optional benchmark
<BenchmarkSelector
  value={null} // or "SPY" for a specific benchmark
  onValueChange={(symbol) => console.log('Selected:', symbol)}
/>

// With form control
<Controller
  control={form.control}
  name="benchmarkSymbol"
  render={({ field, fieldState }) => (
    <BenchmarkSelector
      value={field.value}
      onValueChange={field.onChange}
      error={fieldState.error?.message}
    />
  )}
/>

// Available benchmark categories:
- No Benchmark: None - track absolute performance only
- Market Indexes: SPY, QQQ, IWM, VTI, etc.
- Sector ETFs: XLF, XLK, XLE, XLV, etc.
- International: VEA, VWO, EFA, EEM, etc.
- Asset Classes: BND, TLT, GLD, VNQ, etc.

The component provides:
1. Searchable dropdown with categorized options
2. Optional benchmark selection (can be None/null)
3. TypeScript support with proper error handling
4. Responsive design for mobile/desktop
5. Integration with react-hook-form
6. Tooltips for category descriptions
7. Visual indicators for selected benchmarks
*/

// =============================================================================
// PORTFOLIO ALLOCATION EDITOR COMPONENT
// =============================================================================

interface PortfolioAllocationEditorProps {
  portfolio: PortfolioWithHoldings | BacktestPortfolio
  onAllocationChange?: (allocations: Array<{ symbol: string; allocation: number }>) => void
  className?: string
  readonly?: boolean
}

interface EditableAllocation {
  symbol: string
  name?: string
  allocation: number
  originalAllocation: number
}

export function PortfolioAllocationEditor({
  portfolio,
  onAllocationChange,
  className,
  readonly = false
}: PortfolioAllocationEditorProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [allocations, setAllocations] = React.useState<EditableAllocation[]>([])
  const [hasChanges, setHasChanges] = React.useState(false)

  // Initialize allocations from portfolio
  React.useEffect(() => {
    const initialAllocations = portfolio.holdings.map(holding => ({
      symbol: holding.symbol,
      name: (holding as any).name || undefined,
      allocation: Number(holding.allocation),
      originalAllocation: Number(holding.allocation)
    }))
    setAllocations(initialAllocations)
    setHasChanges(false)
  }, [portfolio])

  // Calculate total allocation
  const totalAllocation = allocations.reduce((sum, holding) => sum + holding.allocation, 0)

  // Check if allocations have changed
  React.useEffect(() => {
    const changed = allocations.some(allocation => 
      Math.abs(allocation.allocation - allocation.originalAllocation) > 0.0001
    )
    setHasChanges(changed)
  }, [allocations])

  // Get allocation status
  const getAllocationStatus = () => {
    const tolerance = 0.01 // 1% tolerance
    if (totalAllocation < 1 - tolerance) {
      return { 
        status: 'under' as const, 
        message: `${((1 - totalAllocation) * 100).toFixed(1)}% remaining`,
        isValid: false
      }
    } else if (totalAllocation > 1 + tolerance) {
      return { 
        status: 'over' as const, 
        message: `${((totalAllocation - 1) * 100).toFixed(1)}% over allocated`,
        isValid: false
      }
    } else {
      return { 
        status: 'perfect' as const, 
        message: 'Fully allocated',
        isValid: true
      }
    }
  }

  const allocationStatus = getAllocationStatus()

  // Handle individual allocation change
  const handleAllocationChange = (symbol: string, value: number) => {
    const newAllocations = allocations.map(allocation => 
      allocation.symbol === symbol 
        ? { ...allocation, allocation: value }
        : allocation
    )
    setAllocations(newAllocations)
  }

  // Reset to original values
  const handleReset = () => {
    const resetAllocations = allocations.map(allocation => ({
      ...allocation,
      allocation: allocation.originalAllocation
    }))
    setAllocations(resetAllocations)
    setHasChanges(false)
  }

  // Apply changes
  const handleApplyChanges = () => {
    if (onAllocationChange && allocationStatus.isValid) {
      const newAllocations = allocations.map(allocation => ({
        symbol: allocation.symbol,
        allocation: allocation.allocation
      }))
      onAllocationChange(newAllocations)
      
      // Update original allocations to current values
      const updatedAllocations = allocations.map(allocation => ({
        ...allocation,
        originalAllocation: allocation.allocation
      }))
      setAllocations(updatedAllocations)
      setHasChanges(false)
      setIsEditing(false)
    }
  }

  // Equal weight redistribution
  const handleEqualWeights = () => {
    const equalWeight = 1 / allocations.length
    const newAllocations = allocations.map(allocation => ({
      ...allocation,
      allocation: equalWeight
    }))
    setAllocations(newAllocations)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Portfolio Allocation
            {hasChanges && <Badge variant="outline" className="ml-2">Modified</Badge>}
          </CardTitle>
          <div className="flex items-center gap-3">
            {!readonly && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Edit Mode</label>
                <Switch
                  checked={isEditing}
                  onCheckedChange={setIsEditing}
                />
              </div>
            )}
            <Badge
              variant={
                allocationStatus.status === 'perfect'
                  ? 'default'
                  : allocationStatus.status === 'over'
                  ? 'destructive'
                  : 'secondary'
              }
            >
              {allocationStatus.status === 'perfect' && (
                <CheckCircle className="h-3 w-3 mr-1" />
              )}
              {allocationStatus.status !== 'perfect' && (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {(totalAllocation * 100).toFixed(1)}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Allocation Status Alert */}
          {!allocationStatus.isValid && isEditing && (
            <Alert variant={allocationStatus.status === 'over' ? 'destructive' : 'default'}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">
                  {allocationStatus.status === 'over' ? 'Over Allocated' : 'Under Allocated'}:
                </span>
                {' '}{allocationStatus.message}. Please adjust allocations to total 100%.
              </AlertDescription>
            </Alert>
          )}

          {/* Holdings Table */}
          <div className="overflow-hidden">
            {/* Desktop Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-3 py-2 px-3 bg-muted/50 rounded-t-lg text-sm font-medium">
              <div className="col-span-4">Symbol</div>
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Original</div>
              <div className="col-span-2">{isEditing ? 'New Weight' : 'Allocation'}</div>
            </div>

            <div className="space-y-1">
              {allocations.map((holding, index) => (
                <div 
                  key={holding.symbol} 
                  className={cn(
                    "p-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors",
                    "md:grid md:grid-cols-12 md:gap-3 md:py-3",
                    isEditing && "bg-background border rounded-lg mb-2"
                  )}
                >
                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {holding.symbol}
                        </Badge>
                        {Math.abs(holding.allocation - holding.originalAllocation) > 0.0001 && isEditing && (
                          <Edit3 className="h-3 w-3 text-primary" />
                        )}
                      </div>
                      <div className="text-sm font-medium">
                        {(holding.allocation * 100).toFixed(1)}%
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground truncate">
                      {holding.name || holding.symbol}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Original: {(holding.originalAllocation * 100).toFixed(1)}%
                      </span>
                      
                      {isEditing && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={(holding.allocation * 100).toFixed(1)}
                            onChange={(e) => {
                              const percentage = parseFloat(e.target.value) || 0
                              const decimal = percentage / 100
                              handleAllocationChange(holding.symbol, decimal)
                            }}
                            className="h-8 text-xs w-20"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:contents">
                    <div className="col-span-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {holding.symbol}
                        </Badge>
                        {Math.abs(holding.allocation - holding.originalAllocation) > 0.0001 && isEditing && (
                          <Edit3 className="h-3 w-3 text-primary" />
                        )}
                      </div>
                    </div>
                    
                    <div className="col-span-4 text-sm text-muted-foreground truncate">
                      {holding.name || holding.symbol}
                    </div>
                    
                    <div className="col-span-2 text-sm font-medium">
                      {(holding.originalAllocation * 100).toFixed(1)}%
                    </div>
                    
                    <div className="col-span-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={(holding.allocation * 100).toFixed(1)}
                            onChange={(e) => {
                              const percentage = parseFloat(e.target.value) || 0
                              const decimal = percentage / 100
                              handleAllocationChange(holding.symbol, decimal)
                            }}
                            className="h-8 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      ) : (
                        <span className="text-sm font-medium">
                          {(holding.allocation * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Row */}
            <div className="p-3 bg-muted/50 rounded-b-lg border-t-2 font-medium">
              {/* Mobile Total */}
              <div className="md:hidden flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>Total</span>
                  {allocationStatus.status !== 'perfect' && isEditing && (
                    <span className="text-xs text-muted-foreground">
                      ({allocationStatus.message})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span>100.0%</span>
                  <span className={cn(
                    !allocationStatus.isValid && isEditing ? "text-destructive font-bold" : "text-foreground"
                  )}>
                    {(totalAllocation * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Desktop Total */}
              <div className="hidden md:grid grid-cols-12 gap-3">
                <div className="col-span-8 flex items-center gap-2">
                  <span>Total</span>
                  {allocationStatus.status !== 'perfect' && isEditing && (
                    <span className="text-xs text-muted-foreground">
                      ({allocationStatus.message})
                    </span>
                  )}
                </div>
                <div className="col-span-2">100.0%</div>
                <div className={cn(
                  "col-span-2",
                  !allocationStatus.isValid && isEditing ? "text-destructive font-bold" : "text-foreground"
                )}>
                  {(totalAllocation * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Edit Mode Actions */}
          {isEditing && !readonly && (
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleEqualWeights}
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Equal Weights
              </Button>
              
              {hasChanges && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              )}
              
              <div className="flex-1" />
              
              {hasChanges && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false)
                      handleReset()
                    }}
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyChanges}
                    disabled={!allocationStatus.isValid}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Apply Changes
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Read-only mode info */}
          {readonly && (
            <div className="text-xs text-muted-foreground border-t pt-3">
              <Info className="inline h-3 w-3 mr-1" />
              This portfolio is in read-only mode. Create a custom backtest to modify allocations.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================================================
// USAGE EXAMPLE FOR PORTFOLIO ALLOCATION EDITOR
// =============================================================================

/*
Example usage in a backtest form:

```tsx
import { PortfolioAllocationEditor } from '@/components/portfolio/portfolio-form'

// In your backtest form component:
const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioWithHoldings | null>(null)
const [customAllocations, setCustomAllocations] = useState<Array<{ symbol: string; allocation: number }> | null>(null)

// When portfolio is selected in backtest form
const handlePortfolioSelect = (portfolio: PortfolioWithHoldings) => {
  setSelectedPortfolio(portfolio)
  setCustomAllocations(null) // Reset custom allocations
}

// When user modifies allocations
const handleAllocationChange = (allocations: Array<{ symbol: string; allocation: number }>) => {
  setCustomAllocations(allocations)
  console.log('Custom allocations updated:', allocations)
}

// In your JSX:
{selectedPortfolio && (
  <PortfolioAllocationEditor
    portfolio={selectedPortfolio}
    onAllocationChange={handleAllocationChange}
    readonly={false}
    className="mt-6"
  />
)}

// When running backtest, use customAllocations if available, otherwise use original portfolio allocations
const backtestData = {
  ...otherBacktestData,
  allocations: customAllocations || selectedPortfolio.holdings.map(h => ({
    symbol: h.symbol,
    allocation: h.allocation
  }))
}
```

Features:
✅ Toggle edit mode on/off
✅ Real-time allocation validation (must sum to 100%)
✅ Visual indicators for changes and validation errors
✅ Equal weights redistribution button
✅ Reset to original values
✅ Mobile-responsive design
✅ TypeScript interfaces
✅ Proper error handling and user feedback
✅ Integration with existing UI components
*/

export function PortfolioForm({
  initialData,
  onSubmit,
  onSaveDraft,
  onCancel,
  isLoading = false,
  isSavingDraft = false,
}: PortfolioFormProps) {

  const form = useForm<PortfolioFormData>({
    resolver: zodResolver(portfolioSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      isPublic: initialData?.isPublic || false,
      benchmarkSymbol: initialData?.benchmarkSymbol || null,
      holdings: initialData?.holdings || [{ symbol: '', name: '', type: '', allocation: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'holdings',
  })

  const watchedHoldings = form.watch('holdings')
  const totalAllocation = watchedHoldings.reduce((sum, holding) => sum + (holding.allocation || 0), 0)

  // Calculate equal weights for all holdings
  const redistributeEqualWeights = () => {
    const currentHoldings = form.getValues('holdings')
    const filledHoldings = currentHoldings.filter(h => h.symbol && h.symbol.trim() !== '')
    
    if (filledHoldings.length === 0) return
    
    // Calculate equal weight as decimal (e.g., 0.5 for 50%)
    const equalWeightDecimal = 1 / filledHoldings.length
    
    currentHoldings.forEach((holding, index) => {
      if (holding.symbol && holding.symbol.trim() !== '') {
        // Set the decimal value directly - the form handles percentage conversion
        form.setValue(`holdings.${index}.allocation`, equalWeightDecimal)
      } else {
        // Clear allocation for empty holdings
        form.setValue(`holdings.${index}.allocation`, 0)
      }
    })
  }

  // Handle search result selection
  const handleAssetSelect = (result: { symbol: string; name: string; type?: string }, index: number) => {
    form.setValue(`holdings.${index}.symbol`, result.symbol)
    form.setValue(`holdings.${index}.name`, result.name)
    form.setValue(`holdings.${index}.type`, result.type || 'stock')
    
    // Auto-calculate equal weights after selection
    setTimeout(() => redistributeEqualWeights(), 100)
  }

  const addHolding = () => {
    append({ symbol: '', name: '', type: '', allocation: 0 })
  }

  const removeHolding = (index: number) => {
    if (fields.length > 1) {
      remove(index)
      // Recalculate equal weights after removal
      setTimeout(() => redistributeEqualWeights(), 100)
    }
  }

  const getAllocationStatus = () => {
    if (totalAllocation < 0.99) {
      return { status: 'under', message: `${((1 - totalAllocation) * 100).toFixed(1)}% remaining` }
    } else if (totalAllocation > 1.01) {
      return { status: 'over', message: `${((totalAllocation - 1) * 100).toFixed(1)}% over allocated` }
    } else {
      return { status: 'perfect', message: 'Fully allocated' }
    }
  }

  const allocationStatus = getAllocationStatus()

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>
          {initialData ? 'Edit Portfolio' : 'Create New Portfolio'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form 
          onSubmit={form.handleSubmit((data) => {
            console.log('Portfolio form submitted with data:', data)
            onSubmit(data)
          }, (errors) => {
            console.log('Portfolio form validation errors:', errors)
          })} 
          className="space-y-6"
        >
          {/* Portfolio Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Portfolio Name</label>
              <Input
                {...form.register('name')}
                placeholder="e.g., Growth Portfolio"
                className="mt-1"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input
                {...form.register('description')}
                placeholder="Brief description of your strategy"
                className="mt-1"
              />
            </div>
          </div>

          {/* Benchmark Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Controller
              control={form.control}
              name="benchmarkSymbol"
              render={({ field, fieldState }) => (
                <BenchmarkSelector
                  value={field.value}
                  onValueChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium">Settings</label>
              <div className="flex items-center space-x-2 mt-2">
                <input
                  type="checkbox"
                  {...form.register('isPublic')}
                  className="rounded border-gray-300"
                />
                <label className="text-sm font-medium">
                  Make this portfolio public
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Public portfolios can be viewed by other users
              </p>
            </div>
          </div>


          {/* Holdings Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Holdings</h3>
              <div className="flex items-center space-x-2">
                <Badge
                  variant={
                    allocationStatus.status === 'perfect'
                      ? 'success'
                      : allocationStatus.status === 'over'
                      ? 'destructive'
                      : 'warning'
                  }
                >
                  {allocationStatus.status === 'perfect' && (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  {allocationStatus.status !== 'perfect' && (
                    <AlertCircle className="h-3 w-3 mr-1" />
                  )}
                  {(totalAllocation * 100).toFixed(1)}% - {allocationStatus.message}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end space-x-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium">Stock/ETF Symbol</label>
                    <div className="mt-1">
                      <SearchDropdown
                        placeholder="Search for stocks, ETFs (e.g., AAPL, SPY, QQQ...)"
                        onSelect={(result) => handleAssetSelect(result, index)}
                        className="w-full"
                      />
                    </div>
                    {form.formState.errors.holdings?.[index]?.symbol && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.holdings[index]?.symbol?.message}
                      </p>
                    )}
                    
                    {/* Show selected asset info */}
                    {form.watch(`holdings.${index}.symbol`) && (
                      <div className="mt-2 p-2 bg-muted rounded-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">
                              {form.watch(`holdings.${index}.symbol`)}
                            </div>
                            {form.watch(`holdings.${index}.name`) && (
                              <div className="text-xs text-muted-foreground">
                                {form.watch(`holdings.${index}.name`)}
                              </div>
                            )}
                          </div>
                          {form.watch(`holdings.${index}.type`) && (
                            <Badge variant="secondary" className="text-xs">
                              {form.watch(`holdings.${index}.type`)?.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium">Allocation (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={((form.watch(`holdings.${index}.allocation`) || 0) * 100).toFixed(1)}
                      onChange={(e) => {
                        const percentageValue = parseFloat(e.target.value) || 0
                        const decimalValue = percentageValue / 100
                        form.setValue(`holdings.${index}.allocation`, decimalValue)
                      }}
                      placeholder="25.0"
                      className="mt-1"
                    />
                    {form.formState.errors.holdings?.[index]?.allocation && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.holdings[index]?.allocation?.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeHolding(index)}
                    disabled={fields.length === 1}
                    className="h-10 w-10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={addHolding}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Holding
              </Button>
              
              <Button
                type="button"
                variant="secondary"
                onClick={redistributeEqualWeights}
                disabled={fields.filter(f => form.watch(`holdings.${fields.indexOf(f)}.symbol`)).length === 0}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                title="Automatically distribute equal weights across all selected assets"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Equal Weights
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              <Info className="inline h-3 w-3 mr-1" />
              Equal weights are automatically calculated when you select assets. Use the "Equal Weights" button to redistribute manually.
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex justify-between pt-6 border-t">
            <div className="flex space-x-3">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
            <div className="flex space-x-3">
              {onSaveDraft && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    isSavingDraft || 
                    isLoading ||
                    !form.getValues('name') || 
                    !form.getValues('holdings')?.length
                  }
                  onClick={() => {
                    const currentData = form.getValues()
                    // Only require name and at least one holding for draft save
                    if (currentData.name && currentData.holdings?.length > 0) {
                      onSaveDraft(currentData)
                    }
                  }}
                >
                  <Bookmark className="h-4 w-4 mr-2" />
                  {isSavingDraft ? 'Saving Draft...' : 'Save Draft'}
                </Button>
              )}
              <Button
                type="submit"
                disabled={
                  isLoading || 
                  allocationStatus.status === 'over' || 
                  allocationStatus.status === 'under' ||
                  !form.formState.isValid
                }
              >
                {isLoading ? 'Saving...' : initialData ? 'Update Portfolio' : 'Create Portfolio'}
              </Button>
            </div>
          </div>
            
          {/* Show form errors */}
          {Object.keys(form.formState.errors).length > 0 && (
            <div className="mt-2 text-sm text-destructive">
              <p>Please fix the following errors:</p>
              <ul className="list-disc list-inside mt-1">
                {form.formState.errors.name && <li>Portfolio name is required</li>}
                {form.formState.errors.holdings && <li>At least one holding is required</li>}
                {Object.entries(form.formState.errors.holdings || {}).map(([index, error]: [string, any]) => (
                  error?.symbol && <li key={index}>Holding {parseInt(index) + 1}: Symbol is required</li>
                ))}
              </ul>
            </div>
          )}
        </form>

      </CardContent>
    </Card>
  )
}
import { Decimal } from '@prisma/client/runtime/library'

export interface PriceDataPoint {
  date: Date
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  adjClose: number | null
  volume: number | null
  dividend?: number
  splitRatio?: number
}

export interface PerformanceMetrics {
  totalReturn: number
  annualizedReturn: number
  volatility: number
  sharpeRatio: number | null
  maxDrawdown: number
  maxDrawdownDuration: number // days
  beta?: number
  alpha?: number
  calmarRatio: number | null
  sortinoRatio: number | null
  var95: number // Value at Risk 95%
  cvar95: number // Conditional VaR 95%
  winRate: number
  profitFactor: number | null
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  cleanedData?: PriceDataPoint[]
}

/**
 * Market Data Utilities for data validation, cleaning, and calculations
 */
export class MarketDataUtils {
  
  /**
   * Validate and clean price data
   */
  static validatePriceData(data: PriceDataPoint[]): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const cleanedData: PriceDataPoint[] = []

    if (!data || data.length === 0) {
      errors.push('No data provided')
      return { isValid: false, errors, warnings }
    }

    // Sort by date
    const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime())

    for (let i = 0; i < sortedData.length; i++) {
      const point = sortedData[i]
      const pointErrors: string[] = []
      const pointWarnings: string[] = []

      // Validate required fields
      if (!point.date) {
        pointErrors.push(`Missing date at index ${i}`)
      }

      // Validate price data
      if (point.close === null || point.close === undefined) {
        pointWarnings.push(`Missing close price at ${point.date?.toISOString().split('T')[0]}`)
      } else if (point.close <= 0) {
        pointErrors.push(`Invalid close price (${point.close}) at ${point.date?.toISOString().split('T')[0]}`)
      }

      // Validate OHLC consistency
      if (point.open && point.high && point.low && point.close) {
        if (point.high < Math.max(point.open, point.close) || 
            point.low > Math.min(point.open, point.close)) {
          pointWarnings.push(`OHLC inconsistency at ${point.date?.toISOString().split('T')[0]}`)
        }
      }

      // Validate volume
      if (point.volume !== null && point.volume !== undefined && point.volume < 0) {
        pointWarnings.push(`Negative volume (${point.volume}) at ${point.date?.toISOString().split('T')[0]}`)
      }

      // Check for extreme price movements (>50% in one day)
      if (i > 0 && point.close && sortedData[i-1].close) {
        const pctChange = Math.abs((point.close - sortedData[i-1].close) / sortedData[i-1].close)
        if (pctChange > 0.5) {
          pointWarnings.push(`Extreme price movement (${(pctChange * 100).toFixed(1)}%) at ${point.date?.toISOString().split('T')[0]}`)
        }
      }

      // If no critical errors, add to cleaned data
      if (pointErrors.length === 0) {
        cleanedData.push({
          ...point,
          dividend: point.dividend || 0,
          splitRatio: point.splitRatio || 1
        })
      }

      errors.push(...pointErrors)
      warnings.push(...pointWarnings)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      cleanedData: errors.length === 0 ? cleanedData : undefined
    }
  }

  /**
   * Normalize price data for comparison (base value = 100)
   */
  static normalizePriceData(data: PriceDataPoint[], baseValue = 100): PriceDataPoint[] {
    if (!data.length) return []

    const firstValidPrice = data.find(d => d.close !== null)?.close
    if (!firstValidPrice) return data

    return data.map(point => ({
      ...point,
      close: point.close ? (point.close / firstValidPrice) * baseValue : null,
      open: point.open ? (point.open / firstValidPrice) * baseValue : null,
      high: point.high ? (point.high / firstValidPrice) * baseValue : null,
      low: point.low ? (point.low / firstValidPrice) * baseValue : null,
      adjClose: point.adjClose ? (point.adjClose / firstValidPrice) * baseValue : null
    }))
  }

  /**
   * Fill missing price data using forward fill method
   */
  static fillMissingData(data: PriceDataPoint[]): PriceDataPoint[] {
    if (!data.length) return []

    const filled: PriceDataPoint[] = []
    let lastValidPrice: number | null = null

    for (const point of data) {
      if (point.close !== null && point.close !== undefined) {
        lastValidPrice = point.close
        filled.push(point)
      } else if (lastValidPrice !== null) {
        // Forward fill with last valid price
        filled.push({
          ...point,
          close: lastValidPrice,
          open: lastValidPrice,
          high: lastValidPrice,
          low: lastValidPrice,
          adjClose: lastValidPrice
        })
      } else {
        // Skip if no valid price yet
        continue
      }
    }

    return filled
  }

  /**
   * Generate date range for business days
   */
  static generateBusinessDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = []
    const current = new Date(startDate)

    while (current <= endDate) {
      const dayOfWeek = current.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        dates.push(new Date(current))
      }
      current.setDate(current.getDate() + 1)
    }

    return dates
  }

  /**
   * Align multiple price series to common trading dates
   */
  static alignPriceSeries(series: Record<string, PriceDataPoint[]>): Record<string, PriceDataPoint[]> {
    const symbols = Object.keys(series)
    if (symbols.length === 0) return {}

    // Get all unique dates
    const allDates = new Set<string>()
    symbols.forEach(symbol => {
      series[symbol].forEach(point => {
        allDates.add(point.date.toISOString().split('T')[0])
      })
    })

    // Sort dates
    const sortedDates = Array.from(allDates).sort()

    // Create date index maps for each series
    const dateIndexMaps: Record<string, Map<string, PriceDataPoint>> = {}
    symbols.forEach(symbol => {
      dateIndexMaps[symbol] = new Map()
      series[symbol].forEach(point => {
        dateIndexMaps[symbol].set(point.date.toISOString().split('T')[0], point)
      })
    })

    // Find common dates (dates that exist in all series)
    const commonDates = sortedDates.filter(date => 
      symbols.every(symbol => dateIndexMaps[symbol].has(date))
    )

    // Build aligned series
    const alignedSeries: Record<string, PriceDataPoint[]> = {}
    symbols.forEach(symbol => {
      alignedSeries[symbol] = commonDates.map(date => 
        dateIndexMaps[symbol].get(date)!
      )
    })

    return alignedSeries
  }

  /**
   * Calculate daily returns from price data
   */
  static calculateReturns(data: PriceDataPoint[], useAdjustedClose = true): number[] {
    if (data.length < 2) return []

    const prices = data.map(d => useAdjustedClose ? d.adjClose : d.close)
      .filter((price): price is number => price !== null)

    const returns: number[] = []
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1])
    }

    return returns
  }

  /**
   * Calculate comprehensive performance metrics
   */
  static calculatePerformanceMetrics(
    data: PriceDataPoint[], 
    benchmarkData?: PriceDataPoint[],
    riskFreeRate = 0.02 // 2% annual risk-free rate
  ): PerformanceMetrics {
    if (data.length < 2) {
      throw new Error('Insufficient data for performance calculation')
    }

    const returns = this.calculateReturns(data)
    const prices = data.map(d => d.close).filter((p): p is number => p !== null)

    if (returns.length === 0 || prices.length === 0) {
      throw new Error('No valid price data found')
    }

    // Basic metrics
    const totalReturn = (prices[prices.length - 1] - prices[0]) / prices[0]
    const tradingDays = returns.length
    const annualizedReturn = Math.pow(1 + totalReturn, 252 / tradingDays) - 1
    
    // Volatility (annualized standard deviation)
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length
    const volatility = Math.sqrt(variance * 252)

    // Sharpe ratio
    const excessReturn = annualizedReturn - riskFreeRate
    const sharpeRatio = volatility !== 0 ? excessReturn / volatility : null

    // Drawdown calculations
    const { maxDrawdown, maxDrawdownDuration } = this.calculateDrawdownMetrics(prices)

    // Calmar ratio
    const calmarRatio = maxDrawdown !== 0 ? annualizedReturn / Math.abs(maxDrawdown) : null

    // Sortino ratio (using downside deviation)
    const downsideReturns = returns.filter(ret => ret < 0)
    const downsideVariance = downsideReturns.length > 0 
      ? downsideReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / downsideReturns.length
      : 0
    const downsideDeviation = Math.sqrt(downsideVariance * 252)
    const sortinoRatio = downsideDeviation !== 0 ? excessReturn / downsideDeviation : null

    // Value at Risk (VaR) and Conditional VaR (CVaR) at 95% confidence
    const sortedReturns = [...returns].sort((a, b) => a - b)
    const var95Index = Math.floor(returns.length * 0.05)
    const var95 = sortedReturns[var95Index] || 0
    const cvar95 = var95Index > 0 
      ? sortedReturns.slice(0, var95Index).reduce((a, b) => a + b, 0) / var95Index
      : var95

    // Win rate
    const positiveReturns = returns.filter(ret => ret > 0)
    const winRate = positiveReturns.length / returns.length

    // Profit factor
    const totalGains = positiveReturns.reduce((sum, ret) => sum + ret, 0)
    const totalLosses = Math.abs(returns.filter(ret => ret < 0).reduce((sum, ret) => sum + ret, 0))
    const profitFactor = totalLosses !== 0 ? totalGains / totalLosses : null

    // Beta and Alpha (if benchmark provided)
    let beta: number | undefined
    let alpha: number | undefined
    
    if (benchmarkData && benchmarkData.length >= data.length) {
      const benchmarkReturns = this.calculateReturns(benchmarkData)
      if (benchmarkReturns.length === returns.length) {
        const { beta: calcBeta, alpha: calcAlpha } = this.calculateBetaAlpha(
          returns, 
          benchmarkReturns, 
          riskFreeRate
        )
        beta = calcBeta
        alpha = calcAlpha
      }
    }

    return {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownDuration,
      beta,
      alpha,
      calmarRatio,
      sortinoRatio,
      var95,
      cvar95,
      winRate,
      profitFactor
    }
  }

  /**
   * Calculate maximum drawdown and duration
   */
  private static calculateDrawdownMetrics(prices: number[]): { maxDrawdown: number, maxDrawdownDuration: number } {
    let maxDrawdown = 0
    let maxDrawdownDuration = 0
    let peak = prices[0]
    let currentDrawdownDuration = 0

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > peak) {
        peak = prices[i]
        currentDrawdownDuration = 0
      } else {
        const drawdown = (peak - prices[i]) / peak
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown
        }
        currentDrawdownDuration++
        if (currentDrawdownDuration > maxDrawdownDuration) {
          maxDrawdownDuration = currentDrawdownDuration
        }
      }
    }

    return { maxDrawdown, maxDrawdownDuration }
  }

  /**
   * Calculate Beta and Alpha relative to benchmark
   */
  private static calculateBetaAlpha(
    returns: number[], 
    benchmarkReturns: number[], 
    riskFreeRate: number
  ): { beta: number, alpha: number } {
    const n = Math.min(returns.length, benchmarkReturns.length)
    
    // Calculate excess returns
    const dailyRiskFreeRate = riskFreeRate / 252
    const excessReturns = returns.slice(0, n).map(ret => ret - dailyRiskFreeRate)
    const excessBenchmarkReturns = benchmarkReturns.slice(0, n).map(ret => ret - dailyRiskFreeRate)

    // Calculate beta (covariance / variance)
    const meanExcessReturn = excessReturns.reduce((a, b) => a + b, 0) / n
    const meanExcessBenchmark = excessBenchmarkReturns.reduce((a, b) => a + b, 0) / n

    let covariance = 0
    let benchmarkVariance = 0

    for (let i = 0; i < n; i++) {
      const returnDiff = excessReturns[i] - meanExcessReturn
      const benchmarkDiff = excessBenchmarkReturns[i] - meanExcessBenchmark
      
      covariance += returnDiff * benchmarkDiff
      benchmarkVariance += benchmarkDiff * benchmarkDiff
    }

    covariance /= (n - 1)
    benchmarkVariance /= (n - 1)

    const beta = benchmarkVariance !== 0 ? covariance / benchmarkVariance : 0

    // Calculate alpha (Jensen's alpha)
    const annualizedExcessReturn = meanExcessReturn * 252
    const annualizedExcessBenchmark = meanExcessBenchmark * 252
    const alpha = annualizedExcessReturn - (beta * annualizedExcessBenchmark)

    return { beta, alpha }
  }

  /**
   * Detect and handle corporate actions (splits, dividends)
   */
  static adjustForCorporateActions(data: PriceDataPoint[]): PriceDataPoint[] {
    const adjusted: PriceDataPoint[] = []
    let cumulativeAdjustment = 1

    // Process from oldest to newest
    for (let i = 0; i < data.length; i++) {
      const point = data[i]
      
      // Apply split adjustment
      if (point.splitRatio && point.splitRatio !== 1) {
        cumulativeAdjustment *= point.splitRatio
      }

      // Adjust prices for splits
      const adjustedPoint: PriceDataPoint = {
        ...point,
        open: point.open ? point.open / cumulativeAdjustment : null,
        high: point.high ? point.high / cumulativeAdjustment : null,
        low: point.low ? point.low / cumulativeAdjustment : null,
        close: point.close ? point.close / cumulativeAdjustment : null,
        volume: point.volume ? point.volume * cumulativeAdjustment : null
      }

      adjusted.push(adjustedPoint)
    }

    return adjusted
  }

  /**
   * Calculate rolling metrics (volatility, returns, etc.)
   */
  static calculateRollingMetrics(
    data: PriceDataPoint[], 
    windowSize: number,
    metric: 'volatility' | 'return' | 'sharpe'
  ): Array<{ date: Date, value: number | null }> {
    const result: Array<{ date: Date, value: number | null }> = []
    
    if (data.length < windowSize) {
      return data.map(point => ({ date: point.date, value: null }))
    }

    for (let i = windowSize - 1; i < data.length; i++) {
      const windowData = data.slice(i - windowSize + 1, i + 1)
      const returns = this.calculateReturns(windowData)
      
      let value: number | null = null

      switch (metric) {
        case 'volatility':
          if (returns.length > 1) {
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length
            const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length
            value = Math.sqrt(variance * 252) // Annualized
          }
          break
        case 'return':
          if (returns.length > 0) {
            const totalReturn = returns.reduce((product, ret) => product * (1 + ret), 1) - 1
            value = Math.pow(1 + totalReturn, 252 / returns.length) - 1 // Annualized
          }
          break
        case 'sharpe':
          if (returns.length > 1) {
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length
            const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length
            const vol = Math.sqrt(variance * 252)
            const annualizedReturn = mean * 252
            value = vol !== 0 ? (annualizedReturn - 0.02) / vol : null // Assuming 2% risk-free rate
          }
          break
      }

      result.push({ date: data[i].date, value })
    }

    return result
  }

  /**
   * Convert Prisma Decimal to number safely
   */
  static decimalToNumber(decimal: Decimal | null | undefined): number | null {
    if (decimal === null || decimal === undefined) return null
    return typeof decimal === 'number' ? decimal : Number(decimal.toString())
  }

  /**
   * Format percentage for display
   */
  static formatPercentage(value: number | null | undefined, decimals = 2): string {
    if (value === null || value === undefined || isNaN(value)) return 'N/A'
    return `${(value * 100).toFixed(decimals)}%`
  }

  /**
   * Format currency for display
   */
  static formatCurrency(value: number | null | undefined, currency = 'USD'): string {
    if (value === null || value === undefined || isNaN(value)) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  /**
   * Format large numbers (AUM, market cap, etc.)
   */
  static formatLargeNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) return 'N/A'
    
    const abs = Math.abs(value)
    if (abs >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
    if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
    return `$${value.toFixed(0)}`
  }
}
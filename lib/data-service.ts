import { cache, rateLimit } from './redis'
import { prisma } from './db'
import { MarketData, ETFInfo } from '@prisma/client'

interface CurrentPriceData {
  price: number
  change: number
  changePercent: number
  timestamp: string
  source: 'fmp' | 'yahoo'
}

interface HistoricalDataPoint {
  symbol: string
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  adjClose: number | null
  volume: number | null
  dividend: number
  splitRatio: number
}

interface ETFInfoData {
  symbol: string
  name: string
  description?: string
  expenseRatio?: number
  aum?: number
  category?: string
  sector?: string
  benchmark?: string
  isActive: boolean
}

interface ETFFundamentals {
  expenseRatio?: number
  aum?: number
  peRatio?: number
  yield?: number
  beta?: number
  nav?: number
  inceptionDate?: string
  dividendYield?: number
  holdingsCount?: number
  turnoverRate?: number
  volatility1y?: number
  sharpeRatio1y?: number
  maxDrawdown1y?: number
  source: 'fmp' | 'yahoo'
}

interface SecuritySearchResult {
  symbol: string
  name: string
  type: string
  category?: string
  sector?: string
  exchange?: string
  source: 'fmp' | 'yahoo' | 'database'
}

interface DataCoverage {
  symbol: string
  firstDate?: string
  lastDate?: string
  totalRecords: number
  hasData: boolean
  error?: string
}

interface DividendData {
  date: string
  dividend: number
}

interface SplitData {
  date: string
  splitRatio: number
}

export class DataService {
  private fmpApiKey: string
  private alphaVantageKey?: string
  private fmpBaseUrl = 'https://financialmodelingprep.com/api/v3'
  private cacheTimeout = 3600 // 1 hour cache
  private currentPriceCacheTimeout = 1800 // 30 minutes cache

  constructor() {
    this.fmpApiKey = process.env.FMP_API_KEY || 'Ejh2emZcJzogsHafpis8ogaXO7nPZDPI'
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY
  }

  /**
   * Get current price for a symbol - try FMP first, fallback to Yahoo Finance
   */
  async getCurrentPrice(symbol: string): Promise<CurrentPriceData> {
    try {
      // Try cache first
      const cached = await cache.financial.getCurrentPrice<CurrentPriceData>(symbol)
      if (cached) {
        return cached
      }

      // Try FMP first
      const fmpData = await this._getFmpCurrentPrice(symbol)
      if (fmpData) {
        await cache.financial.cacheCurrentPrice(symbol, fmpData)
        return fmpData
      }

      // Fallback to Yahoo Finance equivalent (using a mock implementation)
      console.warn(`FMP failed for ${symbol}, trying Yahoo Finance equivalent`)
      const yahooData = await this._getYahooCurrentPrice(symbol)
      
      await cache.financial.cacheCurrentPrice(symbol, yahooData)
      return yahooData

    } catch (error) {
      console.error(`Failed to get current price for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Get historical data for a symbol - try FMP first, fallback to Yahoo Finance
   */
  async getHistoricalData(symbol: string, startDate: Date, endDate: Date): Promise<HistoricalDataPoint[]> {
    try {
      // First check database for exact date range coverage
      const dbData = await prisma.marketData.findMany({
        where: {
          symbol: symbol,
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { date: 'asc' }
      })

      // Check if we have complete coverage for the requested date range
      if (dbData.length > 0) {
        const firstDbDate = new Date(Math.min(...dbData.map(d => d.date.getTime())))
        const lastDbDate = new Date(Math.max(...dbData.map(d => d.date.getTime())))

        // Only use cached data if we have complete coverage for the requested range
        if (firstDbDate <= startDate && lastDbDate >= endDate) {
          // Check for reasonable data density (at least 80% of business days)
          const totalBusinessDays = this._getBusinessDayCount(startDate, endDate)
          const actualDataPoints = dbData.length

          if (actualDataPoints >= (totalBusinessDays * 0.8)) {
            console.info(`Using cached data for ${symbol} (${actualDataPoints} points)`)
            return dbData.map(this._convertPrismaToHistoricalData)
          } else {
            console.warn(`Cached data for ${symbol} is sparse (${actualDataPoints}/${totalBusinessDays}), fetching fresh data`)
          }
        } else {
          console.warn(`Cached data for ${symbol} doesn't cover full range, fetching fresh data`)
        }
      } else {
        console.info(`No cached data found for ${symbol}, fetching from API`)
      }

      // Try FMP first
      const fmpData = await this._getFmpHistoricalData(symbol, startDate, endDate)
      if (fmpData && fmpData.length > 0) {
        return fmpData
      }

      // Fallback to Yahoo Finance equivalent
      console.warn(`FMP historical data failed for ${symbol}, trying Yahoo Finance equivalent`)
      return await this._getYahooHistoricalData(symbol, startDate, endDate)

    } catch (error) {
      console.error(`Failed to get historical data for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Fetch ETF information from external APIs - try FMP first, fallback to Yahoo
   */
  async fetchETFInfo(symbol: string): Promise<ETFInfoData | null> {
    try {
      // Try cache first
      const cached = await cache.financial.getETFInfo<ETFInfoData>(symbol)
      if (cached) {
        return cached
      }

      // Try FMP first
      const fmpData = await this._getFmpETFInfo(symbol)
      if (fmpData) {
        await cache.financial.cacheETFInfo(symbol, fmpData)
        return fmpData
      }

      // Fallback to Yahoo Finance equivalent
      console.warn(`FMP ETF info failed for ${symbol}, trying Yahoo Finance equivalent`)
      const yahooData = await this._getYahooETFInfo(symbol)
      
      if (yahooData) {
        await cache.financial.cacheETFInfo(symbol, yahooData)
      }
      
      return yahooData

    } catch (error) {
      console.error(`Failed to fetch ETF info for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get ETF fundamental data - try FMP first, fallback to Yahoo
   */
  async getETFFundamentals(symbol: string): Promise<ETFFundamentals> {
    try {
      // Try FMP first
      const fmpFundamentals = await this._getFmpFundamentals(symbol)
      if (fmpFundamentals) {
        return fmpFundamentals
      }

      // Fallback to Yahoo Finance equivalent
      console.warn(`FMP fundamentals failed for ${symbol}, trying Yahoo Finance equivalent`)
      return await this._getYahooFundamentals(symbol)

    } catch (error) {
      console.error(`Failed to get fundamentals for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Search for securities by name or symbol - try FMP first, fallback to local DB and Yahoo
   */
  async searchSecurities(query: string): Promise<SecuritySearchResult[]> {
    try {
      const results: SecuritySearchResult[] = []

      // Try FMP search first
      const fmpResults = await this._searchFmpSecurities(query)
      if (fmpResults) {
        results.push(...fmpResults.slice(0, 5)) // Take top 5 from FMP
      }

      // Search in our database
      const dbResults = await prisma.eTFInfo.findMany({
        where: {
          AND: [
            {
              OR: [
                { symbol: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } }
              ]
            },
            { isActive: true }
          ]
        },
        take: 5
      })

      for (const etf of dbResults) {
        // Avoid duplicates
        if (!results.some(r => r.symbol === etf.symbol)) {
          results.push({
            symbol: etf.symbol,
            name: etf.name,
            type: 'ETF',
            category: etf.category || undefined,
            sector: etf.sector || undefined,
            source: 'database'
          })
        }
      }

      return results.slice(0, 10) // Return max 10 results

    } catch (error) {
      console.error(`Failed to search securities for query: ${query}:`, error)
      return []
    }
  }

  /**
   * Get data coverage information for a symbol
   */
  async getDataCoverage(symbol: string): Promise<DataCoverage> {
    try {
      const aggregateResult = await prisma.marketData.aggregate({
        where: { symbol },
        _min: { date: true },
        _max: { date: true },
        _count: true
      })

      return {
        symbol,
        firstDate: aggregateResult._min.date?.toISOString().split('T')[0],
        lastDate: aggregateResult._max.date?.toISOString().split('T')[0],
        totalRecords: aggregateResult._count,
        hasData: aggregateResult._count > 0
      }

    } catch (error) {
      console.error(`Failed to get data coverage for ${symbol}:`, error)
      return {
        symbol,
        hasData: false,
        totalRecords: 0,
        error: String(error)
      }
    }
  }

  /**
   * Validate if symbols exist and have data
   */
  async validateSymbols(symbols: string[]): Promise<Record<string, boolean>> {
    const validationResults: Record<string, boolean> = {}

    for (const symbol of symbols) {
      try {
        // Simple validation - check if we can get current price
        await this.getCurrentPrice(symbol)
        validationResults[symbol] = true
      } catch {
        validationResults[symbol] = false
      }
    }

    return validationResults
  }

  /**
   * Clear cached data for a symbol and date range
   */
  async clearCachedData(symbol: string, startDate?: Date, endDate?: Date): Promise<void> {
    try {
      // Clear Redis cache
      await cache.del(`current_price_${symbol}`)
      await cache.del(`etf_info_${symbol}`)
      
      if (startDate && endDate) {
        const cacheKey = this._generateCacheKey(symbol, startDate, endDate)
        await cache.del(cacheKey)
      }

      // Clear database cache for date range if specified
      if (startDate && endDate) {
        const deletedCount = await prisma.marketData.deleteMany({
          where: {
            symbol,
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        })
        console.info(`Cleared ${deletedCount.count} database records for ${symbol}`)
      }

    } catch (error) {
      console.error(`Failed to clear cached data for ${symbol}:`, error)
    }
  }

  // Private helper methods

  private async _getFmpCurrentPrice(symbol: string): Promise<CurrentPriceData | null> {
    try {
      // Check rate limit before making request
      const rateLimitOk = await rateLimit.checkFmpRate()
      if (!rateLimitOk) {
        console.warn('FMP rate limit exceeded, skipping request')
        return null
      }

      const url = `${this.fmpBaseUrl}/quote/${symbol}`
      const params = new URLSearchParams({ apikey: this.fmpApiKey })

      const response = await fetch(`${url}?${params}`, { 
        signal: AbortSignal.timeout(10000) 
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (!data || data.length === 0) {
        return null
      }

      const quote = data[0]
      const currentPrice = quote.price
      const previousClose = quote.previousClose

      if (currentPrice && previousClose) {
        const change = quote.change || 0
        const changePercent = quote.changesPercentage || 0

        return {
          price: currentPrice,
          change,
          changePercent,
          timestamp: new Date().toISOString(),
          source: 'fmp'
        }
      }

      return null

    } catch (error) {
      console.warn(`FMP current price failed for ${symbol}:`, error)
      return null
    }
  }

  private async _getYahooCurrentPrice(symbol: string): Promise<CurrentPriceData> {
    // This is a placeholder implementation
    // In a real implementation, you would use a Yahoo Finance API or equivalent
    throw new Error('Yahoo Finance implementation not available in this environment')
  }

  private async _getFmpHistoricalData(symbol: string, startDate: Date, endDate: Date): Promise<HistoricalDataPoint[] | null> {
    try {
      // Check rate limit before making request
      const rateLimitOk = await rateLimit.checkFmpRate()
      if (!rateLimitOk) {
        console.warn('FMP rate limit exceeded, skipping historical data request')
        return null
      }

      const url = `${this.fmpBaseUrl}/historical-price-full/${symbol}`
      const params = new URLSearchParams({
        apikey: this.fmpApiKey,
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0]
      })

      const response = await fetch(`${url}?${params}`, { 
        signal: AbortSignal.timeout(30000) 
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (!data || !data.historical) {
        return null
      }

      const historicalData = data.historical
      if (!historicalData.length) {
        return null
      }

      // Convert FMP format to our standard format
      const dataList: HistoricalDataPoint[] = []
      for (const item of historicalData.reverse()) { // FMP returns newest first, we want oldest first
        dataList.push({
          symbol,
          date: item.date,
          open: item.open ?? null,
          high: item.high ?? null,
          low: item.low ?? null,
          close: item.close ?? null,
          adjClose: item.adjClose ?? null,
          volume: item.volume ?? null,
          dividend: 0,
          splitRatio: 1
        })
      }

      // Store in database for future use
      await this._storeMarketDataFromList(dataList)

      return dataList

    } catch (error) {
      console.warn(`FMP historical data failed for ${symbol}:`, error)
      return null
    }
  }

  private async _getYahooHistoricalData(symbol: string, startDate: Date, endDate: Date): Promise<HistoricalDataPoint[]> {
    // This is a placeholder implementation
    // In a real implementation, you would use a Yahoo Finance API or equivalent
    throw new Error('Yahoo Finance implementation not available in this environment')
  }

  private async _getFmpETFInfo(symbol: string): Promise<ETFInfoData | null> {
    try {
      // Get company profile
      const profileUrl = `${this.fmpBaseUrl}/profile/${symbol}`
      const params = new URLSearchParams({ apikey: this.fmpApiKey })

      const response = await fetch(`${profileUrl}?${params}`, { 
        signal: AbortSignal.timeout(10000) 
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const profileData = await response.json()
      if (!profileData || profileData.length === 0) {
        return null
      }

      const profile = profileData[0]

      const etfData: ETFInfoData = {
        symbol,
        name: profile.companyName || symbol,
        description: profile.description || '',
        sector: profile.sector,
        isActive: true
      }

      // Store in database if not exists
      await this._storeETFInfo(etfData)

      return etfData

    } catch (error) {
      console.warn(`FMP ETF info failed for ${symbol}:`, error)
      return null
    }
  }

  private async _getYahooETFInfo(symbol: string): Promise<ETFInfoData | null> {
    // This is a placeholder implementation
    // In a real implementation, you would use a Yahoo Finance API or equivalent
    return null
  }

  private async _getFmpFundamentals(symbol: string): Promise<ETFFundamentals | null> {
    try {
      const fundamentals: ETFFundamentals = { source: 'fmp' }

      // Get key metrics
      const metricsUrl = `${this.fmpBaseUrl}/key-metrics/${symbol}`
      const params = new URLSearchParams({ 
        apikey: this.fmpApiKey, 
        limit: '1' 
      })

      const response = await fetch(`${metricsUrl}?${params}`, { 
        signal: AbortSignal.timeout(10000) 
      })
      
      if (response.ok) {
        const metricsData = await response.json()
        if (metricsData && metricsData.length > 0) {
          const metrics = metricsData[0]
          fundamentals.peRatio = metrics.peRatio
          fundamentals.beta = metrics.beta
        }
      }

      // Calculate risk metrics using historical data if available
      try {
        const endDate = new Date()
        const startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000)
        const histData = await this._getFmpHistoricalData(symbol, startDate, endDate)

        if (histData && histData.length > 20) {
          const prices = histData
            .map(d => d.close)
            .filter((price): price is number => price !== null)

          if (prices.length > 1) {
            const returns = prices.slice(1).map((price, i) => 
              (price - prices[i]) / prices[i]
            )

            if (returns.length > 0) {
              const volatility = this._calculateStandardDeviation(returns) * Math.sqrt(252)
              const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length * 252
              const sharpeRatio = volatility !== 0 ? meanReturn / volatility : null

              // Calculate max drawdown
              let peak = prices[0]
              let maxDD = 0
              for (const price of prices) {
                if (price > peak) {
                  peak = price
                }
                const drawdown = (peak - price) / peak
                if (drawdown > maxDD) {
                  maxDD = drawdown
                }
              }

              fundamentals.volatility1y = volatility
              fundamentals.sharpeRatio1y = sharpeRatio
              fundamentals.maxDrawdown1y = maxDD
            }
          }
        }
      } catch {
        // Risk metrics are optional
      }

      return Object.keys(fundamentals).length > 1 ? fundamentals : null

    } catch (error) {
      console.warn(`FMP fundamentals failed for ${symbol}:`, error)
      return null
    }
  }

  private async _getYahooFundamentals(symbol: string): Promise<ETFFundamentals> {
    // This is a placeholder implementation
    // In a real implementation, you would use a Yahoo Finance API or equivalent
    return { source: 'yahoo' }
  }

  private async _searchFmpSecurities(query: string): Promise<SecuritySearchResult[] | null> {
    try {
      const url = `${this.fmpBaseUrl}/search`
      const params = new URLSearchParams({ 
        apikey: this.fmpApiKey, 
        query, 
        limit: '10' 
      })

      const response = await fetch(`${url}?${params}`, { 
        signal: AbortSignal.timeout(10000) 
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (!data) {
        return null
      }

      const results: SecuritySearchResult[] = []
      for (const item of data) {
        if (item.symbol && item.name) {
          results.push({
            symbol: item.symbol,
            name: item.name,
            type: item.exchangeShortName || 'Unknown',
            exchange: item.exchangeShortName,
            source: 'fmp'
          })
        }
      }

      return results

    } catch (error) {
      console.warn(`FMP search failed for query: ${query}:`, error)
      return null
    }
  }

  private async _storeMarketDataFromList(dataList: HistoricalDataPoint[]): Promise<void> {
    try {
      if (!dataList.length) {
        return
      }

      const symbol = dataList[0].symbol
      const newDates = dataList.map(d => new Date(d.date))
      const startDate = new Date(Math.min(...newDates.map(d => d.getTime())))
      const endDate = new Date(Math.max(...newDates.map(d => d.getTime())))

      // Clear any existing data in this date range to avoid stale data
      await prisma.marketData.deleteMany({
        where: {
          symbol,
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      })

      // Add new data
      const createData = dataList.map(dataPoint => ({
        symbol: dataPoint.symbol,
        date: new Date(dataPoint.date),
        open: dataPoint.open,
        high: dataPoint.high,
        low: dataPoint.low,
        close: dataPoint.close,
        adjClose: dataPoint.adjClose,
        volume: dataPoint.volume ? BigInt(dataPoint.volume) : null,
        dividend: dataPoint.dividend,
        splitRatio: dataPoint.splitRatio
      }))

      await prisma.marketData.createMany({
        data: createData,
        skipDuplicates: true
      })

      console.info(`Stored ${dataList.length} data points for ${symbol} (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`)

    } catch (error) {
      console.error(`Failed to store market data from list:`, error)
    }
  }

  private async _storeETFInfo(etfData: ETFInfoData): Promise<void> {
    try {
      await prisma.eTFInfo.upsert({
        where: { symbol: etfData.symbol },
        update: {
          name: etfData.name,
          description: etfData.description,
          sector: etfData.sector,
          category: etfData.category,
          isActive: etfData.isActive
        },
        create: {
          symbol: etfData.symbol,
          name: etfData.name,
          description: etfData.description,
          sector: etfData.sector,
          category: etfData.category,
          isActive: etfData.isActive
        }
      })
    } catch (error) {
      console.error(`Failed to store ETF info for ${etfData.symbol}:`, error)
    }
  }

  private _convertPrismaToHistoricalData(data: MarketData): HistoricalDataPoint {
    return {
      symbol: data.symbol,
      date: data.date.toISOString().split('T')[0],
      open: data.open ? Number(data.open) : null,
      high: data.high ? Number(data.high) : null,
      low: data.low ? Number(data.low) : null,
      close: data.close ? Number(data.close) : null,
      adjClose: data.adjClose ? Number(data.adjClose) : null,
      volume: data.volume ? Number(data.volume) : null,
      dividend: Number(data.dividend),
      splitRatio: Number(data.splitRatio)
    }
  }

  private _getBusinessDayCount(startDate: Date, endDate: Date): number {
    let count = 0
    const current = new Date(startDate)
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        count++
      }
      current.setDate(current.getDate() + 1)
    }
    
    return count
  }

  private _generateCacheKey(symbol: string, startDate: Date, endDate: Date): string {
    return `historical_data_${symbol}_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`
  }

  private _calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2))
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length
    return Math.sqrt(avgSquaredDiff)
  }
}

// Export singleton instance
export const dataService = new DataService()
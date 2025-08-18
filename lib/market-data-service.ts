import { prisma } from '@/lib/db'
import { marketDataCache } from '@/lib/redis'

interface MarketDataPoint {
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
  adjClose: number | null
  dividend: number
  splitRatio: number
}

interface CurrentPriceData {
  symbol: string
  price: number
  change: number
  changePercent: number
  timestamp: string
  source: string
}

export class MarketDataService {
  private fmpApiKey: string
  private fmpBaseUrl = 'https://financialmodelingprep.com/api/v3'

  constructor() {
    this.fmpApiKey = process.env.FMP_API_KEY || 'Ejh2emZcJzogsHafpis8ogaXO7nPZDPI'
  }

  async getCurrentPrice(symbol: string): Promise<CurrentPriceData> {
    try {
      // Check cache first
      const cached = await marketDataCache.getCurrentPrice(symbol)
      if (cached) {
        return cached
      }
    } catch (cacheError) {
      console.warn('Cache error, continuing without cache:', cacheError)
    }

    try {
      // Try FMP first
      const fmpData = await this.getFMPCurrentPrice(symbol)
      if (fmpData) {
        try {
          await marketDataCache.setCurrentPrice(symbol, fmpData)
        } catch (cacheError) {
          console.warn('Failed to cache price data:', cacheError)
        }
        return fmpData
      }

      // Fallback to Yahoo Finance using external service
      const yahooData = await this.getYahooCurrentPrice(symbol)
      if (yahooData) {
        try {
          await marketDataCache.setCurrentPrice(symbol, yahooData)
        } catch (cacheError) {
          console.warn('Failed to cache price data:', cacheError)
        }
        return yahooData
      }

      throw new Error(`No price data available for ${symbol}`)
    } catch (error) {
      console.error(`Failed to get current price for ${symbol}:`, error)
      throw error
    }
  }

  async getHistoricalData(
    symbol: string,
    period: string = '1y',
    interval: string = '1d'
  ): Promise<MarketDataPoint[]> {
    const cacheKey = `${symbol}:${period}:${interval}`
    
    try {
      // Check cache first
      const cached = await marketDataCache.getHistoricalData(symbol, cacheKey)
      if (cached) {
        return cached
      }
    } catch (cacheError) {
      console.warn('Cache error, continuing without cache:', cacheError)
    }

    try {
      let data: MarketDataPoint[] = []

      // Try to get from FMP
      if (interval === '1d') {
        const periodDates = this.getPeriodDates(period)
        console.log(`Market data for ${symbol}: period="${period}", dates=${periodDates.from} to ${periodDates.to}`)
        data = await this.getFMPHistoricalData(symbol, periodDates)
      }

      // Fallback to database
      if (data.length === 0) {
        try {
          data = await this.getHistoricalDataFromDB(symbol, period)
        } catch (dbError) {
          console.warn('Database error, skipping database fallback:', dbError)
        }
      }

      // Fallback to Yahoo Finance
      if (data.length === 0) {
        data = await this.getYahooHistoricalData(symbol, period, interval)
      }

      if (data.length > 0) {
        try {
          await marketDataCache.setHistoricalData(symbol, cacheKey, data)
        } catch (cacheError) {
          console.warn('Failed to cache historical data:', cacheError)
        }
      }

      return data
    } catch (error) {
      console.error(`Failed to get historical data for ${symbol}:`, error)
      throw error
    }
  }

  async getBulkHistoricalData(
    symbols: string[],
    period: string = '1y',
    interval: string = '1d'
  ): Promise<Record<string, MarketDataPoint[]>> {
    const results: Record<string, MarketDataPoint[]> = {}
    
    // Process symbols in batches to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const batchPromises = batch.map(async (symbol) => {
        try {
          const data = await this.getHistoricalData(symbol, period, interval)
          return { symbol, data }
        } catch (error) {
          console.error(`Failed to get data for ${symbol}:`, error)
          return { symbol, data: [] }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(({ symbol, data }) => {
        results[symbol] = data
      })

      // Add delay between batches to respect rate limits
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }

  async getBulkHistoricalDataByDateRange(
    symbols: string[],
    fromDate: string,
    toDate: string,
    interval: string = '1d'
  ): Promise<Record<string, MarketDataPoint[]>> {
    const results: Record<string, MarketDataPoint[]> = {}
    
    // Process symbols in batches to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      
      // Add overall timeout for the entire batch
      const batchTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Batch timeout for symbols: ${batch.join(', ')}`)), 120000) // 2 minutes
      })
      
      const batchPromises = batch.map(async (symbol) => {
        try {
          console.log(`Fetching ${symbol} data from ${fromDate} to ${toDate}`)
          const data = await this.getFMPHistoricalData(symbol, { from: fromDate, to: toDate })
          console.log(`Successfully fetched ${data.length} data points for ${symbol}`)
          return { symbol, data }
        } catch (error) {
          console.error(`Failed to get data for ${symbol}:`, error)
          return { symbol, data: [] }
        }
      })

      try {
        const batchResults = await Promise.race([
          Promise.all(batchPromises),
          batchTimeout
        ])
        
        batchResults.forEach(({ symbol, data }) => {
          results[symbol] = data
        })
        
        console.log(`Completed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(symbols.length/batchSize)}`)
      } catch (error) {
        console.error(`Batch failed for symbols ${batch.join(', ')}:`, error)
        // Add empty results for failed batch symbols to prevent hanging
        batch.forEach(symbol => {
          results[symbol] = []
        })
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }

  private async getFMPCurrentPrice(symbol: string): Promise<CurrentPriceData | null> {
    try {
      const url = `${this.fmpBaseUrl}/quote/${symbol}?apikey=${this.fmpApiKey}`
      const response = await fetch(url, { 
        next: { revalidate: 300 } // Cache for 5 minutes
      })
      
      if (!response.ok) {
        throw new Error(`FMP API error: ${response.status}`)
      }

      const data = await response.json()
      if (!data || data.length === 0) {
        return null
      }

      const quote = data[0]
      return {
        symbol: quote.symbol,
        price: quote.price || 0,
        change: quote.change || 0,
        changePercent: quote.changesPercentage || 0,
        timestamp: new Date().toISOString(),
        source: 'fmp',
      }
    } catch (error) {
      console.error(`FMP current price failed for ${symbol}:`, error)
      return null
    }
  }

  private async getFMPHistoricalData(
    symbol: string,
    { from, to }: { from: string; to: string }
  ): Promise<MarketDataPoint[]> {
    try {
      const url = `${this.fmpBaseUrl}/historical-price-full/${symbol}?from=${from}&to=${to}&apikey=${this.fmpApiKey}`
      
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`FMP API timeout for ${symbol} after 30 seconds`)), 30000)
      })
      
      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(url, {
          next: { revalidate: 3600 }, // Cache for 1 hour
          signal: AbortSignal.timeout(25000) // Abort after 25 seconds
        }),
        timeoutPromise
      ])

      if (!response.ok) {
        throw new Error(`FMP API error: ${response.status}`)
      }

      const data = await response.json()
      if (!data?.historical) {
        return []
      }

      return data.historical.map((item: any) => ({
        date: item.date,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        adjClose: item.adjClose,
        dividend: 0,
        splitRatio: 1,
      })).reverse() // FMP returns newest first, we want oldest first
    } catch (error) {
      console.error(`FMP historical data failed for ${symbol}:`, error)
      return []
    }
  }

  private async getHistoricalDataFromDB(
    symbol: string,
    period: string
  ): Promise<MarketDataPoint[]> {
    try {
      const { from, to } = this.getPeriodDates(period)
      
      const data = await prisma.marketData.findMany({
        where: {
          symbol: symbol.toUpperCase(),
          date: {
            gte: new Date(from),
            lte: new Date(to),
          },
        },
        orderBy: { date: 'asc' },
      })

      return data.map(item => ({
        date: item.date.toISOString().split('T')[0],
        open: item.open ? Number(item.open) : null,
        high: item.high ? Number(item.high) : null,
        low: item.low ? Number(item.low) : null,
        close: item.close ? Number(item.close) : null,
        volume: item.volume ? Number(item.volume) : null,
        adjClose: item.adjClose ? Number(item.adjClose) : null,
        dividend: Number(item.dividend),
        splitRatio: Number(item.splitRatio),
      }))
    } catch (error) {
      console.error(`Database query failed for ${symbol}:`, error)
      return []
    }
  }

  private async getYahooCurrentPrice(symbol: string): Promise<CurrentPriceData | null> {
    try {
      // This would typically use a Yahoo Finance API or scraping service
      // For now, return null to indicate fallback not available
      return null
    } catch (error) {
      console.error(`Yahoo current price failed for ${symbol}:`, error)
      return null
    }
  }

  private async getYahooHistoricalData(
    symbol: string,
    period: string,
    interval: string
  ): Promise<MarketDataPoint[]> {
    try {
      // This would typically use a Yahoo Finance API or scraping service
      // For now, return empty array to indicate fallback not available
      return []
    } catch (error) {
      console.error(`Yahoo historical data failed for ${symbol}:`, error)
      return []
    }
  }

  private getPeriodDates(period: string): { from: string; to: string } {
    const to = new Date()
    const from = new Date()

    switch (period) {
      case '1d':
        from.setDate(from.getDate() - 1)
        break
      case '5d':
        from.setDate(from.getDate() - 5)
        break
      case '1mo':
        from.setMonth(from.getMonth() - 1)
        break
      case '3mo':
        from.setMonth(from.getMonth() - 3)
        break
      case '6mo':
        from.setMonth(from.getMonth() - 6)
        break
      case '1y':
        from.setFullYear(from.getFullYear() - 1)
        break
      case '2y':
        from.setFullYear(from.getFullYear() - 2)
        break
      case '5y':
        from.setFullYear(from.getFullYear() - 5)
        break
      case '10y':
        from.setFullYear(from.getFullYear() - 10)
        break
      case 'ytd':
        from.setMonth(0, 1) // January 1st of current year
        break
      case 'max':
        from.setFullYear(from.getFullYear() - 20) // 20 years
        break
      default:
        from.setFullYear(from.getFullYear() - 1) // Default to 1 year
    }

    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    }
  }

  async saveMarketData(symbol: string, data: MarketDataPoint[]): Promise<void> {
    try {
      const records = data.map(item => ({
        symbol: symbol.toUpperCase(),
        date: new Date(item.date),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume ? BigInt(item.volume) : null,
        adjClose: item.adjClose,
        dividend: item.dividend,
        splitRatio: item.splitRatio,
      }))

      // Use upsert to handle duplicates
      for (const record of records) {
        await prisma.marketData.upsert({
          where: {
            symbol_date: {
              symbol: record.symbol,
              date: record.date,
            },
          },
          update: record,
          create: record,
        })
      }
    } catch (error) {
      console.error(`Failed to save market data for ${symbol}:`, error)
      throw error
    }
  }
}
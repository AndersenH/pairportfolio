// Cache utilities that can be used on both client and server
// This file does not import Redis directly

// Cache TTL constants for financial data (in seconds)
export const CACHE_DURATIONS = {
  CURRENT_PRICES: 300,        // 5 minutes
  INTRADAY_DATA: 600,         // 10 minutes
  DAILY_HISTORICAL: 86400,    // 24 hours
  WEEKLY_HISTORICAL: 604800,  // 7 days
  COMPANY_INFO: 2592000,      // 30 days
  ETF_HOLDINGS: 86400,        // 24 hours
  FUNDAMENTALS: 43200,        // 12 hours
  SEARCH_RESULTS: 3600,       // 1 hour
  PERFORMANCE_METRICS: 3600,  // 1 hour
  MARKET_HOLIDAYS: 86400,     // 24 hours
} as const

export interface CacheOptions {
  ttl?: number
  compress?: boolean
  namespace?: string
}

// Client-side in-memory cache for browser
const browserCache = new Map<string, { value: any; expires: number }>()

// Helper to check if we're on the server
const isServer = typeof window === 'undefined'

// Get the appropriate cache client
async function getCacheClient() {
  if (isServer) {
    const { redisClient } = await import('./redis-server')
    return redisClient
  }
  
  // Return a browser-compatible cache implementation
  return {
    async get(key: string): Promise<string | null> {
      const item = browserCache.get(key)
      if (!item) return null
      
      if (Date.now() > item.expires) {
        browserCache.delete(key)
        return null
      }
      
      return JSON.stringify(item.value)
    },
    
    async setex(key: string, ttl: number, value: string): Promise<void> {
      browserCache.set(key, {
        value: JSON.parse(value),
        expires: Date.now() + (ttl * 1000)
      })
    },
    
    async del(...keys: string[]): Promise<void> {
      keys.forEach(key => browserCache.delete(key))
    },
    
    async exists(key: string): Promise<number> {
      const item = browserCache.get(key)
      if (!item || Date.now() > item.expires) return 0
      return 1
    },
    
    async ttl(key: string): Promise<number> {
      const item = browserCache.get(key)
      if (!item) return -2
      const remaining = Math.floor((item.expires - Date.now()) / 1000)
      return remaining > 0 ? remaining : -1
    },
    
    async incr(key: string): Promise<number> {
      const item = browserCache.get(key)
      const current = item && Date.now() <= item.expires ? (item.value || 0) : 0
      const newValue = current + 1
      browserCache.set(key, {
        value: newValue,
        expires: item?.expires || (Date.now() + 60000)
      })
      return newValue
    },
    
    async expire(key: string, ttl: number): Promise<void> {
      const item = browserCache.get(key)
      if (item) {
        item.expires = Date.now() + (ttl * 1000)
      }
    },
    
    async keys(pattern: string): Promise<string[]> {
      const regex = new RegExp(pattern.replace('*', '.*'))
      return Array.from(browserCache.keys()).filter(key => regex.test(key))
    },
    
    async mget(...keys: string[]): Promise<(string | null)[]> {
      return Promise.all(keys.map(key => this.get(key)))
    },
    
    pipeline() {
      const operations: (() => Promise<any>)[] = []
      return {
        setex: (key: string, ttl: number, value: string) => {
          operations.push(async () => {
            const client = await getCacheClient()
            return client.setex(key, ttl, value)
          })
          return this
        },
        exec: async () => {
          return Promise.all(operations.map(op => op()))
        }
      }
    }
  }
}

export const cache = {
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const client = await getCacheClient()
      const fullKey = options.namespace ? `${options.namespace}:${key}` : key
      const value = await client.get(fullKey)
      if (!value) return null

      if (options.compress && value.startsWith('COMPRESSED:')) {
        const compressedData = value.substring(11)
        return JSON.parse(compressedData)
      }

      return JSON.parse(value)
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  },

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    try {
      const client = await getCacheClient()
      const fullKey = options.namespace ? `${options.namespace}:${key}` : key
      const ttl = options.ttl || CACHE_DURATIONS.DAILY_HISTORICAL
      
      let serializedValue = JSON.stringify(value)
      
      if (options.compress && serializedValue.length > 1000) {
        serializedValue = `COMPRESSED:${serializedValue}`
      }

      await client.setex(fullKey, ttl, serializedValue)
    } catch (error) {
      console.error('Cache set error:', error)
    }
  },

  async del(key: string, namespace?: string): Promise<void> {
    try {
      const client = await getCacheClient()
      const fullKey = namespace ? `${namespace}:${key}` : key
      await client.del(fullKey)
    } catch (error) {
      console.error('Cache del error:', error)
    }
  },

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const client = await getCacheClient()
      const keys = await client.keys(pattern)
      if (keys.length > 0) {
        await client.del(...keys)
      }
    } catch (error) {
      console.error('Cache invalidate pattern error:', error)
    }
  },

  async mget<T>(keys: string[], namespace?: string): Promise<(T | null)[]> {
    try {
      const client = await getCacheClient()
      const fullKeys = namespace ? keys.map(key => `${namespace}:${key}`) : keys
      const values = await client.mget(...fullKeys)
      
      return values.map(value => {
        if (!value) return null
        try {
          return JSON.parse(value)
        } catch {
          return null
        }
      })
    } catch (error) {
      console.error('Cache mget error:', error)
      return keys.map(() => null)
    }
  },

  async mset(keyValuePairs: Record<string, any>, options: CacheOptions = {}): Promise<void> {
    try {
      const client = await getCacheClient()
      const pipeline = client.pipeline()
      const ttl = options.ttl || CACHE_DURATIONS.DAILY_HISTORICAL
      
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        const fullKey = options.namespace ? `${options.namespace}:${key}` : key
        pipeline.setex(fullKey, ttl, JSON.stringify(value))
      })
      
      await pipeline.exec()
    } catch (error) {
      console.error('Cache mset error:', error)
    }
  },

  async exists(key: string, namespace?: string): Promise<boolean> {
    try {
      const client = await getCacheClient()
      const fullKey = namespace ? `${namespace}:${key}` : key
      const result = await client.exists(fullKey)
      return result === 1
    } catch (error) {
      console.error('Cache exists error:', error)
      return false
    }
  },

  async ttl(key: string, namespace?: string): Promise<number> {
    try {
      const client = await getCacheClient()
      const fullKey = namespace ? `${namespace}:${key}` : key
      return await client.ttl(fullKey)
    } catch (error) {
      console.error('Cache TTL error:', error)
      return -1
    }
  },

  async incr(key: string, namespace?: string): Promise<number> {
    try {
      const client = await getCacheClient()
      const fullKey = namespace ? `${namespace}:${key}` : key
      return await client.incr(fullKey)
    } catch (error) {
      console.error('Cache incr error:', error)
      return 0
    }
  },

  async expire(key: string, ttl: number, namespace?: string): Promise<void> {
    try {
      const client = await getCacheClient()
      const fullKey = namespace ? `${namespace}:${key}` : key
      await client.expire(fullKey, ttl)
    } catch (error) {
      console.error('Cache expire error:', error)
    }
  },

  financial: {
    async cacheCurrentPrice(symbol: string, priceData: any): Promise<void> {
      return cache.set(
        `current_price_${symbol}`,
        priceData,
        { ttl: CACHE_DURATIONS.CURRENT_PRICES, namespace: 'prices' }
      )
    },

    async getCurrentPrice<T>(symbol: string): Promise<T | null> {
      return cache.get(`current_price_${symbol}`, { namespace: 'prices' })
    },

    async cacheHistoricalData(symbol: string, startDate: string, endDate: string, data: any): Promise<void> {
      const cacheKey = `historical_${symbol}_${startDate}_${endDate}`
      return cache.set(
        cacheKey,
        data,
        { 
          ttl: CACHE_DURATIONS.DAILY_HISTORICAL, 
          compress: true,
          namespace: 'historical'
        }
      )
    },

    async getHistoricalData<T>(symbol: string, startDate: string, endDate: string): Promise<T | null> {
      const cacheKey = `historical_${symbol}_${startDate}_${endDate}`
      return cache.get(cacheKey, { compress: true, namespace: 'historical' })
    },

    async cacheETFInfo(symbol: string, etfData: any): Promise<void> {
      return cache.set(
        `etf_info_${symbol}`,
        etfData,
        { ttl: CACHE_DURATIONS.COMPANY_INFO, namespace: 'etf' }
      )
    },

    async getETFInfo<T>(symbol: string): Promise<T | null> {
      return cache.get(`etf_info_${symbol}`, { namespace: 'etf' })
    },

    async cacheFundamentals(symbol: string, fundamentals: any): Promise<void> {
      return cache.set(
        `fundamentals_${symbol}`,
        fundamentals,
        { ttl: CACHE_DURATIONS.FUNDAMENTALS, namespace: 'fundamentals' }
      )
    },

    async getFundamentals<T>(symbol: string): Promise<T | null> {
      return cache.get(`fundamentals_${symbol}`, { namespace: 'fundamentals' })
    },

    async cacheSearchResults(query: string, results: any): Promise<void> {
      const cacheKey = `search_${query.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
      return cache.set(
        cacheKey,
        results,
        { ttl: CACHE_DURATIONS.SEARCH_RESULTS, namespace: 'search' }
      )
    },

    async getSearchResults<T>(query: string): Promise<T | null> {
      const cacheKey = `search_${query.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
      return cache.get(cacheKey, { namespace: 'search' })
    },

    async cachePerformanceMetrics(identifier: string, metrics: any): Promise<void> {
      return cache.set(
        `performance_${identifier}`,
        metrics,
        { ttl: CACHE_DURATIONS.PERFORMANCE_METRICS, namespace: 'performance' }
      )
    },

    async getPerformanceMetrics<T>(identifier: string): Promise<T | null> {
      return cache.get(`performance_${identifier}`, { namespace: 'performance' })
    },

    async invalidateSymbol(symbol: string): Promise<void> {
      const patterns = [
        `prices:*${symbol}*`,
        `historical:*${symbol}*`,
        `etf:*${symbol}*`,
        `fundamentals:*${symbol}*`,
        `performance:*${symbol}*`
      ]

      for (const pattern of patterns) {
        await cache.invalidatePattern(pattern)
      }
    },

    async invalidateStaleData(): Promise<void> {
      const now = new Date()
      const marketCloseHour = 16 // 4 PM ET

      if (now.getHours() >= marketCloseHour) {
        await cache.invalidatePattern('prices:current_price_*')
      }
    },

    async warmCache(symbols: string[]): Promise<void> {
      console.info(`Warming cache for ${symbols.length} symbols:`, symbols.join(', '))
    }
  }
}

export const marketDataCache = {
  async getCurrentPrice(symbol: string) {
    return cache.financial.getCurrentPrice(symbol)
  },
  
  async setCurrentPrice(symbol: string, data: any) {
    return cache.financial.cacheCurrentPrice(symbol, data)
  },
  
  async getHistoricalData(symbol: string, cacheKey: string) {
    return cache.get(cacheKey, { namespace: 'historical' })
  },
  
  async setHistoricalData(symbol: string, cacheKey: string, data: any) {
    return cache.set(cacheKey, data, { 
      ttl: CACHE_DURATIONS.DAILY_HISTORICAL, 
      namespace: 'historical' 
    })
  }
}

export const rateLimit = {
  async check(
    identifier: string, 
    limit: number, 
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const client = await getCacheClient()
      const key = `rate_limit:${identifier}`
      const current = await client.incr(key)
      
      if (current === 1) {
        await client.expire(key, Math.ceil(windowMs / 1000))
      }
      
      const ttl = await client.ttl(key)
      const resetTime = Date.now() + (ttl * 1000)
      
      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime
      }
    } catch (error) {
      console.error('Rate limit check error:', error)
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: Date.now() + windowMs
      }
    }
  },

  async checkFmpRate(): Promise<boolean> {
    const result = await this.check('fmp_api', 250, 60 * 1000)
    return result.allowed
  },

  async checkYahooRate(): Promise<boolean> {
    const result = await this.check('yahoo_api', 100, 60 * 1000)
    return result.allowed
  },

  async checkUserRate(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const result = await this.check(`user:${userId}`, 1000, 60 * 60 * 1000)
    return {
      allowed: result.allowed,
      remaining: result.remaining
    }
  }
}

export default cache
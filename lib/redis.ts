import Redis from 'ioredis'

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL
  }
  throw new Error('REDIS_URL is not defined')
}

export const redis = new Redis(getRedisUrl(), {
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
})

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

export const cache = {
  /**
   * Get value from cache with optional decompression
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const fullKey = options.namespace ? `${options.namespace}:${key}` : key
      const value = await redis.get(fullKey)
      if (!value) return null

      // Handle compressed data
      if (options.compress && value.startsWith('COMPRESSED:')) {
        // In a real implementation, you would decompress here
        // For now, we'll just strip the prefix
        const compressedData = value.substring(11)
        return JSON.parse(compressedData)
      }

      return JSON.parse(value)
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  },

  /**
   * Set value in cache with optional compression
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = options.namespace ? `${options.namespace}:${key}` : key
      const ttl = options.ttl || CACHE_DURATIONS.DAILY_HISTORICAL
      
      let serializedValue = JSON.stringify(value)
      
      // Handle compression for large objects
      if (options.compress && serializedValue.length > 1000) {
        // In a real implementation, you would compress here
        // For now, we'll just add a prefix
        serializedValue = `COMPRESSED:${serializedValue}`
      }

      await redis.setex(fullKey, ttl, serializedValue)
    } catch (error) {
      console.error('Cache set error:', error)
    }
  },

  /**
   * Delete specific key from cache
   */
  async del(key: string, namespace?: string): Promise<void> {
    try {
      const fullKey = namespace ? `${namespace}:${key}` : key
      await redis.del(fullKey)
    } catch (error) {
      console.error('Cache del error:', error)
    }
  },

  /**
   * Invalidate cache keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error('Cache invalidate pattern error:', error)
    }
  },

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[], namespace?: string): Promise<(T | null)[]> {
    try {
      const fullKeys = namespace ? keys.map(key => `${namespace}:${key}`) : keys
      const values = await redis.mget(...fullKeys)
      
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

  /**
   * Set multiple key-value pairs at once
   */
  async mset(keyValuePairs: Record<string, any>, options: CacheOptions = {}): Promise<void> {
    try {
      const pipeline = redis.pipeline()
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

  /**
   * Check if key exists in cache
   */
  async exists(key: string, namespace?: string): Promise<boolean> {
    try {
      const fullKey = namespace ? `${namespace}:${key}` : key
      const result = await redis.exists(fullKey)
      return result === 1
    } catch (error) {
      console.error('Cache exists error:', error)
      return false
    }
  },

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string, namespace?: string): Promise<number> {
    try {
      const fullKey = namespace ? `${namespace}:${key}` : key
      return await redis.ttl(fullKey)
    } catch (error) {
      console.error('Cache TTL error:', error)
      return -1
    }
  },

  /**
   * Increment a counter (useful for rate limiting)
   */
  async incr(key: string, namespace?: string): Promise<number> {
    try {
      const fullKey = namespace ? `${namespace}:${key}` : key
      return await redis.incr(fullKey)
    } catch (error) {
      console.error('Cache incr error:', error)
      return 0
    }
  },

  /**
   * Set expiration on existing key
   */
  async expire(key: string, ttl: number, namespace?: string): Promise<void> {
    try {
      const fullKey = namespace ? `${namespace}:${key}` : key
      await redis.expire(fullKey, ttl)
    } catch (error) {
      console.error('Cache expire error:', error)
    }
  },

  /**
   * Financial data specific cache methods
   */
  financial: {
    /**
     * Cache current price data
     */
    async cacheCurrentPrice(symbol: string, priceData: any): Promise<void> {
      return cache.set(
        `current_price_${symbol}`,
        priceData,
        { ttl: CACHE_DURATIONS.CURRENT_PRICES, namespace: 'prices' }
      )
    },

    /**
     * Get cached current price
     */
    async getCurrentPrice<T>(symbol: string): Promise<T | null> {
      return cache.get(`current_price_${symbol}`, { namespace: 'prices' })
    },

    /**
     * Cache historical data with compression for large datasets
     */
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

    /**
     * Get cached historical data
     */
    async getHistoricalData<T>(symbol: string, startDate: string, endDate: string): Promise<T | null> {
      const cacheKey = `historical_${symbol}_${startDate}_${endDate}`
      return cache.get(cacheKey, { compress: true, namespace: 'historical' })
    },

    /**
     * Cache ETF information
     */
    async cacheETFInfo(symbol: string, etfData: any): Promise<void> {
      return cache.set(
        `etf_info_${symbol}`,
        etfData,
        { ttl: CACHE_DURATIONS.COMPANY_INFO, namespace: 'etf' }
      )
    },

    /**
     * Get cached ETF information
     */
    async getETFInfo<T>(symbol: string): Promise<T | null> {
      return cache.get(`etf_info_${symbol}`, { namespace: 'etf' })
    },

    /**
     * Cache fundamentals data
     */
    async cacheFundamentals(symbol: string, fundamentals: any): Promise<void> {
      return cache.set(
        `fundamentals_${symbol}`,
        fundamentals,
        { ttl: CACHE_DURATIONS.FUNDAMENTALS, namespace: 'fundamentals' }
      )
    },

    /**
     * Get cached fundamentals
     */
    async getFundamentals<T>(symbol: string): Promise<T | null> {
      return cache.get(`fundamentals_${symbol}`, { namespace: 'fundamentals' })
    },

    /**
     * Cache search results
     */
    async cacheSearchResults(query: string, results: any): Promise<void> {
      const cacheKey = `search_${query.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
      return cache.set(
        cacheKey,
        results,
        { ttl: CACHE_DURATIONS.SEARCH_RESULTS, namespace: 'search' }
      )
    },

    /**
     * Get cached search results
     */
    async getSearchResults<T>(query: string): Promise<T | null> {
      const cacheKey = `search_${query.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
      return cache.get(cacheKey, { namespace: 'search' })
    },

    /**
     * Cache performance metrics
     */
    async cachePerformanceMetrics(identifier: string, metrics: any): Promise<void> {
      return cache.set(
        `performance_${identifier}`,
        metrics,
        { ttl: CACHE_DURATIONS.PERFORMANCE_METRICS, namespace: 'performance' }
      )
    },

    /**
     * Get cached performance metrics
     */
    async getPerformanceMetrics<T>(identifier: string): Promise<T | null> {
      return cache.get(`performance_${identifier}`, { namespace: 'performance' })
    },

    /**
     * Invalidate all cache for a specific symbol
     */
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

    /**
     * Invalidate stale market data (older than market close)
     */
    async invalidateStaleData(): Promise<void> {
      const now = new Date()
      const marketCloseHour = 16 // 4 PM ET

      // If it's after market close, invalidate current prices
      if (now.getHours() >= marketCloseHour) {
        await cache.invalidatePattern('prices:current_price_*')
      }
    },

    /**
     * Warm cache with commonly requested symbols
     */
    async warmCache(symbols: string[]): Promise<void> {
      // This would be implemented to pre-fetch and cache data for popular symbols
      console.info(`Warming cache for ${symbols.length} symbols:`, symbols.join(', '))
      // Implementation would call data service methods for each symbol
    }
  }
}

export default cache

// Rate limiting functionality for API calls
export const rateLimit = {
  /**
   * Check if request is within rate limits
   */
  async check(
    identifier: string, 
    limit: number, 
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const key = `rate_limit:${identifier}`
      const current = await redis.incr(key)
      
      if (current === 1) {
        // First request in window, set expiration
        await redis.expire(key, Math.ceil(windowMs / 1000))
      }
      
      const ttl = await redis.ttl(key)
      const resetTime = Date.now() + (ttl * 1000)
      
      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime
      }
    } catch (error) {
      console.error('Rate limit check error:', error)
      // Default to allowing request on error
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: Date.now() + windowMs
      }
    }
  },

  /**
   * FMP API rate limiting (250 requests per minute)
   */
  async checkFmpRate(): Promise<boolean> {
    const result = await this.check('fmp_api', 250, 60 * 1000) // 250 per minute
    return result.allowed
  },

  /**
   * Yahoo Finance rate limiting (more conservative: 100 requests per minute)
   */
  async checkYahooRate(): Promise<boolean> {
    const result = await this.check('yahoo_api', 100, 60 * 1000) // 100 per minute
    return result.allowed
  },

  /**
   * User request rate limiting
   */
  async checkUserRate(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const result = await this.check(`user:${userId}`, 1000, 60 * 60 * 1000) // 1000 per hour
    return {
      allowed: result.allowed,
      remaining: result.remaining
    }
  }
}
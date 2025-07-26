import Redis from 'ioredis'

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL
  }
  return null
}

// Create Redis instance with fallback to in-memory cache
let redis: Redis | null = null
let inMemoryCache: Record<string, { value: any; expires: number }> = {}

try {
  const redisUrl = getRedisUrl()
  if (redisUrl) {
    redis = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      commandTimeout: 5000,
    })
    
    redis.on('error', (error) => {
      console.warn('Redis connection error, falling back to in-memory cache:', error)
      redis = null
    })
  } else {
    console.warn('Redis URL not configured, using in-memory cache')
  }
} catch (error) {
  console.warn('Failed to create Redis instance, using in-memory cache:', error)
  redis = null
}

// Fallback cache implementation
const fallbackCache = {
  async get(key: string): Promise<string | null> {
    const item = inMemoryCache[key]
    if (!item) return null
    
    if (Date.now() > item.expires) {
      delete inMemoryCache[key]
      return null
    }
    
    return JSON.stringify(item.value)
  },
  
  async setex(key: string, ttl: number, value: string): Promise<void> {
    inMemoryCache[key] = {
      value: JSON.parse(value),
      expires: Date.now() + (ttl * 1000)
    }
  },
  
  async del(...keys: string[]): Promise<void> {
    keys.forEach(key => delete inMemoryCache[key])
  },
  
  async exists(key: string): Promise<number> {
    const item = inMemoryCache[key]
    if (!item || Date.now() > item.expires) return 0
    return 1
  },
  
  async ttl(key: string): Promise<number> {
    const item = inMemoryCache[key]
    if (!item) return -2
    const remaining = Math.floor((item.expires - Date.now()) / 1000)
    return remaining > 0 ? remaining : -1
  },
  
  async incr(key: string): Promise<number> {
    const item = inMemoryCache[key]
    const current = item && Date.now() <= item.expires ? (item.value || 0) : 0
    const newValue = current + 1
    inMemoryCache[key] = {
      value: newValue,
      expires: item?.expires || (Date.now() + 60000) // Default 1 minute if no expiry
    }
    return newValue
  },
  
  async expire(key: string, ttl: number): Promise<void> {
    const item = inMemoryCache[key]
    if (item) {
      item.expires = Date.now() + (ttl * 1000)
    }
  },
  
  async keys(pattern: string): Promise<string[]> {
    // Simple pattern matching for fallback
    const regex = new RegExp(pattern.replace('*', '.*'))
    return Object.keys(inMemoryCache).filter(key => regex.test(key))
  },
  
  async mget(...keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map(key => this.get(key)))
  },
  
  pipeline() {
    const operations: (() => Promise<any>)[] = []
    return {
      setex: (key: string, ttl: number, value: string) => {
        operations.push(() => fallbackCache.setex(key, ttl, value))
        return this
      },
      exec: async () => {
        return Promise.all(operations.map(op => op()))
      }
    }
  }
}

// Export unified interface
export { redis as redisInstance }
export const redisClient = redis || fallbackCache

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
      const value = await redisClient.get(fullKey)
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

      await redisClient.setex(fullKey, ttl, serializedValue)
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
      await redisClient.del(fullKey)
    } catch (error) {
      console.error('Cache del error:', error)
    }
  },

  /**
   * Invalidate cache keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern)
      if (keys.length > 0) {
        await redisClient.del(...keys)
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
      const values = await redisClient.mget(...fullKeys)
      
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
      const pipeline = redisClient.pipeline()
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
      const result = await redisClient.exists(fullKey)
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
      return await redisClient.ttl(fullKey)
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
      return await redisClient.incr(fullKey)
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
      await redisClient.expire(fullKey, ttl)
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

// Market data specific cache interface for backward compatibility
export const marketDataCache = {
  async getCurrentPrice(symbol: string) {
    return cache.financial.getCurrentPrice(symbol)
  },
  
  async setCurrentPrice(symbol: string, data: any) {
    return cache.financial.cacheCurrentPrice(symbol, data)
  },
  
  async getHistoricalData(symbol: string, cacheKey: string) {
    // Extract dates from cache key if needed, for now use a fallback
    return cache.get(cacheKey, { namespace: 'historical' })
  },
  
  async setHistoricalData(symbol: string, cacheKey: string, data: any) {
    return cache.set(cacheKey, data, { 
      ttl: CACHE_DURATIONS.DAILY_HISTORICAL, 
      namespace: 'historical' 
    })
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
      const current = await redisClient.incr(key)
      
      if (current === 1) {
        // First request in window, set expiration
        await redisClient.expire(key, Math.ceil(windowMs / 1000))
      }
      
      const ttl = await redisClient.ttl(key)
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
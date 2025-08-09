// Server-only Redis client
// This file should only be imported in server components and API routes

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
  if (redisUrl && typeof window === 'undefined') {
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
    console.warn('Redis URL not configured or running on client, using in-memory cache')
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

// Re-export cache functionality
export * from './redis-cache'
export { rateLimit } from './redis-cache'
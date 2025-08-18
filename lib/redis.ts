// This file is deprecated - use redis-server.ts for server-side Redis
// and redis-cache.ts for cache utilities

// Re-export everything from redis-cache for backward compatibility
export * from './redis-cache'

// For server-only components that need the Redis instance
export async function getRedisClient() {
  if (typeof window === 'undefined') {
    const { redisClient } = await import('./redis-server')
    return redisClient
  }
  // Return null on client side
  return null
}

// For backward compatibility
export { 
  cache as default,
  cache,
  marketDataCache,
  rateLimit,
  CACHE_DURATIONS,
  type CacheOptions
} from './redis-cache'
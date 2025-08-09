import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Server-only authentication middleware
export async function requireAuth(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.error('Auth error:', error)
    throw new Error('Unauthorized')
  }
  
  if (!user) {
    console.error('No user found in session')
    throw new Error('Unauthorized')
  }
  
  console.log('Authenticated user:', user.id, user.email)
  
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email?.split('@')[0]
  }
}

// Server-only rate limiting middleware
export async function applyRateLimit(
  request: NextRequest,
  identifier?: string,
  limit: number = 100,
  windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  try {
    // Import redis rate limit here - server-only
    const { rateLimit } = await import('@/lib/redis')
    
    // Use IP address as identifier if not provided
    const rateLimitId = identifier || request.ip || 'anonymous'
    
    return await rateLimit.check(rateLimitId, limit, windowMs)
  } catch (error) {
    console.error('Rate limit error:', error)
    // Default to allowing request on error
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: Date.now() + windowMs
    }
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createApiError } from '@/lib/utils';

// Server-only authentication middleware
export async function requireAuth(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session || !session.user) {
    console.error('No session found')
    throw new Error('Unauthorized')
  }
  
  const user = session.user
  
  if (!user.email || !user.id) {
    console.error('Invalid user data in session')
    throw new Error('Unauthorized')
  }
  
  console.log('Authenticated user:', user.id, user.email)
  
  // Ensure user exists in our database
  const dbUser = await ensureUserExists({
    id: user.id,
    email: user.email,
    name: user.name || user.email?.split('@')[0] || 'User'
  })
  
  return dbUser
}

// Helper function to ensure user exists in database
async function ensureUserExists(userData: { id: string; email: string; name: string }) {
  try {
    // Try to find existing user
    const existingUser = await prisma.user.findUnique({
      where: { id: userData.id }
    })
    
    if (existingUser) {
      return {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name || userData.name
      }
    }
    
    // Create user if doesn't exist
    console.log('Creating new user in database:', userData.email)
    const newUser = await prisma.user.create({
      data: {
        id: userData.id,
        email: userData.email,
        name: userData.name
      }
    })
    
    console.log('User created successfully:', newUser.email)
    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name
    }
  } catch (error) {
    console.error('Error ensuring user exists:', error)
    // Return user data even if database operation fails
    return userData
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

// API handler wrapper
export function withApiHandler(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  options: {
    requireAuth?: boolean
    rateLimit?: { limit: number; windowMs: number }
    allowedMethods?: string[]
  } = {}
) {
  return async (request: NextRequest, context?: any) => {
    try {
      // Method validation
      if (options.allowedMethods && !options.allowedMethods.includes(request.method)) {
        return createApiError('METHOD_NOT_ALLOWED', 'Method not allowed', null, 405)
      }

      // Rate limiting
      if (options.rateLimit) {
        const rateLimitResult = await applyRateLimit(
          request,
          undefined,
          options.rateLimit.limit,
          options.rateLimit.windowMs
        )
        
        // Add rate limit headers
        const headers = new Headers()
        headers.set('X-RateLimit-Limit', options.rateLimit.limit.toString())
        headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
        headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString())
      }

      // Authentication
      if (options.requireAuth) {
        await requireAuth(request)
      }

      return await handler(request, context)
    } catch (error) {
      console.error('API handler error:', error)
      
      if (error instanceof Error) {
        if (error.message === 'Unauthorized') {
          return createApiError('UNAUTHORIZED', 'Authentication required', null, 401)
        }
        if (error.message === 'Rate limit exceeded') {
          return createApiError('RATE_LIMIT_EXCEEDED', 'Too many requests', null, 429)
        }
        if (error.message.includes('Validation error')) {
          return createApiError('VALIDATION_ERROR', error.message, null, 400)
        }
      }
      
      return createApiError('INTERNAL_ERROR', 'Internal server error', null, 500)
    }
  }
}
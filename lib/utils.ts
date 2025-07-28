import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
// Note: redis import moved to server-only files to avoid client-side issues
import { z } from 'zod'
import bcrypt from 'bcryptjs'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

// API response utilities
export function createApiResponse(data?: any, meta?: any) {
  return {
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  }
}

export function createApiError(code: string, message: string, details?: any, status: number = 400) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  )
}

// Authentication middleware
export async function requireAuth(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  
  return session.user
}

// Rate limiting middleware
export async function applyRateLimit(
  request: NextRequest,
  identifier?: string,
  limit: number = 100,
  windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  try {
    // Import redis rate limit here to avoid client-side issues
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

// Validation middleware
export function validateRequestBody<T>(schema: z.ZodSchema<T>) {
  return async (request: NextRequest): Promise<T> => {
    try {
      const body = await request.json()
      return schema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      throw new Error('Invalid request body')
    }
  }
}

export function validateQueryParams<T>(schema: z.ZodSchema<T>) {
  return (request: NextRequest): T => {
    try {
      const { searchParams } = new URL(request.url)
      const params = Object.fromEntries(searchParams.entries())
      return schema.parse(params)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Query validation error: ${error.errors.map(e => e.message).join(', ')}`)
      }
      throw new Error('Invalid query parameters')
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

// Pagination utilities
export function createPaginationMeta(page: number, limit: number, total: number) {
  const pages = Math.ceil(total / limit)
  
  return {
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    },
  }
}

// Symbol validation
export function validateETFSymbol(symbol: string): string {
  return symbol.toUpperCase().trim()
}

// Mobile responsive hook is now in client-utils.ts to avoid server-side imports
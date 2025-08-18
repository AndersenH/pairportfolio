import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { NextRequest, NextResponse } from 'next/server'
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
    success: true,
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

// Note: Authentication middleware moved to server-utils.ts to avoid client-side imports

// Rate limiting middleware moved to server-utils.ts to avoid client-side Redis imports

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
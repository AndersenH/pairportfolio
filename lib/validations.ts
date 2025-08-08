import { z } from 'zod'

// Portfolio schemas
export const portfolioSchema = z.object({
  name: z.string().min(1, 'Portfolio name is required').max(255),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().default(false),
  benchmarkSymbol: z.string().max(20).optional().nullable(),
  initialCapital: z.number().min(1, 'Initial capital must be at least $1').max(1000000000).default(10000),
  holdings: z.array(
    z.object({
      symbol: z.string().min(1, 'Symbol is required').max(20),
      allocation: z.number().min(0.0001, 'Allocation must be at least 0.01%').max(1, 'Allocation cannot exceed 100%'),
    })
  ).min(1, 'At least one holding is required'),
})

export const portfolioUpdateSchema = portfolioSchema.partial().omit({ holdings: true }).extend({
  holdings: z.array(
    z.object({
      symbol: z.string().min(1, 'Symbol is required').max(20),
      allocation: z.number().min(0.0001, 'Allocation must be at least 0.01%').max(1, 'Allocation cannot exceed 100%'),
    })
  ).optional(),
})

export const holdingSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').max(20),
  allocation: z.number().min(0.0001, 'Allocation must be at least 0.01%').max(1, 'Allocation cannot exceed 100%'),
})

// Backtest schemas
export const backtestSchema = z.object({
  portfolioId: z.string().uuid('Invalid portfolio ID'),
  strategyId: z.string().uuid('Invalid strategy ID').optional(),
  name: z.string().min(1, 'Backtest name is required').max(255).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  initialCapital: z.number().min(1, 'Initial capital must be at least $1').max(1000000000).default(10000),
  benchmarkSymbol: z.string().max(20).optional().nullable(),
  rebalancingFrequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional(),
  parameters: z.record(z.any()).optional(),
}).refine((data) => new Date(data.startDate) < new Date(data.endDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
})

export const strategyParametersSchema = z.object({
  lookbackPeriod: z.number().min(1).max(252).optional(),
  topN: z.number().min(1).max(50).optional(),
  rebalanceFrequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional(),
  minimumVolume: z.number().min(0).optional(),
  excludeSymbols: z.array(z.string()).optional(),
})

// Market data schemas
export const marketDataQuerySchema = z.object({
  period: z.enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']).optional().default('1y'),
  interval: z.enum(['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo']).optional().default('1d'),
  includePrePost: z.boolean().optional().default(false),
})

export const bulkMarketDataSchema = z.object({
  symbols: z.array(z.string().min(1).max(20)).min(1, 'At least one symbol is required').max(50, 'Maximum 50 symbols allowed'),
  period: z.enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']).optional().default('1y'),
  interval: z.enum(['1d', '5d', '1wk', '1mo']).optional().default('1d'),
})

// User authentication schemas
export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    ),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
})

export const userLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// API response types
export const apiResponseSchema = z.object({
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  meta: z.object({
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      pages: z.number(),
    }).optional(),
    timestamp: z.string(),
  }).optional(),
})

// Type exports
export type PortfolioInput = z.infer<typeof portfolioSchema>
export type PortfolioUpdateInput = z.infer<typeof portfolioUpdateSchema>
export type HoldingInput = z.infer<typeof holdingSchema>
export type BacktestInput = z.infer<typeof backtestSchema>
export type StrategyParameters = z.infer<typeof strategyParametersSchema>
export type MarketDataQuery = z.infer<typeof marketDataQuerySchema>
export type BulkMarketDataQuery = z.infer<typeof bulkMarketDataSchema>
export type UserRegistration = z.infer<typeof userRegistrationSchema>
export type UserLogin = z.infer<typeof userLoginSchema>
export type PaginationQuery = z.infer<typeof paginationSchema>
export type ApiResponse = z.infer<typeof apiResponseSchema>
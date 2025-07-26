import { NextRequest, NextResponse } from 'next/server';
import { runPythonWithData } from '@/lib/python-runner';
import { z } from 'zod';

// Strategy-specific parameter schemas
const momentumParametersSchema = z.object({
  lookback_period: z.number().int().min(1).max(500).optional(),
  top_n: z.number().int().min(1).max(20).optional()
});

const meanReversionParametersSchema = z.object({
  ma_period: z.number().int().min(5).max(200).optional(),
  deviation_threshold: z.number().min(0.01).max(1.0).optional()
});

const relativeStrengthParametersSchema = z.object({
  lookback_period: z.number().int().min(1).max(500).optional(),
  top_n: z.number().int().min(1).max(20).optional(),
  benchmark_symbol: z.string().optional()
});

const riskParityParametersSchema = z.object({
  volatility_window: z.number().int().min(10).max(252).optional(),
  min_weight: z.number().min(0).max(1).optional(),
  max_weight: z.number().min(0).max(1).optional()
});

const tacticalAllocationParametersSchema = z.object({
  indicator: z.enum(['moving_average', 'volatility', 'momentum']).optional(),
  ma_period: z.number().int().min(20).max(500).optional(),
  risk_on_allocation: z.number().min(0).max(1).optional(),
  risk_off_allocation: z.number().min(0).max(1).optional()
});

const rotationParametersSchema = z.object({
  rotation_model: z.enum(['momentum_based', 'mean_reversion', 'relative_strength']).optional(),
  number_of_sectors: z.number().int().min(1).max(20).optional(),
  lookback_period: z.number().int().min(1).max(500).optional()
});

// Strategy configuration schema
const strategySchema = z.object({
  type: z.enum(['buy_hold', 'momentum', 'relative_strength', 'mean_reversion', 'risk_parity', 'tactical_allocation', 'rotation']),
  name: z.string().optional(),
  description: z.string().optional(),
  parameters: z.union([
    momentumParametersSchema,
    meanReversionParametersSchema,
    relativeStrengthParametersSchema,
    riskParityParametersSchema,
    tacticalAllocationParametersSchema,
    rotationParametersSchema,
    z.record(z.any()) // Fallback for any other parameters
  ]).optional()
});

// Portfolio holding schema
const holdingSchema = z.object({
  symbol: z.string().min(1).max(10).regex(/^[A-Z0-9.\-]+$/),
  allocation: z.number().min(0).max(1)
});

// Portfolio schema
const portfolioSchema = z.object({
  holdings: z.array(holdingSchema).min(1).max(50)
});

// Main backtest request schema
const pythonBacktestSchema = z.object({
  strategy: strategySchema,
  portfolio: portfolioSchema,
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  initial_capital: z.number().min(1000).max(10000000).optional(),
  rebalancing_frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually']).optional(),
  include_benchmark: z.boolean().optional()
}).refine((data) => {
  // Validate date range
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  return startDate < endDate;
}, {
  message: "start_date must be before end_date"
}).refine((data) => {
  // Validate allocations sum to ~1.0
  const totalAllocation = data.portfolio.holdings.reduce((sum, holding) => sum + holding.allocation, 0);
  return Math.abs(totalAllocation - 1.0) <= 0.01;
}, {
  message: "Portfolio holdings allocations must sum to 1.0"
});

// Legacy schema for backward compatibility
const legacyBacktestSchema = z.object({
  strategy: z.enum(['buy_hold', 'momentum', 'mean_reversion']),
  holdings: z.array(z.object({
    symbol: z.string(),
    allocation: z.number().min(0).max(1)
  })),
  start_date: z.string(),
  end_date: z.string(),
  parameters: z.record(z.any()).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Try new schema first, then fall back to legacy
    let validatedData;
    let isLegacyFormat = false;
    
    try {
      validatedData = pythonBacktestSchema.parse(body);
    } catch (newFormatError) {
      try {
        // Try legacy format
        const legacyData = legacyBacktestSchema.parse(body);
        
        // Convert legacy format to new format
        validatedData = {
          strategy: {
            type: legacyData.strategy,
            parameters: legacyData.parameters || {}
          },
          portfolio: {
            holdings: legacyData.holdings
          },
          start_date: legacyData.start_date,
          end_date: legacyData.end_date,
          initial_capital: 10000,
          rebalancing_frequency: 'monthly',
          include_benchmark: true
        };
        
        isLegacyFormat = true;
      } catch (legacyFormatError) {
        // Both formats failed, return new format error
        throw newFormatError;
      }
    }
    
    // Add request metadata
    const requestData = {
      ...validatedData,
      _metadata: {
        request_id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        legacy_format: isLegacyFormat,
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    };
    
    // Run Python backtest
    const result = await runPythonWithData(
      'python/backtest_runner.py',
      requestData
    );
    
    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error, 
          stderr: result.stderr,
          traceback: result.data?.traceback 
        },
        { status: 500 }
      );
    }
    
    // Add response metadata
    const responseData = {
      ...result.data,
      _metadata: {
        ...requestData._metadata,
        response_timestamp: new Date().toISOString(),
        processing_time_ms: Date.now() - new Date(requestData._metadata.timestamp).getTime()
      }
    };
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: error.errors,
          supported_strategies: ['buy_hold', 'momentum', 'relative_strength', 'mean_reversion', 'risk_parity', 'tactical_allocation', 'rotation'],
          example_request: {
            strategy: {
              type: 'momentum',
              parameters: {
                lookback_period: 60,
                top_n: 3
              }
            },
            portfolio: {
              holdings: [
                { symbol: 'AAPL', allocation: 0.5 },
                { symbol: 'GOOGL', allocation: 0.5 }
              ]
            },
            start_date: '2023-01-01',
            end_date: '2023-12-31',
            initial_capital: 10000,
            rebalancing_frequency: 'monthly'
          }
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve available strategies and their parameters
export async function GET() {
  try {
    const strategies = {
      buy_hold: {
        name: 'Buy and Hold',
        description: 'Static allocation strategy with no rebalancing',
        parameters: {}
      },
      momentum: {
        name: 'Momentum',
        description: 'Momentum-based strategy selecting top performing assets',
        parameters: {
          lookback_period: { type: 'integer', min: 1, max: 500, default: 60, description: 'Number of days to look back for momentum calculation' },
          top_n: { type: 'integer', min: 1, max: 20, default: 3, description: 'Number of top assets to select' }
        }
      },
      relative_strength: {
        name: 'Relative Strength',
        description: 'Relative strength strategy vs benchmark',
        parameters: {
          lookback_period: { type: 'integer', min: 1, max: 500, default: 126, description: 'Number of days for relative strength calculation' },
          top_n: { type: 'integer', min: 1, max: 20, default: 2, description: 'Number of top assets to select' },
          benchmark_symbol: { type: 'string', default: 'SPY', description: 'Benchmark symbol for comparison' }
        }
      },
      mean_reversion: {
        name: 'Mean Reversion',
        description: 'Mean reversion strategy using moving averages',
        parameters: {
          ma_period: { type: 'integer', min: 5, max: 200, default: 50, description: 'Moving average period' },
          deviation_threshold: { type: 'number', min: 0.01, max: 1.0, default: 0.1, description: 'Deviation threshold for mean reversion signal' }
        }
      },
      risk_parity: {
        name: 'Risk Parity',
        description: 'Risk parity strategy with inverse volatility weighting',
        parameters: {
          volatility_window: { type: 'integer', min: 10, max: 252, default: 60, description: 'Window for volatility calculation' },
          min_weight: { type: 'number', min: 0, max: 1, default: 0.05, description: 'Minimum weight per asset' },
          max_weight: { type: 'number', min: 0, max: 1, default: 0.5, description: 'Maximum weight per asset' }
        }
      },
      tactical_allocation: {
        name: 'Tactical Allocation',
        description: 'Tactical asset allocation based on market regime',
        parameters: {
          indicator: { type: 'enum', options: ['moving_average', 'volatility', 'momentum'], default: 'moving_average', description: 'Market regime indicator' },
          ma_period: { type: 'integer', min: 20, max: 500, default: 200, description: 'Moving average period for regime detection' },
          risk_on_allocation: { type: 'number', min: 0, max: 1, default: 0.8, description: 'Allocation during risk-on periods' },
          risk_off_allocation: { type: 'number', min: 0, max: 1, default: 0.2, description: 'Allocation during risk-off periods' }
        }
      },
      rotation: {
        name: 'Rotation',
        description: 'Sector rotation strategy',
        parameters: {
          rotation_model: { type: 'enum', options: ['momentum_based', 'mean_reversion', 'relative_strength'], default: 'momentum_based', description: 'Rotation model type' },
          number_of_sectors: { type: 'integer', min: 1, max: 20, default: 3, description: 'Number of sectors to rotate between' },
          lookback_period: { type: 'integer', min: 1, max: 500, default: 90, description: 'Lookback period for rotation signals' }
        }
      }
    };
    
    const rebalancing_frequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'annually'];
    
    return NextResponse.json({
      strategies,
      rebalancing_frequencies,
      constraints: {
        max_holdings: 50,
        min_initial_capital: 1000,
        max_initial_capital: 10000000,
        date_format: 'YYYY-MM-DD'
      },
      api_version: '2.0.0'
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve strategy information' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler, requireAuth } from '@/lib/server-utils';
import {
  getScaffoldingData,
  getAllPortfolioSymbols,
  getScaffoldingDataBySymbol,
} from '@/lib/scaffolding-service';

/**
 * GET /api/scaffolding/data
 * Get scaffolding data for specific field and/or symbols
 * Query params:
 * - fieldId: Filter by field ID (optional)
 * - symbols: Comma-separated list of symbols (optional)
 * - groupBy: Group results by 'symbol' or 'field' (default: 'field')
 * - userId: Filter to user's portfolio symbols only (optional, defaults to current user)
 */
export const GET = withApiHandler(
  async (request: NextRequest) => {
    const user = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const fieldId = searchParams.get('fieldId');
    const symbolsParam = searchParams.get('symbols');
    const groupBy = searchParams.get('groupBy') || 'field';
    const userId = searchParams.get('userId') || user.id;

    // Parse symbols
    let symbols: string[] | undefined;
    if (symbolsParam) {
      symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase());
    } else {
      // Get all symbols from user's portfolios
      symbols = await getAllPortfolioSymbols(userId);
    }

    // If no field ID specified, return error
    if (!fieldId && groupBy === 'field') {
      return NextResponse.json(
        {
          success: false,
          error: 'fieldId is required when groupBy is "field"',
        },
        { status: 400 }
      );
    }

    let data;
    let meta: any = {
      groupBy,
      timestamp: new Date().toISOString(),
    };

    if (groupBy === 'symbol') {
      // Group by symbol
      data = await getScaffoldingDataBySymbol(symbols);
      meta.symbolCount = Object.keys(data).length;
    } else {
      // Group by field (default)
      if (!fieldId) {
        return NextResponse.json(
          {
            success: false,
            error: 'fieldId is required',
          },
          { status: 400 }
        );
      }

      data = await getScaffoldingData(fieldId, symbols);
      meta.fieldId = fieldId;
      meta.resultCount = data.length;
    }

    return NextResponse.json({
      success: true,
      data,
      meta,
    });
  },
  {
    requireAuth: true,
    rateLimit: { limit: 100, windowMs: 60000 },
    allowedMethods: ['GET'],
  }
);

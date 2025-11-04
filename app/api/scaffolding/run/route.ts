import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler, requireAuth } from '@/lib/server-utils';
import { validateRequestBody } from '@/lib/utils';
import {
  getScaffoldingField,
  getAllPortfolioSymbols,
  createSearchQuery,
  storeScaffoldingData,
  parseNumericValue,
  extractValueFromSearchResults,
} from '@/lib/scaffolding-service';

const scaffoldingRunSchema = z.object({
  fieldId: z.string(),
  userId: z.string().optional(),
  symbols: z.array(z.string()).optional(),
});

const scaffoldingResultSchema = z.object({
  fieldId: z.string(),
  symbol: z.string(),
  searchResultText: z.string(),
  rawValue: z.string().optional(),
  source: z.string().optional(),
});

/**
 * POST /api/scaffolding/run
 * Trigger the scaffolding process for a specific field
 * Returns the list of symbols and queries that need to be searched
 */
export const POST = withApiHandler(
  async (request: NextRequest) => {
    const user = await requireAuth(request);
    const validatedData = await validateRequestBody(scaffoldingRunSchema)(request);

    // Get the scaffolding field
    const field = await getScaffoldingField(validatedData.fieldId);
    if (!field) {
      return NextResponse.json(
        {
          success: false,
          error: 'Field not found',
        },
        { status: 404 }
      );
    }

    if (!field.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Field is not active',
        },
        { status: 400 }
      );
    }

    // Get all portfolio symbols for the user (or all users if userId not specified)
    const symbols =
      validatedData.symbols ||
      (await getAllPortfolioSymbols(validatedData.userId || user.id));

    if (symbols.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No symbols found in portfolios',
          queries: [],
        },
        meta: {
          fieldName: field.name,
          symbolCount: 0,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Generate search queries for each symbol
    const queries = symbols.map((symbol) => ({
      symbol,
      query: createSearchQuery(symbol, field.name, field.description || undefined),
      fieldId: field.id,
      fieldName: field.name,
    }));

    return NextResponse.json({
      success: true,
      data: {
        message: `Generated ${queries.length} search queries`,
        queries,
        instructions:
          'Use web search to find values for each query and submit results to POST /api/scaffolding/run/result',
      },
      meta: {
        fieldName: field.name,
        symbolCount: symbols.length,
        timestamp: new Date().toISOString(),
      },
    });
  },
  {
    requireAuth: true,
    rateLimit: { limit: 20, windowMs: 60000 },
    allowedMethods: ['POST'],
  }
);

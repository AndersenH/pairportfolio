import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler, requireAuth } from '@/lib/server-utils';
import { validateRequestBody } from '@/lib/utils';
import {
  getScaffoldingField,
  getAllPortfolioSymbols,
  createSearchQuery,
  storeScaffoldingData,
  extractValueFromSearchResults,
  parseNumericValue,
} from '@/lib/scaffolding-service';

const scaffoldingAutoRunSchema = z.object({
  fieldId: z.string(),
  userId: z.string().optional(),
  symbols: z.array(z.string()).optional(),
  maxSymbols: z.number().optional().default(50),
});

interface SearchResult {
  symbol: string;
  value: string | null;
  numericValue: number | null;
  confidence: string;
  source: string;
  error?: string;
}

/**
 * Perform web search for a single query using AI
 * This is a placeholder that should be replaced with actual WebSearch implementation
 */
async function performWebSearch(query: string, symbol: string, fieldName: string): Promise<{
  searchResultText: string;
  rawValue: string | null;
}> {
  // NOTE: This is where we would integrate with WebSearch tool
  // For now, we'll simulate the response structure

  // In production, you would call the WebSearch API here
  // Example: const results = await webSearch(query);

  // Placeholder response - in real implementation, this would be actual web search results
  const mockResponse = `Searching for ${fieldName} of ${symbol}. This is a placeholder. In production, this would use the WebSearch tool to find actual data.`;

  return {
    searchResultText: mockResponse,
    rawValue: null,
  };
}

/**
 * POST /api/scaffolding/run/auto
 * Automatically run scaffolding with web search for all symbols
 * This endpoint performs the complete scaffolding process:
 * 1. Generate queries
 * 2. Perform web searches
 * 3. Extract values
 * 4. Store results
 */
export const POST = withApiHandler(
  async (request: NextRequest) => {
    const user = await requireAuth(request);
    const validatedData = await validateRequestBody(scaffoldingAutoRunSchema)(request);

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

    // Get all portfolio symbols for the user
    let symbols =
      validatedData.symbols ||
      (await getAllPortfolioSymbols(validatedData.userId || user.id));

    // Limit the number of symbols to process
    if (symbols.length > validatedData.maxSymbols) {
      symbols = symbols.slice(0, validatedData.maxSymbols);
    }

    if (symbols.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No symbols found in portfolios',
          results: [],
        },
        meta: {
          fieldName: field.name,
          symbolCount: 0,
          timestamp: new Date().toISOString(),
        },
      });
    }

    console.log(`Starting scaffolding for field "${field.name}" with ${symbols.length} symbols`);

    const results: SearchResult[] = [];
    const errors: Array<{ symbol: string; error: string }> = [];

    // Process each symbol
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      console.log(`[${i + 1}/${symbols.length}] Processing ${symbol}`);

      try {
        // Generate search query
        const query = createSearchQuery(symbol, field.name, field.description || undefined);

        // Perform web search
        const { searchResultText, rawValue } = await performWebSearch(query, symbol, field.name);

        let value: string | null = rawValue;
        let numericValue: number | null = null;
        let confidence = 'none';

        // If rawValue is provided, use it directly
        if (rawValue) {
          value = rawValue;
          numericValue = parseNumericValue(rawValue);
          confidence = 'high';
        } else if (searchResultText) {
          // Extract value from search results
          const extracted = extractValueFromSearchResults(searchResultText, field.name);
          value = extracted.value;
          numericValue = extracted.numericValue;
          confidence = extracted.confidence;
        }

        // Store the result in database
        await storeScaffoldingData(
          validatedData.fieldId,
          symbol,
          value,
          numericValue,
          'web_search_auto',
          confidence
        );

        results.push({
          symbol,
          value,
          numericValue,
          confidence,
          source: 'web_search_auto',
        });

        console.log(`  ✓ ${symbol}: ${value || 'null'} (confidence: ${confidence})`);
      } catch (error) {
        console.error(`  ✗ ${symbol}: Error - ${error}`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ symbol, error: errorMessage });

        // Store null value with error
        try {
          await storeScaffoldingData(
            validatedData.fieldId,
            symbol,
            null,
            null,
            'web_search_auto',
            'none'
          );
        } catch (storeError) {
          console.error(`  Failed to store error result for ${symbol}:`, storeError);
        }
      }

      // Add a small delay to avoid overwhelming the system
      if (i < symbols.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const successCount = results.filter(r => r.value !== null).length;
    const nullCount = results.filter(r => r.value === null).length;

    return NextResponse.json({
      success: true,
      data: {
        message: `Processed ${symbols.length} symbols: ${successCount} found, ${nullCount} not found`,
        results,
        errors: errors.length > 0 ? errors : undefined,
      },
      meta: {
        fieldName: field.name,
        totalSymbols: symbols.length,
        successCount,
        nullCount,
        errorCount: errors.length,
        timestamp: new Date().toISOString(),
      },
    });
  },
  {
    requireAuth: true,
    rateLimit: { limit: 5, windowMs: 60000 }, // Strict limit for automated searches
    allowedMethods: ['POST'],
  }
);

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler, requireAuth } from '@/lib/server-utils';
import { validateRequestBody } from '@/lib/utils';
import {
  storeScaffoldingData,
  extractValueFromSearchResults,
  parseNumericValue,
  getScaffoldingField,
} from '@/lib/scaffolding-service';

const scaffoldingResultSchema = z.object({
  fieldId: z.string(),
  results: z.array(
    z.object({
      symbol: z.string(),
      searchResultText: z.string(),
      rawValue: z.string().optional().nullable(),
      source: z.string().optional(),
    })
  ),
});

/**
 * POST /api/scaffolding/run/result
 * Submit web search results for processing and storage
 */
export const POST = withApiHandler(
  async (request: NextRequest) => {
    const user = await requireAuth(request);
    const validatedData = await validateRequestBody(scaffoldingResultSchema)(request);

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

    const processedResults = [];
    const errors = [];

    // Process each result
    for (const result of validatedData.results) {
      try {
        let value: string | null = result.rawValue || null;
        let numericValue: number | null = null;
        let confidence = 'none';

        // If rawValue is provided, use it directly
        if (result.rawValue) {
          value = result.rawValue;
          numericValue = parseNumericValue(result.rawValue);
          confidence = 'manual';
        } else if (result.searchResultText) {
          // Extract value from search results
          const extracted = extractValueFromSearchResults(
            result.searchResultText,
            field.name
          );
          value = extracted.value;
          numericValue = extracted.numericValue;
          confidence = extracted.confidence;
        }

        // Store the result
        const stored = await storeScaffoldingData(
          validatedData.fieldId,
          result.symbol,
          value,
          numericValue,
          result.source || 'web_search',
          confidence
        );

        processedResults.push({
          symbol: result.symbol,
          value,
          numericValue,
          confidence,
          stored: true,
        });
      } catch (error) {
        console.error(`Error processing result for ${result.symbol}:`, error);
        errors.push({
          symbol: result.symbol,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Processed ${processedResults.length} results`,
        processed: processedResults,
        errors: errors.length > 0 ? errors : undefined,
      },
      meta: {
        fieldName: field.name,
        totalResults: validatedData.results.length,
        successfulResults: processedResults.length,
        failedResults: errors.length,
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

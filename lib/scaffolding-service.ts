/**
 * Scaffolding Service
 *
 * This service uses AI web search to retrieve and store custom financial metrics
 * (like EPS, Revenue, P/E ratio) for ETF symbols in user portfolios.
 */

import { prisma } from './db';

export interface ScaffoldingFieldInput {
  name: string;
  description?: string;
  fieldType?: string;
  createdBy?: string;
}

export interface ScaffoldingResult {
  symbol: string;
  fieldName: string;
  value: string | null;
  numericValue: number | null;
  source?: string;
  confidence?: string;
  error?: string;
}

/**
 * Creates a new scaffolding field definition
 */
export async function createScaffoldingField(input: ScaffoldingFieldInput) {
  return await prisma.scaffoldingField.create({
    data: {
      name: input.name,
      description: input.description,
      fieldType: input.fieldType || 'numeric',
      createdBy: input.createdBy,
    },
  });
}

/**
 * Gets all scaffolding fields
 */
export async function getScaffoldingFields(activeOnly: boolean = true) {
  return await prisma.scaffoldingField.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    include: {
      _count: {
        select: { data: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Gets a specific scaffolding field by ID or name
 */
export async function getScaffoldingField(idOrName: string) {
  // Try finding by ID first
  let field = await prisma.scaffoldingField.findUnique({
    where: { id: idOrName },
    include: { data: true },
  });

  // If not found, try by name
  if (!field) {
    field = await prisma.scaffoldingField.findUnique({
      where: { name: idOrName },
      include: { data: true },
    });
  }

  return field;
}

/**
 * Gets all unique symbols from user portfolios
 */
export async function getAllPortfolioSymbols(userId?: string): Promise<string[]> {
  const holdings = await prisma.portfolioHolding.findMany({
    where: userId ? { portfolio: { userId } } : undefined,
    select: { symbol: true },
    distinct: ['symbol'],
  });

  return holdings.map(h => h.symbol);
}

/**
 * Gets scaffolding data for a specific field and symbols
 */
export async function getScaffoldingData(fieldId: string, symbols?: string[]) {
  return await prisma.scaffoldingData.findMany({
    where: {
      fieldId,
      ...(symbols ? { symbol: { in: symbols } } : {}),
    },
    include: {
      field: true,
    },
    orderBy: { retrievedAt: 'desc' },
  });
}

/**
 * Stores scaffolding data in the database
 */
export async function storeScaffoldingData(
  fieldId: string,
  symbol: string,
  value: string | null,
  numericValue: number | null,
  source?: string,
  confidence?: string
) {
  return await prisma.scaffoldingData.upsert({
    where: {
      fieldId_symbol: {
        fieldId,
        symbol,
      },
    },
    create: {
      fieldId,
      symbol,
      value,
      numericValue,
      source,
      confidence,
    },
    update: {
      value,
      numericValue,
      source,
      confidence,
      updatedAt: new Date(),
    },
  });
}

/**
 * Parses a numeric value from a string
 * Handles formats like: "$1.23", "1.23B", "1.23M", "1,234.56", "12.34%"
 */
export function parseNumericValue(valueStr: string | null): number | null {
  if (!valueStr || valueStr.toLowerCase() === 'n/a' || valueStr.toLowerCase() === 'null') {
    return null;
  }

  // Remove currency symbols, commas, and percentage signs
  let cleaned = valueStr.replace(/[$,£€¥%]/g, '').trim();

  // Handle suffixes like B (billion), M (million), K (thousand)
  const multipliers: { [key: string]: number } = {
    'T': 1e12,
    'B': 1e9,
    'M': 1e6,
    'K': 1e3,
  };

  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (cleaned.toUpperCase().endsWith(suffix)) {
      const numPart = cleaned.slice(0, -1).trim();
      const num = parseFloat(numPart);
      if (!isNaN(num)) {
        return num * multiplier;
      }
    }
  }

  // Try parsing as a regular number
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Fetches data for a single symbol using web search
 * This is a placeholder that would be called from an API route that has access to WebSearch
 */
export function createSearchQuery(symbol: string, fieldName: string, fieldDescription?: string): string {
  const description = fieldDescription || fieldName;
  return `What is the ${description} for ${symbol} ETF? Please provide the most recent value.`;
}

/**
 * Processes web search results to extract the field value
 * This function analyzes the search result text to find the requested metric
 */
export function extractValueFromSearchResults(
  searchResultText: string,
  fieldName: string
): { value: string | null; numericValue: number | null; confidence: string } {
  // Clean up the search result text
  const text = searchResultText.toLowerCase();

  // Look for patterns that indicate the value
  // Pattern 1: "fieldName is $X.XX" or "fieldName: $X.XX"
  const patterns = [
    new RegExp(`${fieldName.toLowerCase()}\\s*(?:is|:)\\s*([\\$£€¥]?[\\d,]+\\.?\\d*[BMK%]?)`, 'i'),
    new RegExp(`${fieldName.toLowerCase()}\\s*(?:of|at)\\s*([\\$£€¥]?[\\d,]+\\.?\\d*[BMK%]?)`, 'i'),
    // Pattern for ratios like "P/E ratio"
    new RegExp(`${fieldName.toLowerCase().replace(/\//g, '\\/')}\\s*(?:is|:)\\s*([\\d,]+\\.?\\d*[BMK%]?)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = searchResultText.match(pattern);
    if (match && match[1]) {
      const valueStr = match[1].trim();
      const numericValue = parseNumericValue(valueStr);
      return {
        value: valueStr,
        numericValue,
        confidence: 'high',
      };
    }
  }

  // If no pattern matched, try to find any number in the text
  const numberPattern = /([\\$£€¥]?[\\d,]+\\.?\\d*[BMK%]?)/g;
  const numbers = searchResultText.match(numberPattern);

  if (numbers && numbers.length > 0) {
    // Return the first number found with low confidence
    const valueStr = numbers[0].trim();
    const numericValue = parseNumericValue(valueStr);
    return {
      value: valueStr,
      numericValue,
      confidence: 'low',
    };
  }

  return {
    value: null,
    numericValue: null,
    confidence: 'none',
  };
}

/**
 * Deletes a scaffolding field and all its data
 */
export async function deleteScaffoldingField(fieldId: string) {
  return await prisma.scaffoldingField.delete({
    where: { id: fieldId },
  });
}

/**
 * Toggles the active status of a scaffolding field
 */
export async function toggleScaffoldingFieldStatus(fieldId: string) {
  const field = await prisma.scaffoldingField.findUnique({
    where: { id: fieldId },
  });

  if (!field) {
    throw new Error('Field not found');
  }

  return await prisma.scaffoldingField.update({
    where: { id: fieldId },
    data: { isActive: !field.isActive },
  });
}

/**
 * Gets scaffolding data grouped by symbol
 */
export async function getScaffoldingDataBySymbol(symbols: string[]) {
  const data = await prisma.scaffoldingData.findMany({
    where: {
      symbol: { in: symbols },
    },
    include: {
      field: true,
    },
  });

  // Group by symbol
  const grouped: { [symbol: string]: Array<any> } = {};
  for (const item of data) {
    if (!grouped[item.symbol]) {
      grouped[item.symbol] = [];
    }
    grouped[item.symbol].push(item);
  }

  return grouped;
}

#!/usr/bin/env node
/**
 * Automated Scaffolding CLI with WebSearch Integration
 *
 * This script should be run from Claude Code environment where WebSearch is available.
 * It fetches scaffolding queries from the API, performs web searches, and submits results.
 *
 * Usage:
 *   claude run scripts/auto-scaffolding-cli.ts <fieldId> [options]
 *
 * Options:
 *   --api-url <url>    API base URL (default: http://localhost:3000)
 *   --max-symbols <n>  Maximum symbols to process (default: 50)
 *   --help, -h         Show this help message
 */

import * as fs from 'fs';
import * as path from 'path';

interface Query {
  symbol: string;
  query: string;
  fieldId: string;
  fieldName: string;
}

interface SearchResult {
  symbol: string;
  searchResultText: string;
  rawValue?: string | null;
  source: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): {
  fieldId: string;
  apiUrl: string;
  maxSymbols: number;
  authToken?: string;
} {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Automated Scaffolding CLI with WebSearch

Usage:
  claude run scripts/auto-scaffolding-cli.ts <fieldId> [options]

Options:
  --api-url <url>       API base URL (default: http://localhost:3000)
  --max-symbols <n>     Maximum symbols to process (default: 50)
  --auth-token <token>  Authentication token for API
  --help, -h            Show this help message

Example:
  claude run scripts/auto-scaffolding-cli.ts field-abc123 --max-symbols 10
    `);
    process.exit(0);
  }

  const fieldId = args[0];
  const apiUrlIndex = args.indexOf('--api-url');
  const apiUrl =
    apiUrlIndex !== -1 ? args[apiUrlIndex + 1] : 'http://localhost:3000';

  const maxSymbolsIndex = args.indexOf('--max-symbols');
  const maxSymbols = maxSymbolsIndex !== -1 ? parseInt(args[maxSymbolsIndex + 1]) : 50;

  const authTokenIndex = args.indexOf('--auth-token');
  const authToken = authTokenIndex !== -1 ? args[authTokenIndex + 1] : undefined;

  if (!fieldId) {
    console.error('Error: Field ID is required');
    process.exit(1);
  }

  return { fieldId, apiUrl, maxSymbols, authToken };
}

/**
 * Fetch queries from the API
 */
async function fetchQueries(
  apiUrl: string,
  fieldId: string,
  maxSymbols: number,
  authToken?: string
): Promise<Query[]> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${apiUrl}/api/scaffolding/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fieldId,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch queries');
    }

    let queries = data.data.queries;

    // Limit queries
    if (queries.length > maxSymbols) {
      console.log(`Limiting to ${maxSymbols} symbols (out of ${queries.length})`);
      queries = queries.slice(0, maxSymbols);
    }

    return queries;
  } catch (error) {
    console.error(`Error fetching queries: ${error}`);
    throw error;
  }
}

/**
 * Perform web search using WebSearch tool (available in Claude Code environment)
 * NOTE: This function should be called from Claude Code where WebSearch tool is available
 */
async function performWebSearchWithClaude(
  query: string,
  symbol: string
): Promise<{
  searchResultText: string;
  rawValue: string | null;
}> {
  console.log(`  🔍 Searching for: ${symbol}`);

  // NOTE: This is a placeholder implementation
  // In the actual Claude Code environment, you would use the WebSearch tool
  // The Claude Code CLI should replace this with actual WebSearch calls

  // For now, return a placeholder
  // In production with Claude Code CLI, this would be:
  // const searchResults = await webSearch(query);
  // Then extract relevant information from searchResults

  return {
    searchResultText: `Search results for ${query} - This should be replaced with actual WebSearch results from Claude Code`,
    rawValue: null,
  };
}

/**
 * Submit results to the API
 */
async function submitResults(
  apiUrl: string,
  fieldId: string,
  results: SearchResult[],
  authToken?: string
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${apiUrl}/api/scaffolding/run/result`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fieldId,
        results,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to submit results');
    }

    console.log(`\n✅ Results submitted successfully`);
    console.log(`   Processed: ${data.meta.successfulResults} symbols`);
    console.log(`   Failed: ${data.meta.failedResults} symbols`);
  } catch (error) {
    console.error(`\n❌ Error submitting results: ${error}`);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const { fieldId, apiUrl, maxSymbols, authToken } = parseArgs();

  console.log(`\n🤖 Automated Scaffolding with WebSearch\n`);
  console.log(`Field ID: ${fieldId}`);
  console.log(`API URL: ${apiUrl}`);
  console.log(`Max Symbols: ${maxSymbols}\n`);

  // Step 1: Fetch queries from API
  console.log('📥 Fetching queries from API...\n');
  const queries = await fetchQueries(apiUrl, fieldId, maxSymbols, authToken);

  if (queries.length === 0) {
    console.log('No queries to process');
    return;
  }

  const fieldName = queries[0].fieldName;
  console.log(`Field: ${fieldName}`);
  console.log(`Processing ${queries.length} symbols...\n`);

  // Step 2: Process each query with web search
  const results: SearchResult[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`[${i + 1}/${queries.length}] ${query.symbol}`);

    try {
      // Perform web search
      const { searchResultText, rawValue } = await performWebSearchWithClaude(
        query.query,
        query.symbol
      );

      results.push({
        symbol: query.symbol,
        searchResultText,
        rawValue,
        source: 'web_search_cli',
      });

      console.log(`  ✅ Search completed\n`);
    } catch (error) {
      console.error(`  ❌ Search failed: ${error}\n`);
      results.push({
        symbol: query.symbol,
        searchResultText: '',
        rawValue: null,
        source: 'error',
      });
    }

    // Add a small delay to avoid rate limiting
    if (i < queries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\nCompleted ${results.length}/${queries.length} searches\n`);

  // Step 3: Submit results to API
  console.log(`📤 Submitting results to API...`);
  await submitResults(apiUrl, fieldId, results, authToken);

  console.log(`\n✨ Done!\n`);
}

// Run main function
main().catch((error) => {
  console.error(`\nFatal error: ${error}`);
  process.exit(1);
});

/**
 * INSTRUCTIONS FOR CLAUDE CODE USERS:
 *
 * To make this script work with actual WebSearch:
 *
 * 1. Replace the `performWebSearchWithClaude` function with actual WebSearch calls
 * 2. Use Claude Code's WebSearch tool to perform searches
 * 3. Extract relevant information from search results
 * 4. Parse numeric values when possible
 *
 * Example usage in Claude Code:
 *
 * ```typescript
 * async function performWebSearchWithClaude(query: string, symbol: string) {
 *   // Use WebSearch tool
 *   const searchResults = await webSearch({
 *     query: query,
 *   });
 *
 *   // Process search results
 *   const searchResultText = searchResults.map(r => r.content).join('\n');
 *
 *   // Try to extract the value
 *   // You can use regex or pattern matching here
 *   const rawValue = extractValueFromText(searchResultText);
 *
 *   return {
 *     searchResultText,
 *     rawValue,
 *   };
 * }
 * ```
 */

#!/usr/bin/env node
/**
 * Scaffolding Web Search Runner
 *
 * This script processes scaffolding queries by performing web searches
 * and submitting the results back to the API.
 *
 * Usage:
 *   npx tsx scripts/run-scaffolding.ts <queries-file.json>
 *
 * The queries file should be downloaded from the scaffolding UI after
 * clicking "Run Scaffolding" on a field.
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
  source?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { queriesFile: string; apiUrl: string } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Scaffolding Web Search Runner

Usage:
  npx tsx scripts/run-scaffolding.ts <queries-file.json> [options]

Options:
  --api-url <url>    API base URL (default: http://localhost:3000)
  --help, -h         Show this help message

Example:
  npx tsx scripts/run-scaffolding.ts scaffolding-queries-abc123.json
    `);
    process.exit(0);
  }

  const queriesFile = args[0];
  const apiUrlIndex = args.indexOf('--api-url');
  const apiUrl =
    apiUrlIndex !== -1 ? args[apiUrlIndex + 1] : 'http://localhost:3000';

  if (!fs.existsSync(queriesFile)) {
    console.error(`Error: Queries file not found: ${queriesFile}`);
    process.exit(1);
  }

  return { queriesFile, apiUrl };
}

/**
 * Load queries from JSON file
 */
function loadQueries(filePath: string): Query[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const queries = JSON.parse(content);
    return queries;
  } catch (error) {
    console.error(`Error loading queries file: ${error}`);
    process.exit(1);
  }
}

/**
 * Simulate web search (to be replaced with actual web search API)
 * In a real implementation, this would call a web search API or use Claude AI
 */
async function performWebSearch(query: string): Promise<string> {
  console.log(`  🔍 Searching: "${query}"`);

  // NOTE: This is a placeholder. In production, you would:
  // 1. Use Claude AI with WebSearch capability
  // 2. Call a web search API (Google, Bing, etc.)
  // 3. Scrape financial data websites
  //
  // For now, we'll return a placeholder response
  return `Searching for: ${query}. This is a placeholder result. In production, this would contain actual search results from web search.`;
}

/**
 * Submit results to the API
 */
async function submitResults(
  apiUrl: string,
  fieldId: string,
  results: SearchResult[]
): Promise<void> {
  try {
    const response = await fetch(`${apiUrl}/api/scaffolding/run/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
  const { queriesFile, apiUrl } = parseArgs();

  console.log(`\n📊 Scaffolding Web Search Runner\n`);
  console.log(`Queries file: ${queriesFile}`);
  console.log(`API URL: ${apiUrl}\n`);

  // Load queries
  const queries = loadQueries(queriesFile);
  console.log(`Loaded ${queries.length} queries\n`);

  if (queries.length === 0) {
    console.log('No queries to process');
    return;
  }

  const fieldId = queries[0].fieldId;
  const fieldName = queries[0].fieldName;

  console.log(`Field: ${fieldName} (${fieldId})\n`);
  console.log(`Processing ${queries.length} symbols...\n`);

  // Process each query
  const results: SearchResult[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`[${i + 1}/${queries.length}] ${query.symbol}`);

    try {
      // Perform web search
      const searchResultText = await performWebSearch(query.query);

      results.push({
        symbol: query.symbol,
        searchResultText,
        source: 'web_search',
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

  // Submit results to API
  console.log(`Submitting results to API...`);
  await submitResults(apiUrl, fieldId, results);

  console.log(`\n✨ Done!\n`);
}

// Run main function
main().catch((error) => {
  console.error(`\nFatal error: ${error}`);
  process.exit(1);
});

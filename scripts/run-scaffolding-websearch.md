# Scaffolding with Claude Code WebSearch

This guide explains how to run scaffolding using Claude Code's WebSearch capability.

## Prerequisites

1. Download the queries JSON file from the scaffolding UI
2. Have Claude Code CLI available with WebSearch capability

## Process

### Step 1: Load the Queries

```bash
cat scaffolding-queries-<field-id>.json
```

### Step 2: For Each Symbol, Perform Web Search

Use Claude Code's WebSearch tool to search for each query. Example:

```
For symbol SPY:
Query: "What is the EPS for SPY ETF? Please provide the most recent value."

WebSearch this query and extract the EPS value.
```

### Step 3: Collect Results

Build a results JSON file with this structure:

```json
{
  "fieldId": "field-id-from-queries",
  "results": [
    {
      "symbol": "SPY",
      "searchResultText": "Full text from web search results...",
      "rawValue": "4.52",
      "source": "web_search"
    },
    {
      "symbol": "QQQ",
      "searchResultText": "Full text from web search results...",
      "rawValue": null,
      "source": "web_search"
    }
  ]
}
```

### Step 4: Submit Results

```bash
curl -X POST http://localhost:3000/api/scaffolding/run/result \
  -H "Content-Type: application/json" \
  -d @results.json
```

## Automated Processing with Claude Code

You can ask Claude Code to:

1. Read the queries file
2. For each query, use WebSearch to find the metric value
3. Extract the value from search results
4. Build the results JSON
5. Submit to the API

Example prompt:

```
Read the file scaffolding-queries-abc123.json. For each query in the file, use WebSearch to find the answer. Extract the numeric value from the search results and build a results JSON file following the format in scripts/run-scaffolding-websearch.md. Then submit the results to POST /api/scaffolding/run/result.
```

## Field Extraction Tips

- Look for patterns like "EPS: $X.XX" or "EPS is $X.XX"
- Handle different formats: "$1.23", "1.23B", "1.23M", "1,234.56"
- If no value found, set rawValue to null
- Include the full search result text for automatic parsing by the API

## Example Result Formats

### Numeric (EPS, Revenue)
```json
{
  "symbol": "AAPL",
  "searchResultText": "Apple Inc. reported earnings per share (EPS) of $6.13 for Q4 2024...",
  "rawValue": "6.13",
  "source": "web_search"
}
```

### Percentage (P/E Ratio)
```json
{
  "symbol": "MSFT",
  "searchResultText": "Microsoft's P/E ratio stands at 35.2 as of November 2024...",
  "rawValue": "35.2",
  "source": "web_search"
}
```

### Large Numbers (Revenue)
```json
{
  "symbol": "GOOGL",
  "searchResultText": "Alphabet reported revenue of $76.7 billion in Q3 2024...",
  "rawValue": "76.7B",
  "source": "web_search"
}
```

### Not Found
```json
{
  "symbol": "OBSCURE",
  "searchResultText": "No recent financial data available for this symbol...",
  "rawValue": null,
  "source": "web_search"
}
```

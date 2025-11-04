# Scaffolding Feature

## Overview

The Scaffolding feature allows users to retrieve and store custom financial metrics (like EPS, Revenue, P/E Ratio) for all instruments in their portfolios using AI-powered web search.

## How It Works

1. **Define Field**: User specifies which financial metric they want to retrieve
2. **Generate Queries**: System generates search queries for each instrument in user portfolios
3. **Web Search**: AI performs web search to find the metric values
4. **Parse & Store**: Values are extracted from search results and stored in the database
5. **Analysis**: Stored data can be used for portfolio analysis and reporting

## Database Schema

### ScaffoldingField
- `id`: Unique identifier
- `name`: Field name (e.g., "EPS", "Revenue", "P/E Ratio")
- `description`: Optional description for better search accuracy
- `fieldType`: Type of field (numeric, text, percentage, currency)
- `isActive`: Whether the field is active
- `createdBy`: User who created the field
- `createdAt`, `updatedAt`: Timestamps

### ScaffoldingData
- `id`: Unique identifier
- `fieldId`: Reference to ScaffoldingField
- `symbol`: ETF/Stock symbol
- `value`: Raw text value
- `numericValue`: Parsed numeric value
- `source`: Data source (e.g., "web_search")
- `confidence`: Confidence level (high, medium, low, none)
- `retrievedAt`, `updatedAt`: Timestamps

## API Endpoints

### POST /api/scaffolding/fields
Create a new scaffolding field definition.

**Request Body:**
```json
{
  "name": "EPS",
  "description": "Earnings per share for the most recent quarter",
  "fieldType": "numeric"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "field-id",
    "name": "EPS",
    "description": "Earnings per share for the most recent quarter",
    "fieldType": "numeric",
    "isActive": true,
    "createdAt": "2024-11-04T12:00:00Z"
  }
}
```

### GET /api/scaffolding/fields
Get all scaffolding field definitions.

**Query Parameters:**
- `activeOnly` (boolean, default: true): Filter to active fields only

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "field-id",
      "name": "EPS",
      "description": "Earnings per share",
      "fieldType": "numeric",
      "isActive": true,
      "_count": {
        "data": 15
      }
    }
  ],
  "meta": {
    "count": 1,
    "timestamp": "2024-11-04T12:00:00Z"
  }
}
```

### POST /api/scaffolding/run
Generate search queries for a scaffolding field.

**Request Body:**
```json
{
  "fieldId": "field-id",
  "userId": "user-id",
  "symbols": ["SPY", "QQQ"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Generated 2 search queries",
    "queries": [
      {
        "symbol": "SPY",
        "query": "What is the EPS for SPY ETF? Please provide the most recent value.",
        "fieldId": "field-id",
        "fieldName": "EPS"
      }
    ],
    "instructions": "Use web search to find values..."
  }
}
```

### POST /api/scaffolding/run/result
Submit web search results for processing and storage.

**Request Body:**
```json
{
  "fieldId": "field-id",
  "results": [
    {
      "symbol": "SPY",
      "searchResultText": "The SPDR S&P 500 ETF (SPY) has an EPS of $15.23...",
      "rawValue": "15.23",
      "source": "web_search"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Processed 1 results",
    "processed": [
      {
        "symbol": "SPY",
        "value": "15.23",
        "numericValue": 15.23,
        "confidence": "manual",
        "stored": true
      }
    ]
  }
}
```

### GET /api/scaffolding/data
Get scaffolding data for instruments.

**Query Parameters:**
- `fieldId` (required): Field ID to retrieve data for
- `symbols` (optional): Comma-separated list of symbols
- `groupBy` (optional): Group results by 'symbol' or 'field'
- `userId` (optional): Filter to user's portfolio symbols

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "data-id",
      "fieldId": "field-id",
      "symbol": "SPY",
      "value": "15.23",
      "numericValue": 15.23,
      "source": "web_search",
      "confidence": "high",
      "retrievedAt": "2024-11-04T12:00:00Z",
      "field": {
        "name": "EPS",
        "fieldType": "numeric"
      }
    }
  ]
}
```

## Usage via UI

1. Navigate to `/scaffolding` in the web app
2. Create a new scaffolding field by entering:
   - Field name (e.g., "EPS")
   - Optional description for better search accuracy
   - Field type (numeric, text, percentage, currency)
3. Click "Create Field"
4. Click "Run Scaffolding" on the field
5. Download the generated queries JSON file
6. Process queries using the CLI script (see below)
7. View stored data in your portfolio analysis

## Usage via CLI

### Method 1: Automated Script

```bash
# Download queries from UI
# Then run:
npx tsx scripts/run-scaffolding.ts scaffolding-queries-<field-id>.json
```

### Method 2: With Claude Code WebSearch

See `scripts/run-scaffolding-websearch.md` for detailed instructions.

Example workflow:
```
1. Read the queries file
2. For each query, use WebSearch to find the answer
3. Extract the value from search results
4. Build a results JSON file
5. Submit to POST /api/scaffolding/run/result
```

### Method 3: Manual API Calls

```bash
# Step 1: Generate queries
curl -X POST http://localhost:3000/api/scaffolding/run \
  -H "Content-Type: application/json" \
  -d '{"fieldId": "your-field-id"}' > queries.json

# Step 2: Manually search and build results.json

# Step 3: Submit results
curl -X POST http://localhost:3000/api/scaffolding/run/result \
  -H "Content-Type: application/json" \
  -d @results.json
```

## Value Parsing

The system automatically parses various numeric formats:

- **Currency**: `$1.23`, `£1.23`, `€1.23`
- **Large numbers**: `1.23B` (billion), `1.23M` (million), `1.23K` (thousand)
- **Percentages**: `12.3%`
- **Formatted**: `1,234.56`

If a value cannot be found or parsed, it's stored as `null`.

## Confidence Levels

- **high**: Value found with clear pattern match
- **medium**: Value found but pattern match uncertain
- **low**: Number found in text but context unclear
- **manual**: User provided the raw value explicitly
- **none**: No value could be extracted

## Integration with Portfolios

The scaffolding feature automatically retrieves data for all instruments across:
- User's personal portfolios
- Lazy portfolio templates
- Any ETF/stock symbols in the system

This data can then be used for:
- Enhanced portfolio analysis
- Custom screening and filtering
- Performance attribution
- Risk assessment

## Future Enhancements

- Scheduled automatic updates
- Historical value tracking
- Data quality monitoring
- Integration with financial APIs as fallback
- Bulk field processing
- Custom field formulas (e.g., calculated metrics)

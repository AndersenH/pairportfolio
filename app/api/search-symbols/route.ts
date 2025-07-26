import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Schema for search request
const searchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(20),
  limit: z.number().min(1).max(50).optional().default(15),
})

interface SearchResult {
  symbol: string
  name: string
  exchangeShortName: string
  type?: string
  currency?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const limitParam = searchParams.get('limit')
    
    if (!query || query.length < 1) {
      return NextResponse.json({ 
        success: false, 
        error: 'Query parameter is required and must be at least 1 character' 
      }, { status: 400 })
    }

    // Validate parameters
    const validatedParams = searchSchema.parse({
      query,
      limit: limitParam ? parseInt(limitParam) : 15,
    })

    const fmpApiKey = process.env.FMP_API_KEY || 'Ejh2emZcJzogsHafpis8ogaXO7nPZDPI'
    const searchUrl = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(validatedParams.query)}&limit=${validatedParams.limit}&apikey=${fmpApiKey}`

    console.log('Searching symbols with query:', validatedParams.query)

    const response = await fetch(searchUrl, {
      next: { revalidate: 3600 } // Cache for 1 hour
    })

    if (!response.ok) {
      console.error('FMP API error:', response.status, response.statusText)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch search results' 
      }, { status: 500 })
    }

    const data = await response.json()
    
    if (!Array.isArray(data)) {
      console.error('Unexpected FMP response format:', data)
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid response format from data provider' 
      }, { status: 500 })
    }

    // Filter and format results
    const filteredResults: SearchResult[] = data
      .filter((item: any) => {
        // Filter out currencies, commodities, and other non-equity types
        const excludeTypes = ['currency', 'crypto', 'commodity', 'forex']
        const hasValidSymbol = item.symbol && typeof item.symbol === 'string' && item.symbol.length <= 10
        const hasValidName = item.name && typeof item.name === 'string'
        const hasValidExchange = item.exchangeShortName && typeof item.exchangeShortName === 'string'
        const isNotExcludedType = !item.type || !excludeTypes.includes(item.type.toLowerCase())
        
        return hasValidSymbol && hasValidName && hasValidExchange && isNotExcludedType
      })
      .map((item: any) => ({
        symbol: item.symbol.toUpperCase(),
        name: item.name,
        exchangeShortName: item.exchangeShortName,
        type: item.type || 'stock',
        currency: item.currency || 'USD'
      }))
      .slice(0, validatedParams.limit) // Ensure we don't exceed the limit

    console.log(`Found ${filteredResults.length} filtered results for query: ${validatedParams.query}`)

    return NextResponse.json({
      success: true,
      data: filteredResults,
      query: validatedParams.query,
      count: filteredResults.length
    })

  } catch (error) {
    console.error('Search symbols error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request parameters',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
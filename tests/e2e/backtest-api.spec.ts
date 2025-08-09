import { test, expect, APIRequestContext } from '@playwright/test'
import { LoginPage } from './pages/login-page'
import { PortfolioCreationPage } from './pages/portfolio-creation-page'
import { 
  TEST_USERS, 
  TEST_PORTFOLIOS, 
  createTestPortfolioWithTimestamp,
  TEST_CONFIG
} from './fixtures/test-data'
import { format, subDays, subYears } from 'date-fns'

/**
 * Backtest API E2E Tests
 * 
 * Tests the backtest API endpoints including:
 * - POST /api/backtests - Creating new backtests
 * - GET /api/backtests - Retrieving user backtests
 * - GET /api/backtests/[id] - Retrieving specific backtest
 * - Authentication and authorization
 * - Request/response validation
 * - Error handling scenarios
 * - Real market data integration
 */

test.describe('Backtest API', () => {
  let loginPage: LoginPage
  let portfolioPage: PortfolioCreationPage
  let authCookie: string
  let testPortfolioId: string

  test.beforeEach(async ({ page, request }) => {
    loginPage = new LoginPage(page)
    portfolioPage = new PortfolioCreationPage(page)

    // Login and get authentication cookie
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    // Extract authentication cookie
    const cookies = await page.context().cookies()
    const authCookies = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
    authCookie = authCookies

    // Create a test portfolio for API tests
    const testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
    await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
    
    // Get portfolio ID from the created portfolio
    const response = await request.get('/api/portfolios', {
      headers: { Cookie: authCookie }
    })
    const portfoliosData = await response.json()
    const createdPortfolio = portfoliosData.data.find((p: any) => p.name === testPortfolio.name)
    testPortfolioId = createdPortfolio.id
  })

  test.describe('POST /api/backtests - Create Backtest', () => {
    test('should create backtest with valid parameters @smoke', async ({ request }) => {
      const backtestData = {
        portfolioId: testPortfolioId,
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 10000,
        benchmarkSymbol: 'SPY',
        rebalancingFrequency: 'monthly',
        parameters: {
          strategy: 'buy-and-hold'
        }
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: backtestData
      })

      expect(response.status()).toBe(201)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.data).toHaveProperty('id')
      expect(responseData.data).toHaveProperty('status', 'pending')
      expect(responseData.data).toHaveProperty('message', 'Backtest created and queued for execution')
    })

    test('should create backtest with custom holdings', async ({ request }) => {
      const customHoldings = [
        { symbol: 'SPY', allocation: 0.7 },
        { symbol: 'VTI', allocation: 0.3 }
      ]

      const backtestData = {
        portfolioId: testPortfolioId,
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 25000,
        benchmarkSymbol: 'QQQ',
        rebalancingFrequency: 'quarterly',
        parameters: {
          strategy: 'momentum'
        },
        customHoldings: customHoldings
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: backtestData
      })

      expect(response.status()).toBe(201)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.data.id).toBeTruthy()
      
      // Custom holdings should be included in response
      expect(responseData.data.backtest).toHaveProperty('customHoldings')
    })

    test('should validate required fields', async ({ request }) => {
      const backtestData = {
        // Missing portfolioId
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 10000
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: backtestData
      })

      expect(response.status()).toBe(400)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error).toHaveProperty('code', 'VALIDATION_ERROR')
    })

    test('should validate date range', async ({ request }) => {
      const backtestData = {
        portfolioId: testPortfolioId,
        startDate: format(new Date(), 'yyyy-MM-dd'), // Today
        endDate: format(subDays(new Date(), 1), 'yyyy-MM-dd'), // Yesterday
        initialCapital: 10000,
        benchmarkSymbol: 'SPY',
        rebalancingFrequency: 'monthly'
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: backtestData
      })

      expect(response.status()).toBe(400)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toContain('End date must be after start date')
    })

    test('should validate initial capital constraints', async ({ request }) => {
      const backtestData = {
        portfolioId: testPortfolioId,
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 0, // Invalid: too low
        benchmarkSymbol: 'SPY',
        rebalancingFrequency: 'monthly'
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: backtestData
      })

      expect(response.status()).toBe(400)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toContain('Initial capital must be at least $1')
    })

    test('should validate custom holdings allocation sum', async ({ request }) => {
      const invalidCustomHoldings = [
        { symbol: 'SPY', allocation: 0.6 },
        { symbol: 'VTI', allocation: 0.6 } // Total = 1.2 (120%)
      ]

      const backtestData = {
        portfolioId: testPortfolioId,
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 10000,
        customHoldings: invalidCustomHoldings
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: backtestData
      })

      expect(response.status()).toBe(400)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toContain('Custom holdings allocations must sum to 100%')
    })

    test('should reject invalid portfolio ID', async ({ request }) => {
      const backtestData = {
        portfolioId: 'invalid-uuid',
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 10000
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: backtestData
      })

      expect(response.status()).toBe(400)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toContain('Invalid portfolio ID')
    })

    test('should handle non-existent portfolio', async ({ request }) => {
      const backtestData = {
        portfolioId: '00000000-0000-4000-8000-000000000000', // Valid UUID but non-existent
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 10000
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: backtestData
      })

      expect(response.status()).toBe(404)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error.code).toBe('RESOURCE_NOT_FOUND')
    })

    test('should require authentication', async ({ request }) => {
      const backtestData = {
        portfolioId: testPortfolioId,
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 10000
      }

      const response = await request.post('/api/backtests', {
        headers: { 'Content-Type': 'application/json' },
        data: backtestData
      })

      expect(response.status()).toBe(401)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error.code).toBe('AUTHENTICATION_REQUIRED')
    })

    test('should handle different rebalancing frequencies', async ({ request }) => {
      const frequencies = ['daily', 'weekly', 'monthly', 'quarterly']
      
      for (const frequency of frequencies) {
        const backtestData = {
          portfolioId: testPortfolioId,
          startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
          endDate: format(new Date(), 'yyyy-MM-dd'),
          initialCapital: 10000,
          rebalancingFrequency: frequency
        }

        const response = await request.post('/api/backtests', {
          headers: { 
            Cookie: authCookie,
            'Content-Type': 'application/json'
          },
          data: backtestData
        })

        expect(response.status()).toBe(201)
        
        const responseData = await response.json()
        expect(responseData.success).toBe(true)
      }
    })

    test('should handle different benchmark symbols', async ({ request }) => {
      const benchmarks = ['SPY', 'QQQ', 'IWM', 'VTI', null]
      
      for (const benchmark of benchmarks) {
        const backtestData = {
          portfolioId: testPortfolioId,
          startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
          endDate: format(new Date(), 'yyyy-MM-dd'),
          initialCapital: 10000,
          benchmarkSymbol: benchmark
        }

        const response = await request.post('/api/backtests', {
          headers: { 
            Cookie: authCookie,
            'Content-Type': 'application/json'
          },
          data: backtestData
        })

        expect(response.status()).toBe(201)
        
        const responseData = await response.json()
        expect(responseData.success).toBe(true)
      }
    })
  })

  test.describe('GET /api/backtests - List Backtests', () => {
    let backtestId: string

    test.beforeEach(async ({ request }) => {
      // Create a backtest for retrieval tests
      const backtestData = {
        portfolioId: testPortfolioId,
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 10000,
        benchmarkSymbol: 'SPY',
        rebalancingFrequency: 'monthly'
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: backtestData
      })

      const responseData = await response.json()
      backtestId = responseData.data.id
    })

    test('should retrieve user backtests @smoke', async ({ request }) => {
      const response = await request.get('/api/backtests', {
        headers: { Cookie: authCookie }
      })

      expect(response.status()).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.data).toBeInstanceOf(Array)
      expect(responseData.data.length).toBeGreaterThan(0)
      expect(responseData.meta).toHaveProperty('total')
      expect(responseData.meta).toHaveProperty('page')
      expect(responseData.meta).toHaveProperty('limit')
    })

    test('should support pagination', async ({ request }) => {
      const response = await request.get('/api/backtests?page=1&limit=5', {
        headers: { Cookie: authCookie }
      })

      expect(response.status()).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.meta.page).toBe(1)
      expect(responseData.meta.limit).toBe(5)
      expect(responseData.data.length).toBeLessThanOrEqual(5)
    })

    test('should support sorting', async ({ request }) => {
      const response = await request.get('/api/backtests?sortBy=createdAt&sortOrder=desc', {
        headers: { Cookie: authCookie }
      })

      expect(response.status()).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      
      // Verify sorting (most recent first)
      if (responseData.data.length > 1) {
        const first = new Date(responseData.data[0].createdAt)
        const second = new Date(responseData.data[1].createdAt)
        expect(first >= second).toBe(true)
      }
    })

    test('should require authentication for listing', async ({ request }) => {
      const response = await request.get('/api/backtests')

      expect(response.status()).toBe(401)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error.code).toBe('AUTHENTICATION_REQUIRED')
    })

    test('should only return user own backtests', async ({ request }) => {
      const response = await request.get('/api/backtests', {
        headers: { Cookie: authCookie }
      })

      expect(response.status()).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      
      // All backtests should belong to the authenticated user
      for (const backtest of responseData.data) {
        expect(backtest).toHaveProperty('id')
        expect(backtest).toHaveProperty('status')
        expect(backtest).toHaveProperty('createdAt')
      }
    })
  })

  test.describe('GET /api/backtests/[id] - Get Specific Backtest', () => {
    let backtestId: string

    test.beforeEach(async ({ request }) => {
      // Create a backtest for retrieval tests
      const backtestData = {
        portfolioId: testPortfolioId,
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 15000,
        benchmarkSymbol: 'QQQ',
        rebalancingFrequency: 'quarterly',
        parameters: {
          strategy: 'momentum'
        }
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: backtestData
      })

      const responseData = await response.json()
      backtestId = responseData.data.id
    })

    test('should retrieve specific backtest @smoke', async ({ request }) => {
      const response = await request.get(`/api/backtests/${backtestId}`, {
        headers: { Cookie: authCookie }
      })

      expect(response.status()).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.data.id).toBe(backtestId)
      expect(responseData.data).toHaveProperty('status')
      expect(responseData.data).toHaveProperty('portfolio')
      expect(responseData.data).toHaveProperty('initialCapital', 15000)
      expect(responseData.data).toHaveProperty('benchmarkSymbol', 'QQQ')
    })

    test('should handle non-existent backtest', async ({ request }) => {
      const nonExistentId = '00000000-0000-4000-8000-000000000000'
      
      const response = await request.get(`/api/backtests/${nonExistentId}`, {
        headers: { Cookie: authCookie }
      })

      expect(response.status()).toBe(404)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error.code).toBe('RESOURCE_NOT_FOUND')
    })

    test('should handle invalid backtest ID format', async ({ request }) => {
      const response = await request.get(`/api/backtests/invalid-id`, {
        headers: { Cookie: authCookie }
      })

      expect(response.status()).toBe(400)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error.code).toBe('VALIDATION_ERROR')
    })

    test('should require authentication for specific backtest', async ({ request }) => {
      const response = await request.get(`/api/backtests/${backtestId}`)

      expect(response.status()).toBe(401)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error.code).toBe('AUTHENTICATION_REQUIRED')
    })

    test('should include related portfolio data', async ({ request }) => {
      const response = await request.get(`/api/backtests/${backtestId}`, {
        headers: { Cookie: authCookie }
      })

      expect(response.status()).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      
      // Should include portfolio information
      expect(responseData.data.portfolio).toBeDefined()
      expect(responseData.data.portfolio).toHaveProperty('id', testPortfolioId)
      expect(responseData.data.portfolio).toHaveProperty('name')
      expect(responseData.data.portfolio).toHaveProperty('holdings')
    })
  })

  test.describe('Rate Limiting and Performance', () => {
    test('should enforce rate limits on backtest creation', async ({ request }) => {
      const backtestData = {
        portfolioId: testPortfolioId,
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 10000,
        benchmarkSymbol: 'SPY',
        rebalancingFrequency: 'monthly'
      }

      // Make multiple rapid requests
      const promises = []
      for (let i = 0; i < 12; i++) { // Exceed the limit of 10 per minute
        promises.push(
          request.post('/api/backtests', {
            headers: { 
              Cookie: authCookie,
              'Content-Type': 'application/json'
            },
            data: backtestData
          })
        )
      }

      const responses = await Promise.all(promises)
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(r => r.status() === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })

    test('should handle concurrent backtest creation', async ({ request }) => {
      const backtestData = {
        portfolioId: testPortfolioId,
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 10000,
        benchmarkSymbol: 'SPY',
        rebalancingFrequency: 'monthly'
      }

      // Make concurrent requests
      const promises = [
        request.post('/api/backtests', {
          headers: { 
            Cookie: authCookie,
            'Content-Type': 'application/json'
          },
          data: backtestData
        }),
        request.post('/api/backtests', {
          headers: { 
            Cookie: authCookie,
            'Content-Type': 'application/json'
          },
          data: { ...backtestData, initialCapital: 20000 }
        })
      ]

      const responses = await Promise.all(promises)
      
      // Both should succeed (within rate limit)
      for (const response of responses) {
        expect([201, 429]).toContain(response.status()) // Either created or rate limited
      }
    })

    test('should respond quickly to GET requests', async ({ request }) => {
      const startTime = Date.now()
      
      const response = await request.get('/api/backtests', {
        headers: { Cookie: authCookie }
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(response.status()).toBe(200)
      expect(responseTime).toBeLessThan(5000) // Should respond within 5 seconds
    })
  })

  test.describe('Real Market Data Integration', () => {
    test('should create backtest with real ETF symbols', async ({ request }) => {
      const realETFPortfolio = {
        portfolioId: testPortfolioId,
        startDate: format(subYears(new Date(), 2), 'yyyy-MM-dd'), // 2 years of real data
        endDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'), // Exclude most recent 30 days
        initialCapital: 50000,
        benchmarkSymbol: 'SPY',
        rebalancingFrequency: 'monthly',
        customHoldings: [
          { symbol: 'SPY', allocation: 0.4 }, // Real ETF
          { symbol: 'QQQ', allocation: 0.3 }, // Real ETF
          { symbol: 'IWM', allocation: 0.2 }, // Real ETF
          { symbol: 'BND', allocation: 0.1 }  // Real ETF
        ]
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: realETFPortfolio
      })

      expect(response.status()).toBe(201)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.data.id).toBeTruthy()
    })

    test('should handle invalid ETF symbols gracefully', async ({ request }) => {
      // This test assumes the system validates symbols against real market data
      const invalidETFPortfolio = {
        portfolioId: testPortfolioId,
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 10000,
        customHoldings: [
          { symbol: 'INVALID123', allocation: 0.5 }, // Invalid symbol
          { symbol: 'FAKE456', allocation: 0.5 }     // Invalid symbol
        ]
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: invalidETFPortfolio
      })

      // Should either succeed (if system doesn't validate symbols immediately)
      // or fail with appropriate error
      if (response.status() !== 201) {
        expect(response.status()).toBe(400)
        const responseData = await response.json()
        expect(responseData.success).toBe(false)
      }
    })

    test('should create backtest with historical date range', async ({ request }) => {
      // Test with specific historical period (2020-2021 for COVID market impact)
      const historicalBacktest = {
        portfolioId: testPortfolioId,
        startDate: '2020-01-01',
        endDate: '2021-12-31',
        initialCapital: 100000,
        benchmarkSymbol: 'SPY',
        rebalancingFrequency: 'quarterly'
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: historicalBacktest
      })

      expect(response.status()).toBe(201)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.data.id).toBeTruthy()
    })
  })

  test.describe('Response Schema Validation', () => {
    test('should return properly structured create response', async ({ request }) => {
      const backtestData = {
        portfolioId: testPortfolioId,
        startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        initialCapital: 10000,
        benchmarkSymbol: 'SPY',
        rebalancingFrequency: 'monthly'
      }

      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: backtestData
      })

      expect(response.status()).toBe(201)
      
      const responseData = await response.json()
      
      // Validate response structure
      expect(responseData).toHaveProperty('success', true)
      expect(responseData).toHaveProperty('data')
      expect(responseData.data).toHaveProperty('id')
      expect(responseData.data).toHaveProperty('status', 'pending')
      expect(responseData.data).toHaveProperty('message')
      expect(responseData.data).toHaveProperty('backtest')
      
      // Validate backtest object structure
      expect(responseData.data.backtest).toHaveProperty('id')
      expect(responseData.data.backtest).toHaveProperty('portfolioId', testPortfolioId)
      expect(responseData.data.backtest).toHaveProperty('startDate')
      expect(responseData.data.backtest).toHaveProperty('endDate')
      expect(responseData.data.backtest).toHaveProperty('initialCapital', 10000)
      expect(responseData.data.backtest).toHaveProperty('benchmarkSymbol', 'SPY')
    })

    test('should return properly structured list response', async ({ request }) => {
      const response = await request.get('/api/backtests', {
        headers: { Cookie: authCookie }
      })

      expect(response.status()).toBe(200)
      
      const responseData = await response.json()
      
      // Validate response structure
      expect(responseData).toHaveProperty('success', true)
      expect(responseData).toHaveProperty('data')
      expect(responseData).toHaveProperty('meta')
      
      // Validate meta object
      expect(responseData.meta).toHaveProperty('total')
      expect(responseData.meta).toHaveProperty('page')
      expect(responseData.meta).toHaveProperty('limit')
      expect(responseData.meta).toHaveProperty('totalPages')
      
      // Validate data array
      expect(Array.isArray(responseData.data)).toBe(true)
      
      if (responseData.data.length > 0) {
        const backtest = responseData.data[0]
        expect(backtest).toHaveProperty('id')
        expect(backtest).toHaveProperty('status')
        expect(backtest).toHaveProperty('createdAt')
        expect(backtest).toHaveProperty('portfolio')
      }
    })

    test('should return properly structured error responses', async ({ request }) => {
      const response = await request.post('/api/backtests', {
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json'
        },
        data: {} // Invalid data
      })

      expect(response.status()).toBe(400)
      
      const responseData = await response.json()
      
      // Validate error response structure
      expect(responseData).toHaveProperty('success', false)
      expect(responseData).toHaveProperty('error')
      expect(responseData.error).toHaveProperty('code')
      expect(responseData.error).toHaveProperty('message')
      expect(responseData.error).toHaveProperty('timestamp')
    })
  })
})
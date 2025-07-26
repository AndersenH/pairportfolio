'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { TrendingUp, BarChart3, PieChart, Search, Star, Play, Trash2, Download, Share2 } from 'lucide-react'

interface PortfolioItem {
  symbol: string
  name: string
  allocation: number
  color?: string
}

interface PopularETF {
  symbol: string
  name: string
  type: string
  color: string
}

const popularETFs: PopularETF[] = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'S&P 500', color: 'from-blue-50 to-blue-100 border-blue-200 text-blue-700' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'NASDAQ', color: 'from-green-50 to-green-100 border-green-200 text-green-700' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market', type: 'Total Market', color: 'from-purple-50 to-purple-100 border-purple-200 text-purple-700' },
  { symbol: 'BND', name: 'Vanguard Total Bond Market', type: 'Bonds', color: 'from-orange-50 to-orange-100 border-orange-200 text-orange-700' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', type: 'Gold', color: 'from-yellow-50 to-yellow-100 border-yellow-200 text-yellow-700' },
  { symbol: 'VXUS', name: 'Vanguard Total International Stock', type: 'International', color: 'from-red-50 to-red-100 border-red-200 text-red-700' }
]

export default function HomePage() {
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([
    { symbol: 'VTI', name: 'Vanguard Total Stock Market', allocation: 50 },
    { symbol: 'BND', name: 'Vanguard Total Bond Market', allocation: 50 }
  ])
  const [portfolioName, setPortfolioName] = useState('My ETF Portfolio')
  const [initialInvestment, setInitialInvestment] = useState(10000)
  const [strategy, setStrategy] = useState('buy-hold')
  const [searchQuery, setSearchQuery] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  const addETFToPortfolio = (etf: PopularETF) => {
    const exists = portfolioItems.find(item => item.symbol === etf.symbol)
    if (exists) return

    const newItems = [...portfolioItems, {
      symbol: etf.symbol,
      name: etf.name,
      allocation: 0
    }]
    setPortfolioItems(newItems)
    rebalancePortfolio(newItems)
  }

  const removeFromPortfolio = (symbol: string) => {
    const newItems = portfolioItems.filter(item => item.symbol !== symbol)
    setPortfolioItems(newItems)
    rebalancePortfolio(newItems)
  }

  const rebalancePortfolio = (items: PortfolioItem[]) => {
    if (items.length === 0) return
    const equalWeight = Math.round((100 / items.length) * 100) / 100
    const updatedItems = items.map((item, index) => ({
      ...item,
      allocation: index === items.length - 1 ? 100 - (equalWeight * (items.length - 1)) : equalWeight
    }))
    setPortfolioItems(updatedItems)
  }

  const updateAllocation = (symbol: string, allocation: number) => {
    setPortfolioItems(prev => prev.map(item => 
      item.symbol === symbol ? { ...item, allocation } : item
    ))
  }

  const handleRunBacktest = () => {
    setIsRunning(true)
    setTimeout(() => setIsRunning(false), 3000)
  }

  const totalAllocation = portfolioItems.reduce((sum, item) => sum + item.allocation, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-indigo-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-8 h-8" />
              <h1 className="text-2xl font-bold">ETF Replay</h1>
            </div>
            <nav className="hidden md:flex space-x-6">
              <Link href="#" className="hover:text-indigo-200 transition">Home</Link>
              <Link href="#" className="hover:text-indigo-200 transition">Explore ETFs</Link>
              <Link href="#" className="hover:text-indigo-200 transition">Strategies</Link>
              <Link href="#" className="hover:text-indigo-200 transition">About</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Portfolio Builder Section */}
          <div className="lg:col-span-1">
            <Card className="p-6 lg:sticky lg:top-4" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-indigo-700 flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Portfolio Builder
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 space-y-6">
                {/* Portfolio Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Portfolio Name</label>
                  <Input 
                    value={portfolioName}
                    onChange={(e) => setPortfolioName(e.target.value)}
                    placeholder="My ETF Portfolio"
                  />
                </div>

                {/* Initial Investment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Initial Investment ($)</label>
                  <Input 
                    type="number"
                    value={initialInvestment}
                    onChange={(e) => setInitialInvestment(Number(e.target.value))}
                    min={100}
                  />
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                  <div className="flex space-x-2">
                    <Input type="date" defaultValue="2019-01-01" />
                    <span className="flex items-center text-sm text-gray-500">to</span>
                    <Input type="date" defaultValue="2024-01-01" />
                  </div>
                </div>

                {/* Strategy Type */}
                <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
                  <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Strategy Type
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                  >
                    <option value="buy-hold">Buy & Hold</option>
                    <option value="momentum">Momentum</option>
                  </select>
                </div>

                {/* Popular ETFs */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    Popular ETFs
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {popularETFs.map((etf) => (
                      <button
                        key={etf.symbol}
                        onClick={() => addETFToPortfolio(etf)}
                        className={`p-3 bg-gradient-to-r ${etf.color} border rounded-lg hover:scale-105 transition-all duration-200 text-left`}
                      >
                        <div className="font-bold">{etf.symbol}</div>
                        <div className="text-xs">{etf.type}</div>
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 italic">Click any ETF above to quickly add to your portfolio</div>
                </div>

                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Search Stocks & ETFs
                  </label>
                  <Input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for stocks/ETFs (e.g., AAPL, SPY, QQQ...)"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Type 2+ characters to search thousands of stocks and ETFs
                  </div>
                </div>

                {/* Portfolio Items */}
                <div className="space-y-3">
                  {portfolioItems.map((item) => (
                    <div key={item.symbol} className="bg-gray-100 p-3 rounded-md flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium">{item.symbol}</span>
                        <span className="text-sm text-gray-600 truncate max-w-32">{item.name}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Input 
                          type="number"
                          className="w-20"
                          value={item.allocation}
                          onChange={(e) => updateAllocation(item.symbol, Number(e.target.value))}
                          min={0}
                          max={100}
                        />
                        <span className="text-sm">%</span>
                        <button 
                          onClick={() => removeFromPortfolio(item.symbol)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Allocation Warning */}
                {Math.abs(totalAllocation - 100) > 0.1 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="text-sm text-yellow-800">
                      Total allocation: {totalAllocation.toFixed(1)}% (should be 100%)
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-between pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setPortfolioItems([])}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </Button>
                  <Button 
                    onClick={handleRunBacktest}
                    disabled={isRunning || portfolioItems.length === 0 || Math.abs(totalAllocation - 100) > 0.1}
                    className="bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2"
                  >
                    {isRunning ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Run Backtest
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2 space-y-8">
            {/* Performance Summary */}
            <Card className="p-6">
              <CardHeader className="px-0 pt-0 pb-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-indigo-700">Performance Summary</CardTitle>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Share2 className="w-4 h-4" />
                      Share
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-indigo-50 p-4 rounded-lg text-center hover:scale-105 transition-transform">
                    <div className="text-sm text-indigo-600 font-medium">Final Value</div>
                    <div className="text-2xl font-bold">-</div>
                    <div className="text-sm text-gray-500">Run backtest</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center hover:scale-105 transition-transform">
                    <div className="text-sm text-green-600 font-medium">CAGR</div>
                    <div className="text-2xl font-bold">-</div>
                    <div className="text-sm text-gray-500">Annualized</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center hover:scale-105 transition-transform">
                    <div className="text-sm text-blue-600 font-medium">Max Drawdown</div>
                    <div className="text-2xl font-bold">-</div>
                    <div className="text-sm text-gray-500">Real Data</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center hover:scale-105 transition-transform">
                    <div className="text-sm text-purple-600 font-medium">Sharpe Ratio</div>
                    <div className="text-2xl font-bold">-</div>
                    <div className="text-sm text-gray-500">Risk-Adjusted</div>
                  </div>
                </div>
                
                <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <div>Performance chart will appear here</div>
                    <div className="text-sm">Run a backtest to see results</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Portfolio Allocation */}
            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-indigo-700">Portfolio Allocation</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="font-medium mb-4">Current Allocation</h3>
                    <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <PieChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <div>Allocation chart</div>
                        <div className="text-sm">Add ETFs to see allocation</div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium mb-4">Holdings ({portfolioItems.length})</h3>
                    <div className="space-y-2">
                      {portfolioItems.map((item) => (
                        <div key={item.symbol} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <div>
                            <span className="font-medium">{item.symbol}</span>
                            <div className="text-xs text-gray-500 truncate max-w-32">{item.name}</div>
                          </div>
                          <Badge variant="secondary">{item.allocation.toFixed(1)}%</Badge>
                        </div>
                      ))}
                      {portfolioItems.length === 0 && (
                        <div className="text-center text-gray-500 py-8">
                          <div>No holdings yet</div>
                          <div className="text-sm">Add ETFs from the popular selection</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-gray-900">Platform Features</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span>Real market data integration</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span>Multiple backtesting strategies</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span>Comprehensive performance metrics</span>
                    </li>
                  </ul>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span>Interactive charts and visualizations</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span>Portfolio risk analysis</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span>Export and sharing capabilities</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">ETF Replay</h3>
              <p className="text-gray-400">Empowering investors with powerful backtesting tools to make informed decisions.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><Link href="#" className="text-gray-400 hover:text-white transition">Documentation</Link></li>
                <li><Link href="#" className="text-gray-400 hover:text-white transition">API</Link></li>
                <li><Link href="#" className="text-gray-400 hover:text-white transition">Tutorials</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link href="#" className="text-gray-400 hover:text-white transition">Terms of Service</Link></li>
                <li><Link href="#" className="text-gray-400 hover:text-white transition">Privacy Policy</Link></li>
                <li><Link href="#" className="text-gray-400 hover:text-white transition">Disclaimer</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Connect</h3>
              <div className="flex space-x-4">
                <Link href="#" className="text-gray-400 hover:text-white transition">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                </Link>
                <Link href="#" className="text-gray-400 hover:text-white transition">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </Link>
                <Link href="#" className="text-gray-400 hover:text-white transition">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </Link>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>© 2024 ETF Replay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
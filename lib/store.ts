import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { 
  User, 
  Portfolio, 
  Backtest, 
  BacktestResult, 
  MarketData,
  ETFInfo 
} from './types'

// User Store
interface UserState {
  user: User | null
  isAuthenticated: boolean
  preferences: {
    theme: 'light' | 'dark' | 'system'
    currency: 'USD' | 'EUR' | 'GBP'
    defaultRiskLevel: 'conservative' | 'moderate' | 'aggressive'
    notifications: {
      email: boolean
      push: boolean
      backtestComplete: boolean
      portfolioUpdates: boolean
    }
  }
  session: {
    lastActive: string | null
    loginTime: string | null
  }
}

interface UserActions {
  setUser: (user: User | null) => void
  setAuthenticated: (isAuthenticated: boolean) => void
  updatePreferences: (preferences: Partial<UserState['preferences']>) => void
  updateSessionActivity: () => void
  logout: () => void
}

export const useUserStore = create<UserState & UserActions>()(
  persist(
    immer((set) => ({
      // State
      user: null,
      isAuthenticated: false,
      preferences: {
        theme: 'system',
        currency: 'USD',
        defaultRiskLevel: 'moderate',
        notifications: {
          email: true,
          push: true,
          backtestComplete: true,
          portfolioUpdates: false
        }
      },
      session: {
        lastActive: null,
        loginTime: null
      },

      // Actions
      setUser: (user) => set((state) => {
        state.user = user
        if (user && !state.session.loginTime) {
          state.session.loginTime = new Date().toISOString()
        }
      }),

      setAuthenticated: (isAuthenticated) => set((state) => {
        state.isAuthenticated = isAuthenticated
        if (!isAuthenticated) {
          state.user = null
          state.session = { lastActive: null, loginTime: null }
        }
      }),

      updatePreferences: (preferences) => set((state) => {
        Object.assign(state.preferences, preferences)
      }),

      updateSessionActivity: () => set((state) => {
        state.session.lastActive = new Date().toISOString()
      }),

      logout: () => set((state) => {
        state.user = null
        state.isAuthenticated = false
        state.session = { lastActive: null, loginTime: null }
      })
    })),
    {
      name: 'user-store',
      partialize: (state) => ({
        preferences: state.preferences,
        session: state.session
      })
    }
  )
)

// Portfolio Store
interface PortfolioState {
  portfolios: Portfolio[]
  selectedPortfolio: Portfolio | null
  isLoading: boolean
  error: string | null
  editingPortfolio: Portfolio | null
  searchQuery: string
  filters: {
    riskLevel: string[]
    allocation: string[]
    performance: string[]
  }
}

interface PortfolioActions {
  setPortfolios: (portfolios: Portfolio[]) => void
  addPortfolio: (portfolio: Portfolio) => void
  updatePortfolio: (id: string, updates: Partial<Portfolio>) => void
  deletePortfolio: (id: string) => void
  setSelectedPortfolio: (portfolio: Portfolio | null) => void
  setEditingPortfolio: (portfolio: Portfolio | null) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  setSearchQuery: (query: string) => void
  updateFilters: (filters: Partial<PortfolioState['filters']>) => void
  clearFilters: () => void
}

export const usePortfolioStore = create<PortfolioState & PortfolioActions>()(
  immer((set) => ({
    // State
    portfolios: [],
    selectedPortfolio: null,
    isLoading: false,
    error: null,
    editingPortfolio: null,
    searchQuery: '',
    filters: {
      riskLevel: [],
      allocation: [],
      performance: []
    },

    // Actions
    setPortfolios: (portfolios) => set((state) => {
      state.portfolios = portfolios
      state.isLoading = false
      state.error = null
    }),

    addPortfolio: (portfolio) => set((state) => {
      state.portfolios.push(portfolio)
    }),

    updatePortfolio: (id, updates) => set((state) => {
      const index = state.portfolios.findIndex(p => p.id === id)
      if (index !== -1) {
        Object.assign(state.portfolios[index], updates)
      }
      if (state.selectedPortfolio?.id === id) {
        Object.assign(state.selectedPortfolio, updates)
      }
    }),

    deletePortfolio: (id) => set((state) => {
      state.portfolios = state.portfolios.filter(p => p.id !== id)
      if (state.selectedPortfolio?.id === id) {
        state.selectedPortfolio = null
      }
    }),

    setSelectedPortfolio: (portfolio) => set((state) => {
      state.selectedPortfolio = portfolio
    }),

    setEditingPortfolio: (portfolio) => set((state) => {
      state.editingPortfolio = portfolio
    }),

    setLoading: (isLoading) => set((state) => {
      state.isLoading = isLoading
    }),

    setError: (error) => set((state) => {
      state.error = error
      state.isLoading = false
    }),

    setSearchQuery: (query) => set((state) => {
      state.searchQuery = query
    }),

    updateFilters: (filters) => set((state) => {
      Object.assign(state.filters, filters)
    }),

    clearFilters: () => set((state) => {
      state.filters = {
        riskLevel: [],
        allocation: [],
        performance: []
      }
      state.searchQuery = ''
    })
  }))
)

// Backtest Store
interface BacktestState {
  backtests: Backtest[]
  activeBacktests: Backtest[]
  backtestResults: Map<string, BacktestResult>
  isRunning: boolean
  currentBacktest: Backtest | null
  configuration: {
    strategy: string | null
    parameters: Record<string, any>
    portfolioId: string | null
    dateRange: {
      start: Date | null
      end: Date | null
    }
    initialCapital: number
    rebalancingFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually'
  }
  comparison: {
    selectedBacktests: string[]
    benchmark: string | null
  }
}

interface BacktestActions {
  setBacktests: (backtests: Backtest[]) => void
  addBacktest: (backtest: Backtest) => void
  updateBacktest: (id: string, updates: Partial<Backtest>) => void
  deleteBacktest: (id: string) => void
  setBacktestResult: (backtestId: string, result: BacktestResult) => void
  setCurrentBacktest: (backtest: Backtest | null) => void
  setRunning: (isRunning: boolean) => void
  updateConfiguration: (config: Partial<BacktestState['configuration']>) => void
  resetConfiguration: () => void
  addToComparison: (backtestId: string) => void
  removeFromComparison: (backtestId: string) => void
  setBenchmark: (benchmark: string | null) => void
  clearComparison: () => void
}

export const useBacktestStore = create<BacktestState & BacktestActions>()(
  persist(
    immer((set, get) => ({
      // State
      backtests: [],
      activeBacktests: [],
      backtestResults: new Map(),
      isRunning: false,
      currentBacktest: null,
      configuration: {
        strategy: null,
        parameters: {},
        portfolioId: null,
        dateRange: {
          start: null,
          end: null
        },
        initialCapital: 100000,
        rebalancingFrequency: 'monthly'
      },
      comparison: {
        selectedBacktests: [],
        benchmark: null
      },

      // Actions
      setBacktests: (backtests) => set((state) => {
        state.backtests = backtests
        state.activeBacktests = backtests.filter(b => 
          b.status === 'running' || b.status === 'queued'
        )
      }),

      addBacktest: (backtest) => set((state) => {
        state.backtests.push(backtest)
        if (backtest.status === 'running' || backtest.status === 'queued') {
          state.activeBacktests.push(backtest)
        }
      }),

      updateBacktest: (id, updates) => set((state) => {
        const index = state.backtests.findIndex(b => b.id === id)
        if (index !== -1) {
          Object.assign(state.backtests[index], updates)
        }
        
        const activeIndex = state.activeBacktests.findIndex(b => b.id === id)
        if (activeIndex !== -1) {
          if (updates.status && ['completed', 'failed', 'cancelled'].includes(updates.status)) {
            state.activeBacktests.splice(activeIndex, 1)
          } else {
            Object.assign(state.activeBacktests[activeIndex], updates)
          }
        }
      }),

      deleteBacktest: (id) => set((state) => {
        state.backtests = state.backtests.filter(b => b.id !== id)
        state.activeBacktests = state.activeBacktests.filter(b => b.id !== id)
        state.backtestResults.delete(id)
        state.comparison.selectedBacktests = state.comparison.selectedBacktests.filter(bid => bid !== id)
      }),

      setBacktestResult: (backtestId, result) => set((state) => {
        state.backtestResults.set(backtestId, result)
      }),

      setCurrentBacktest: (backtest) => set((state) => {
        state.currentBacktest = backtest
      }),

      setRunning: (isRunning) => set((state) => {
        state.isRunning = isRunning
      }),

      updateConfiguration: (config) => set((state) => {
        Object.assign(state.configuration, config)
      }),

      resetConfiguration: () => set((state) => {
        state.configuration = {
          strategy: null,
          parameters: {},
          portfolioId: null,
          dateRange: {
            start: null,
            end: null
          },
          initialCapital: 100000,
          rebalancingFrequency: 'monthly'
        }
      }),

      addToComparison: (backtestId) => set((state) => {
        if (!state.comparison.selectedBacktests.includes(backtestId)) {
          state.comparison.selectedBacktests.push(backtestId)
        }
      }),

      removeFromComparison: (backtestId) => set((state) => {
        state.comparison.selectedBacktests = state.comparison.selectedBacktests.filter(id => id !== backtestId)
      }),

      setBenchmark: (benchmark) => set((state) => {
        state.comparison.benchmark = benchmark
      }),

      clearComparison: () => set((state) => {
        state.comparison.selectedBacktests = []
        state.comparison.benchmark = null
      })
    })),
    {
      name: 'backtest-store',
      partialize: (state) => ({
        configuration: state.configuration,
        comparison: state.comparison
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          
          // Convert date strings back to Date objects
          if (parsed.state?.configuration?.dateRange) {
            const { start, end } = parsed.state.configuration.dateRange
            parsed.state.configuration.dateRange = {
              start: start ? new Date(start) : null,
              end: end ? new Date(end) : null
            }
          }
          
          return parsed
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
        }
      }
    }
  )
)

// UI Store
interface UIState {
  loading: {
    global: boolean
    portfolios: boolean
    backtests: boolean
    marketData: boolean
  }
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message: string
    timestamp: Date
    duration?: number
  }>
  modals: {
    createPortfolio: boolean
    editPortfolio: boolean
    deletePortfolio: boolean
    backtestConfiguration: boolean
    backtestResults: boolean
  }
  sidebar: {
    isOpen: boolean
    isCollapsed: boolean
  }
  theme: 'light' | 'dark' | 'system'
  layout: {
    compactMode: boolean
    showAdvancedMetrics: boolean
  }
}

interface UIActions {
  setLoading: (key: keyof UIState['loading'], isLoading: boolean) => void
  addNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
  toggleModal: (modal: keyof UIState['modals'], isOpen?: boolean) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (isCollapsed: boolean) => void
  setTheme: (theme: UIState['theme']) => void
  updateLayout: (layout: Partial<UIState['layout']>) => void
}

export const useUIStore = create<UIState & UIActions>()(
  persist(
    immer((set) => ({
      // State
      loading: {
        global: false,
        portfolios: false,
        backtests: false,
        marketData: false
      },
      notifications: [],
      modals: {
        createPortfolio: false,
        editPortfolio: false,
        deletePortfolio: false,
        backtestConfiguration: false,
        backtestResults: false
      },
      sidebar: {
        isOpen: true,
        isCollapsed: false
      },
      theme: 'system',
      layout: {
        compactMode: false,
        showAdvancedMetrics: false
      },

      // Actions
      setLoading: (key, isLoading) => set((state) => {
        state.loading[key] = isLoading
      }),

      addNotification: (notification) => set((state) => {
        const id = Math.random().toString(36).substr(2, 9)
        state.notifications.push({
          ...notification,
          id,
          timestamp: new Date()
        })
      }),

      removeNotification: (id) => set((state) => {
        state.notifications = state.notifications.filter(n => n.id !== id)
      }),

      clearNotifications: () => set((state) => {
        state.notifications = []
      }),

      toggleModal: (modal, isOpen) => set((state) => {
        state.modals[modal] = isOpen ?? !state.modals[modal]
      }),

      toggleSidebar: () => set((state) => {
        state.sidebar.isOpen = !state.sidebar.isOpen
      }),

      setSidebarCollapsed: (isCollapsed) => set((state) => {
        state.sidebar.isCollapsed = isCollapsed
      }),

      setTheme: (theme) => set((state) => {
        state.theme = theme
      }),

      updateLayout: (layout) => set((state) => {
        Object.assign(state.layout, layout)
      })
    })),
    {
      name: 'ui-store',
      partialize: (state) => ({
        sidebar: state.sidebar,
        theme: state.theme,
        layout: state.layout
      })
    }
  )
)

// Market Data Store
interface MarketDataState {
  cachedData: Map<string, MarketData[]>
  realTimePrices: Map<string, { price: number; change: number; changePercent: number; timestamp: Date }>
  etfInfo: Map<string, ETFInfo>
  searchResults: ETFInfo[]
  isLoading: boolean
  lastUpdate: Date | null
  subscriptions: Set<string>
}

interface MarketDataActions {
  setCachedData: (symbol: string, data: MarketData[]) => void
  setRealTimePrice: (symbol: string, price: { price: number; change: number; changePercent: number }) => void
  setETFInfo: (symbol: string, info: ETFInfo) => void
  setSearchResults: (results: ETFInfo[]) => void
  addSubscription: (symbol: string) => void
  removeSubscription: (symbol: string) => void
  clearCache: () => void
  updateLastUpdate: () => void
}

export const useMarketDataStore = create<MarketDataState & MarketDataActions>()(
  immer((set) => ({
    // State
    cachedData: new Map(),
    realTimePrices: new Map(),
    etfInfo: new Map(),
    searchResults: [],
    isLoading: false,
    lastUpdate: null,
    subscriptions: new Set(),

    // Actions
    setCachedData: (symbol, data) => set((state) => {
      state.cachedData.set(symbol, data)
      state.lastUpdate = new Date()
    }),

    setRealTimePrice: (symbol, price) => set((state) => {
      state.realTimePrices.set(symbol, {
        ...price,
        timestamp: new Date()
      })
    }),

    setETFInfo: (symbol, info) => set((state) => {
      state.etfInfo.set(symbol, info)
    }),

    setSearchResults: (results) => set((state) => {
      state.searchResults = results
    }),

    addSubscription: (symbol) => set((state) => {
      state.subscriptions.add(symbol)
    }),

    removeSubscription: (symbol) => set((state) => {
      state.subscriptions.delete(symbol)
    }),

    clearCache: () => set((state) => {
      state.cachedData.clear()
      state.realTimePrices.clear()
      state.etfInfo.clear()
      state.lastUpdate = null
    }),

    updateLastUpdate: () => set((state) => {
      state.lastUpdate = new Date()
    })
  }))
)

// Combined store hook for convenience
export const useAppStore = () => ({
  user: useUserStore(),
  portfolio: usePortfolioStore(),
  backtest: useBacktestStore(),
  ui: useUIStore(),
  marketData: useMarketDataStore()
})

// Store utilities
export const storeUtils = {
  // Reset all stores (useful for logout)
  resetStores: () => {
    useUserStore.getState().logout()
    usePortfolioStore.setState({
      portfolios: [],
      selectedPortfolio: null,
      editingPortfolio: null,
      searchQuery: '',
      filters: { riskLevel: [], allocation: [], performance: [] }
    })
    useBacktestStore.getState().resetConfiguration()
    useBacktestStore.getState().clearComparison()
    useUIStore.getState().clearNotifications()
    useMarketDataStore.getState().clearCache()
  },

  // Get loading state across all stores
  getGlobalLoadingState: () => {
    const portfolioLoading = usePortfolioStore.getState().isLoading
    const backtestRunning = useBacktestStore.getState().isRunning
    const uiLoading = Object.values(useUIStore.getState().loading).some(Boolean)
    
    return portfolioLoading || backtestRunning || uiLoading
  },

  // Get combined notification count
  getNotificationCount: () => {
    return useUIStore.getState().notifications.length
  }
}
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { PortfolioWithHoldings } from '@/types'
import type { Portfolio, PortfolioHolding } from '@prisma/client'

export interface PortfolioFormData {
  name: string
  description?: string
  isPublic: boolean
  holdings: Array<{
    symbol: string
    allocation: number
    name?: string
  }>
}

export interface PortfolioFilters {
  search: string
  isPublic?: boolean
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'totalValue'
  sortOrder: 'asc' | 'desc'
  userId?: string
}

export interface PortfolioOptimization {
  portfolioId: string
  targetReturn?: number
  riskTolerance: 'low' | 'medium' | 'high'
  constraints: {
    maxAllocation?: number
    minAllocation?: number
    excludedSectors?: string[]
    preferredSectors?: string[]
  }
  results?: {
    suggestedAllocations: Record<string, number>
    expectedReturn: number
    expectedRisk: number
    sharpeRatio: number
  }
}

interface PortfolioState {
  // Portfolio data
  portfolios: PortfolioWithHoldings[]
  selectedPortfolio: PortfolioWithHoldings | null
  favoritePortfolios: string[] // portfolio IDs
  
  // Form and editing state
  editingPortfolio: PortfolioWithHoldings | null
  portfolioForm: PortfolioFormData
  isDirty: boolean
  
  // UI state
  isLoading: boolean
  isSaving: boolean
  isDeleting: boolean
  filters: PortfolioFilters
  
  // Optimization
  optimization: PortfolioOptimization | null
  isOptimizing: boolean
  
  // Comparison
  comparisonPortfolios: string[] // portfolio IDs for comparison
  
  // Actions - Portfolio CRUD
  setPortfolios: (portfolios: PortfolioWithHoldings[]) => void
  addPortfolio: (portfolio: PortfolioWithHoldings) => void
  updatePortfolio: (id: string, updates: Partial<Portfolio>) => void
  deletePortfolio: (id: string) => void
  setSelectedPortfolio: (portfolio: PortfolioWithHoldings | null) => void
  
  // Actions - Holdings management
  addHolding: (portfolioId: string, holding: PortfolioHolding) => void
  updateHolding: (portfolioId: string, holdingId: string, updates: Partial<PortfolioHolding>) => void
  removeHolding: (portfolioId: string, holdingId: string) => void
  rebalanceHoldings: (portfolioId: string, allocations: Record<string, number>) => void
  
  // Actions - Form management
  setPortfolioForm: (form: PortfolioFormData) => void
  updatePortfolioForm: (updates: Partial<PortfolioFormData>) => void
  resetPortfolioForm: () => void
  setEditingPortfolio: (portfolio: PortfolioWithHoldings | null) => void
  setIsDirty: (dirty: boolean) => void
  
  // Actions - UI state
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void
  setDeleting: (deleting: boolean) => void
  setFilters: (filters: Partial<PortfolioFilters>) => void
  resetFilters: () => void
  
  // Actions - Favorites
  addToFavorites: (portfolioId: string) => void
  removeFromFavorites: (portfolioId: string) => void
  toggleFavorite: (portfolioId: string) => void
  
  // Actions - Optimization
  setOptimization: (optimization: PortfolioOptimization | null) => void
  setIsOptimizing: (optimizing: boolean) => void
  runOptimization: (portfolioId: string, params: Partial<PortfolioOptimization>) => Promise<void>
  
  // Actions - Comparison
  addToComparison: (portfolioId: string) => void
  removeFromComparison: (portfolioId: string) => void
  clearComparison: () => void
  
  // Computed getters
  getFavoritePortfolios: () => PortfolioWithHoldings[]
  getFilteredPortfolios: () => PortfolioWithHoldings[]
  getPortfolioById: (id: string) => PortfolioWithHoldings | undefined
  getPortfolioValue: (portfolio: PortfolioWithHoldings) => number
  getTotalPortfolioCount: () => number
  getPublicPortfolioCount: () => number
  
  // Validation
  validatePortfolioForm: () => { isValid: boolean; errors: Record<string, string> }
  validateAllocations: (allocations: Record<string, number>) => { isValid: boolean; total: number }
}

const defaultPortfolioForm: PortfolioFormData = {
  name: '',
  description: '',
  isPublic: false,
  holdings: [],
}

const defaultFilters: PortfolioFilters = {
  search: '',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
}

export const usePortfolioStore = create<PortfolioState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        portfolios: [],
        selectedPortfolio: null,
        favoritePortfolios: [],
        editingPortfolio: null,
        portfolioForm: defaultPortfolioForm,
        isDirty: false,
        isLoading: false,
        isSaving: false,
        isDeleting: false,
        filters: defaultFilters,
        optimization: null,
        isOptimizing: false,
        comparisonPortfolios: [],

        // Portfolio CRUD actions
        setPortfolios: (portfolios) => set({ portfolios }),

        addPortfolio: (portfolio) =>
          set((state) => ({
            portfolios: [portfolio, ...state.portfolios],
          })),

        updatePortfolio: (id, updates) =>
          set((state) => ({
            portfolios: state.portfolios.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            ),
            selectedPortfolio:
              state.selectedPortfolio?.id === id
                ? { ...state.selectedPortfolio, ...updates }
                : state.selectedPortfolio,
          })),

        deletePortfolio: (id) =>
          set((state) => ({
            portfolios: state.portfolios.filter((p) => p.id !== id),
            selectedPortfolio:
              state.selectedPortfolio?.id === id ? null : state.selectedPortfolio,
            favoritePortfolios: state.favoritePortfolios.filter((fId) => fId !== id),
            comparisonPortfolios: state.comparisonPortfolios.filter((cId) => cId !== id),
          })),

        setSelectedPortfolio: (portfolio) => set({ selectedPortfolio: portfolio }),

        // Holdings management
        addHolding: (portfolioId, holding) =>
          set((state) => ({
            portfolios: state.portfolios.map((p) =>
              p.id === portfolioId
                ? { ...p, holdings: [...p.holdings, holding] }
                : p
            ),
          })),

        updateHolding: (portfolioId, holdingId, updates) =>
          set((state) => ({
            portfolios: state.portfolios.map((p) =>
              p.id === portfolioId
                ? {
                    ...p,
                    holdings: p.holdings.map((h) =>
                      h.id === holdingId ? { ...h, ...updates } : h
                    ),
                  }
                : p
            ),
          })),

        removeHolding: (portfolioId, holdingId) =>
          set((state) => ({
            portfolios: state.portfolios.map((p) =>
              p.id === portfolioId
                ? { ...p, holdings: p.holdings.filter((h) => h.id !== holdingId) }
                : p
            ),
          })),

        rebalanceHoldings: (portfolioId, allocations) =>
          set((state) => ({
            portfolios: state.portfolios.map((p) =>
              p.id === portfolioId
                ? {
                    ...p,
                    holdings: p.holdings.map((h) => ({
                      ...h,
                      allocation: allocations[h.symbol] || h.allocation,
                    })),
                  }
                : p
            ),
          })),

        // Form management
        setPortfolioForm: (form) => set({ portfolioForm: form }),

        updatePortfolioForm: (updates) =>
          set((state) => ({
            portfolioForm: { ...state.portfolioForm, ...updates },
            isDirty: true,
          })),

        resetPortfolioForm: () =>
          set({ portfolioForm: defaultPortfolioForm, isDirty: false }),

        setEditingPortfolio: (portfolio) => set({ editingPortfolio: portfolio }),

        setIsDirty: (dirty) => set({ isDirty: dirty }),

        // UI state
        setLoading: (loading) => set({ isLoading: loading }),
        setSaving: (saving) => set({ isSaving: saving }),
        setDeleting: (deleting) => set({ isDeleting: deleting }),

        setFilters: (newFilters) =>
          set((state) => ({
            filters: { ...state.filters, ...newFilters },
          })),

        resetFilters: () => set({ filters: defaultFilters }),

        // Favorites
        addToFavorites: (portfolioId) =>
          set((state) => ({
            favoritePortfolios: state.favoritePortfolios.includes(portfolioId)
              ? state.favoritePortfolios
              : [...state.favoritePortfolios, portfolioId],
          })),

        removeFromFavorites: (portfolioId) =>
          set((state) => ({
            favoritePortfolios: state.favoritePortfolios.filter((id) => id !== portfolioId),
          })),

        toggleFavorite: (portfolioId) => {
          const { favoritePortfolios, addToFavorites, removeFromFavorites } = get()
          if (favoritePortfolios.includes(portfolioId)) {
            removeFromFavorites(portfolioId)
          } else {
            addToFavorites(portfolioId)
          }
        },

        // Optimization
        setOptimization: (optimization) => set({ optimization }),
        setIsOptimizing: (optimizing) => set({ isOptimizing: optimizing }),

        runOptimization: async (portfolioId, params) => {
          set({ isOptimizing: true })
          try {
            // This would typically make an API call to run optimization
            const response = await fetch(`/api/portfolios/${portfolioId}/optimize`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(params),
            })

            if (response.ok) {
              const results = await response.json()
              set({
                optimization: {
                  portfolioId,
                  ...params,
                  results,
                },
              })
            }
          } catch (error) {
            console.error('Optimization failed:', error)
          } finally {
            set({ isOptimizing: false })
          }
        },

        // Comparison
        addToComparison: (portfolioId) =>
          set((state) => ({
            comparisonPortfolios:
              state.comparisonPortfolios.length < 5 && !state.comparisonPortfolios.includes(portfolioId)
                ? [...state.comparisonPortfolios, portfolioId]
                : state.comparisonPortfolios,
          })),

        removeFromComparison: (portfolioId) =>
          set((state) => ({
            comparisonPortfolios: state.comparisonPortfolios.filter((id) => id !== portfolioId),
          })),

        clearComparison: () => set({ comparisonPortfolios: [] }),

        // Computed getters
        getFavoritePortfolios: () => {
          const { portfolios, favoritePortfolios } = get()
          return portfolios.filter((p) => favoritePortfolios.includes(p.id))
        },

        getFilteredPortfolios: () => {
          const { portfolios, filters } = get()
          let filtered = [...portfolios]

          // Search filter
          if (filters.search) {
            const searchLower = filters.search.toLowerCase()
            filtered = filtered.filter(
              (p) =>
                p.name.toLowerCase().includes(searchLower) ||
                p.description?.toLowerCase().includes(searchLower) ||
                p.holdings.some((h) => h.symbol.toLowerCase().includes(searchLower))
            )
          }

          // Public filter
          if (filters.isPublic !== undefined) {
            filtered = filtered.filter((p) => p.isPublic === filters.isPublic)
          }

          // User filter
          if (filters.userId) {
            filtered = filtered.filter((p) => p.userId === filters.userId)
          }

          // Sort
          filtered.sort((a, b) => {
            let aVal: any, bVal: any

            switch (filters.sortBy) {
              case 'name':
                aVal = a.name.toLowerCase()
                bVal = b.name.toLowerCase()
                break
              case 'createdAt':
                aVal = new Date(a.createdAt)
                bVal = new Date(b.createdAt)
                break
              case 'updatedAt':
                aVal = new Date(a.updatedAt)
                bVal = new Date(b.updatedAt)
                break
              case 'totalValue':
                aVal = get().getPortfolioValue(a)
                bVal = get().getPortfolioValue(b)
                break
              default:
                return 0
            }

            if (aVal < bVal) return filters.sortOrder === 'asc' ? -1 : 1
            if (aVal > bVal) return filters.sortOrder === 'asc' ? 1 : -1
            return 0
          })

          return filtered
        },

        getPortfolioById: (id) => {
          const { portfolios } = get()
          return portfolios.find((p) => p.id === id)
        },

        getPortfolioValue: (portfolio) => {
          // This would calculate the current value based on holdings and market prices
          // For now, we'll return a placeholder calculation
          return portfolio.holdings.reduce((sum, holding) => sum + holding.allocation * 100, 0)
        },

        getTotalPortfolioCount: () => get().portfolios.length,

        getPublicPortfolioCount: () =>
          get().portfolios.filter((p) => p.isPublic).length,

        // Validation
        validatePortfolioForm: () => {
          const { portfolioForm } = get()
          const errors: Record<string, string> = {}

          if (!portfolioForm.name.trim()) {
            errors.name = 'Portfolio name is required'
          }

          if (portfolioForm.holdings.length === 0) {
            errors.holdings = 'At least one holding is required'
          }

          const totalAllocation = portfolioForm.holdings.reduce(
            (sum, holding) => sum + holding.allocation,
            0
          )

          if (Math.abs(totalAllocation - 100) > 0.01) {
            errors.allocations = `Total allocation must equal 100% (currently ${totalAllocation.toFixed(2)}%)`
          }

          // Check for duplicate symbols
          const symbols = portfolioForm.holdings.map((h) => h.symbol)
          const duplicates = symbols.filter((s, i) => symbols.indexOf(s) !== i)
          if (duplicates.length > 0) {
            errors.duplicates = `Duplicate symbols found: ${duplicates.join(', ')}`
          }

          return {
            isValid: Object.keys(errors).length === 0,
            errors,
          }
        },

        validateAllocations: (allocations) => {
          const total = Object.values(allocations).reduce((sum, allocation) => sum + allocation, 0)
          return {
            isValid: Math.abs(total - 100) <= 0.01,
            total,
          }
        },
      }),
      {
        name: 'portfolio-store',
        partialize: (state) => ({
          favoritePortfolios: state.favoritePortfolios,
          filters: state.filters,
          selectedPortfolio: state.selectedPortfolio,
          comparisonPortfolios: state.comparisonPortfolios,
        }),
      }
    ),
    {
      name: 'portfolio-store',
    }
  )
)

// Selectors for commonly used state
export const usePortfolios = () => usePortfolioStore((state) => state.portfolios)
export const useSelectedPortfolio = () => usePortfolioStore((state) => state.selectedPortfolio)
export const usePortfolioForm = () => usePortfolioStore((state) => state.portfolioForm)
export const useEditingPortfolio = () => usePortfolioStore((state) => state.editingPortfolio)
export const useFavoritePortfolios = () => usePortfolioStore((state) => state.getFavoritePortfolios())
export const useFilteredPortfolios = () => usePortfolioStore((state) => state.getFilteredPortfolios())
export const usePortfolioFilters = () => usePortfolioStore((state) => state.filters)
export const usePortfolioOptimization = () => usePortfolioStore((state) => state.optimization)
export const useComparisonPortfolios = () => usePortfolioStore((state) => state.comparisonPortfolios)
export const useIsPortfolioLoading = () => usePortfolioStore((state) => state.isLoading)
export const useIsPortfolioSaving = () => usePortfolioStore((state) => state.isSaving)
export const useIsPortfolioDirty = () => usePortfolioStore((state) => state.isDirty)
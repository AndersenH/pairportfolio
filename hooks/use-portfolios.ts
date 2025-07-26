import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PortfolioWithHoldings, ApiResponse, PaginatedResponse } from '@/types'
import type { PortfolioInput } from '@/lib/validations'

const API_BASE = '/api/portfolios'

export function usePortfolios(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['portfolios', page, limit],
    queryFn: async (): Promise<PaginatedResponse<PortfolioWithHoldings>> => {
      const response = await fetch(`${API_BASE}?page=${page}&limit=${limit}`)
      if (!response.ok) {
        throw new Error('Failed to fetch portfolios')
      }
      return response.json()
    },
  })
}

export function usePortfolio(id: string) {
  return useQuery({
    queryKey: ['portfolio', id],
    queryFn: async (): Promise<PortfolioWithHoldings> => {
      const response = await fetch(`${API_BASE}/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch portfolio')
      }
      const result: ApiResponse<PortfolioWithHoldings> = await response.json()
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch portfolio')
      }
      return result.data
    },
    enabled: !!id,
  })
}

export function useCreatePortfolio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: PortfolioInput): Promise<PortfolioWithHoldings> => {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to create portfolio')
      }

      const result: ApiResponse<PortfolioWithHoldings> = await response.json()
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create portfolio')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
    },
  })
}

export function useUpdatePortfolio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: PortfolioInput
    }): Promise<PortfolioWithHoldings> => {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to update portfolio')
      }

      const result: ApiResponse<PortfolioWithHoldings> = await response.json()
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to update portfolio')
      }
      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio', data.id] })
    },
  })
}

export function useDeletePortfolio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete portfolio')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
    },
  })
}
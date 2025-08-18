import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PortfolioWithHoldings, ApiResponse, PaginatedResponse } from '@/types'
import type { PortfolioInput } from '@/lib/validations'

const API_BASE = '/api/portfolios'

export function usePortfolios(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['portfolios', page, limit],
    queryFn: async (): Promise<PaginatedResponse<PortfolioWithHoldings>> => {
      const response = await fetch(`${API_BASE}?page=${page}&limit=${limit}`, {
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Fetching portfolios:', { 
        status: response.status, 
        ok: response.ok,
        url: response.url 
      })
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('Portfolio fetch failed:', errorText)
        throw new Error(`Failed to fetch portfolios: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Portfolio fetch successful:', data)
      return data
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
      console.log('Creating portfolio via mutation:', data)
      
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(data),
      })

      console.log('Create portfolio response:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('Create portfolio failed:', errorText)
        throw new Error(`Failed to create portfolio: ${response.status} ${response.statusText}`)
      }

      const result: ApiResponse<PortfolioWithHoldings> = await response.json()
      console.log('Create portfolio result:', result)
      
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
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('Delete portfolio failed:', errorText)
        throw new Error(`Failed to delete portfolio: ${response.status} ${response.statusText}`)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
    },
  })
}
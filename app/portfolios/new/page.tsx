'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { PortfolioForm } from '@/components/portfolio/portfolio-form'
import { useCreatePortfolio } from '@/hooks/use-portfolios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewPortfolioPage() {
  const router = useRouter()
  const createPortfolioMutation = useCreatePortfolio()
  const [isSavingDraft, setIsSavingDraft] = React.useState(false)

  const handleSubmit = async (data: {
    name: string
    description?: string
    isPublic: boolean
    benchmarkSymbol?: string | null
    holdings: { symbol: string; name?: string; type?: string; allocation: number }[]
  }) => {
    try {
      // Prepare data to match API schema
      const apiData = {
        name: data.name,
        description: data.description,
        isPublic: data.isPublic,
        benchmarkSymbol: data.benchmarkSymbol,
        initialCapital: 10000, // Default initial capital
        holdings: data.holdings
          .filter(h => h.symbol && h.symbol.trim()) // Only include filled holdings
          .map(h => ({
            symbol: h.symbol.trim().toUpperCase(),
            allocation: h.allocation
          }))
      }

      console.log('Creating portfolio with data:', apiData) // Debug log

      // Use React Query mutation - this will automatically invalidate the cache
      const result = await createPortfolioMutation.mutateAsync(apiData)
      console.log('Portfolio created successfully:', result)
      
      // Small delay to ensure cache invalidation completes
      setTimeout(() => {
        console.log('Redirecting to dashboard...')
        router.push('/dashboard')
      }, 500)
    } catch (error) {
      console.error('Error creating portfolio:', error)
      alert(`Error creating portfolio: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleSaveDraft = async (data: {
    name: string
    description?: string
    isPublic: boolean
    benchmarkSymbol?: string | null
    holdings: { symbol: string; name?: string; type?: string; allocation: number }[]
  }) => {
    try {
      setIsSavingDraft(true)
      
      // Prepare draft data - more lenient validation
      const draftData = {
        name: data.name + ' (Draft)',
        description: data.description ? data.description + ' [Draft]' : 'Portfolio draft - work in progress',
        isPublic: false, // Always save drafts as private
        benchmarkSymbol: data.benchmarkSymbol,
        initialCapital: 10000,
        holdings: data.holdings
          .filter(h => h.symbol && h.symbol.trim()) // Only include filled holdings
          .map(h => ({
            symbol: h.symbol.trim().toUpperCase(),
            allocation: h.allocation || 0 // Allow 0 allocation for drafts
          }))
      }

      console.log('Saving portfolio draft with data:', draftData)

      const result = await createPortfolioMutation.mutateAsync(draftData)
      console.log('Portfolio draft saved successfully:', result)
      
      // Show success message
      alert('Portfolio draft saved! You can continue editing it later.')
      
    } catch (error) {
      console.error('Error saving portfolio draft:', error)
      alert(`Error saving draft: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSavingDraft(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create New Portfolio</h1>
            <p className="text-muted-foreground">
              Build a custom ETF portfolio and analyze its performance
            </p>
          </div>
        </div>

        {/* Portfolio Form */}
        <Card>
          <CardContent className="p-6">
            <PortfolioForm 
              onSubmit={handleSubmit}
              onSaveDraft={handleSaveDraft}
              onCancel={() => router.push('/dashboard')}
              isLoading={createPortfolioMutation.isPending}
              isSavingDraft={isSavingDraft}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
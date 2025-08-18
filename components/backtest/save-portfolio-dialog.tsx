'use client'

import * as React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, AlertCircle, CheckCircle } from 'lucide-react'

interface SavePortfolioDialogProps {
  backtestId: string
  backtestName: string
  children: React.ReactNode
  onSuccess?: (portfolioId: string) => void
}

interface SaveResponse {
  success: boolean
  data?: {
    portfolio: {
      id: string
      name: string
    }
    backtest?: {
      id: string
      name: string
    }
  }
  error?: {
    code: string
    message: string
  }
}

export function SavePortfolioDialog({ 
  backtestId, 
  backtestName, 
  children, 
  onSuccess 
}: SavePortfolioDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Form state
  const [name, setName] = useState(`${backtestName} Portfolio`)
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [updateEndDateToToday, setUpdateEndDateToToday] = useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/backtests/${backtestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          isPublic,
          updateEndDateToToday,
        }),
      })

      const result: SaveResponse = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to save portfolio')
      }

      if (result.success && result.data) {
        setSuccess(
          `Portfolio "${result.data.portfolio.name}" saved successfully!${
            result.data.backtest 
              ? ` A new backtest "${result.data.backtest.name}" was also created with updated dates.`
              : ''
          }`
        )
        
        // Call success callback if provided
        if (onSuccess) {
          onSuccess(result.data.portfolio.id)
        }

        // Close dialog after a brief delay to show success message
        setTimeout(() => {
          setOpen(false)
          resetForm()
        }, 2000)
      } else {
        throw new Error('Invalid response format')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setName(`${backtestName} Portfolio`)
    setDescription('')
    setIsPublic(false)
    setUpdateEndDateToToday(true)
    setError(null)
    setSuccess(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      resetForm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save Portfolio
          </DialogTitle>
          <DialogDescription>
            Save this backtest as a new portfolio that you can reuse for future backtests.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="default" className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Portfolio Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter portfolio name"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter portfolio description"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic((e.target as HTMLInputElement).checked)}
                disabled={isLoading}
              />
              <Label htmlFor="isPublic" className="text-sm">
                Make this portfolio public
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="updateEndDate"
                checked={updateEndDateToToday}
                onChange={(e) => setUpdateEndDateToToday((e.target as HTMLInputElement).checked)}
                disabled={isLoading}
              />
              <Label htmlFor="updateEndDate" className="text-sm">
                Update end date to today for future backtests
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Portfolio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
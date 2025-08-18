'use client'

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useState, useEffect } from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

// Mobile responsive hook
interface MobileResponsiveConfig {
  breakpoints?: {
    mobile?: number
    tablet?: number
  }
}

interface MobileResponsiveResult {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  width: number
  height: number
  isTouch: boolean
}

const DEFAULT_BREAKPOINTS = {
  mobile: 640,   // Tailwind's sm breakpoint
  tablet: 1024,  // Tailwind's lg breakpoint
}

export function useMobileResponsive(config?: MobileResponsiveConfig): MobileResponsiveResult {
  const breakpoints = {
    ...DEFAULT_BREAKPOINTS,
    ...config?.breakpoints,
  }

  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  })

  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    // Check for touch capability
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (navigator as any).msMaxTouchPoints > 0
      )
    }

    // Handle resize
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    // Initial checks
    checkTouch()
    handleResize()

    // Add event listeners
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const isMobile = windowSize.width <= breakpoints.mobile
  const isTablet = windowSize.width > breakpoints.mobile && windowSize.width <= breakpoints.tablet
  const isDesktop = windowSize.width > breakpoints.tablet

  return {
    isMobile,
    isTablet,
    isDesktop,
    width: windowSize.width,
    height: windowSize.height,
    isTouch,
  }
}
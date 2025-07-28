'use client'

import { useState, useEffect } from 'react'

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
  orientation: 'portrait' | 'landscape' | 'square'
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

    // Handle resize with debouncing
    let timeoutId: NodeJS.Timeout
    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      }, 100) // 100ms debounce
    }

    // Initial checks
    checkTouch()
    
    // Set initial size
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    })

    // Add event listeners
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      clearTimeout(timeoutId)
    }
  }, [])

  const isMobile = windowSize.width <= breakpoints.mobile
  const isTablet = windowSize.width > breakpoints.mobile && windowSize.width <= breakpoints.tablet
  const isDesktop = windowSize.width > breakpoints.tablet

  // Determine orientation
  const orientation: 'portrait' | 'landscape' | 'square' = 
    windowSize.height > windowSize.width ? 'portrait' :
    windowSize.width > windowSize.height ? 'landscape' : 'square'

  return {
    isMobile,
    isTablet,
    isDesktop,
    width: windowSize.width,
    height: windowSize.height,
    isTouch,
    orientation,
  }
}
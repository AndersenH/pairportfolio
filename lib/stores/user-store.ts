import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { User } from '@prisma/client'

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: 'en' | 'is'
  currency: 'USD' | 'EUR' | 'ISK'
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  timezone: string
  notifications: {
    email: boolean
    push: boolean
    backtestComplete: boolean
    portfolioUpdates: boolean
    marketAlerts: boolean
  }
  dashboard: {
    defaultTimeRange: '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | 'MAX'
    defaultChartType: 'line' | 'candlestick' | 'area'
    showBenchmark: boolean
    autoRefresh: boolean
    refreshInterval: number // in seconds
  }
}

export interface UserSession {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  isAuthenticated: boolean
  lastActivity?: number
}

interface UserState {
  // User data
  user: User | null
  preferences: UserPreferences
  session: UserSession
  
  // Loading states
  isLoading: boolean
  isUpdatingPreferences: boolean
  
  // Actions
  setUser: (user: User | null) => void
  updateUser: (userData: Partial<User>) => void
  setSession: (session: UserSession) => void
  updatePreferences: (preferences: Partial<UserPreferences>) => void
  resetPreferences: () => void
  logout: () => void
  setLoading: (loading: boolean) => void
  setUpdatingPreferences: (updating: boolean) => void
  
  // Session management
  refreshSession: () => Promise<boolean>
  isSessionValid: () => boolean
  extendSession: () => void
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'en',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  notifications: {
    email: true,
    push: false,
    backtestComplete: true,
    portfolioUpdates: true,
    marketAlerts: false,
  },
  dashboard: {
    defaultTimeRange: '1Y',
    defaultChartType: 'line',
    showBenchmark: true,
    autoRefresh: false,
    refreshInterval: 30,
  },
}

const defaultSession: UserSession = {
  isAuthenticated: false,
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        preferences: defaultPreferences,
        session: defaultSession,
        isLoading: false,
        isUpdatingPreferences: false,

        // Actions
        setUser: (user) => {
          set({ user })
          if (user) {
            // Update last activity when setting user
            set((state) => ({
              session: {
                ...state.session,
                lastActivity: Date.now(),
              },
            }))
          }
        },

        updateUser: (userData) =>
          set((state) => ({
            user: state.user ? { ...state.user, ...userData } : null,
          })),

        setSession: (session) => set({ session }),

        updatePreferences: (newPreferences) =>
          set((state) => ({
            preferences: {
              ...state.preferences,
              ...newPreferences,
            },
          })),

        resetPreferences: () => set({ preferences: defaultPreferences }),

        logout: () =>
          set({
            user: null,
            session: defaultSession,
          }),

        setLoading: (loading) => set({ isLoading: loading }),

        setUpdatingPreferences: (updating) => set({ isUpdatingPreferences: updating }),

        // Session management
        refreshSession: async () => {
          const { session } = get()
          if (!session.refreshToken) return false

          try {
            // This would typically make an API call to refresh the token
            // For now, we'll simulate a successful refresh
            const response = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refreshToken: session.refreshToken }),
            })

            if (response.ok) {
              const data = await response.json()
              set((state) => ({
                session: {
                  ...state.session,
                  accessToken: data.accessToken,
                  expiresAt: data.expiresAt,
                  lastActivity: Date.now(),
                },
              }))
              return true
            }
            return false
          } catch (error) {
            console.error('Failed to refresh session:', error)
            return false
          }
        },

        isSessionValid: () => {
          const { session } = get()
          if (!session.isAuthenticated || !session.expiresAt) return false
          return Date.now() < session.expiresAt
        },

        extendSession: () => {
          set((state) => ({
            session: {
              ...state.session,
              lastActivity: Date.now(),
            },
          }))
        },
      }),
      {
        name: 'user-store',
        partialize: (state) => ({
          user: state.user,
          preferences: state.preferences,
          session: {
            refreshToken: state.session.refreshToken,
            isAuthenticated: state.session.isAuthenticated,
          }, // Don't persist access token or sensitive data
        }),
      }
    ),
    {
      name: 'user-store',
    }
  )
)

// Selectors for commonly used state
export const useUser = () => useUserStore((state) => state.user)
export const useUserPreferences = () => useUserStore((state) => state.preferences)
export const useUserSession = () => useUserStore((state) => state.session)
export const useIsAuthenticated = () => useUserStore((state) => state.session.isAuthenticated)
export const useUserTheme = () => useUserStore((state) => state.preferences.theme)
export const useUserCurrency = () => useUserStore((state) => state.preferences.currency)
export const useUserLanguage = () => useUserStore((state) => state.preferences.language)
export const useDashboardPreferences = () => useUserStore((state) => state.preferences.dashboard)
export const useNotificationPreferences = () => useUserStore((state) => state.preferences.notifications)

// Computed selectors
export const useEffectiveTheme = () => {
  const theme = useUserTheme()
  if (theme === 'system') {
    // In a real app, you'd check system preference
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme
}
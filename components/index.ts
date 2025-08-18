// UI Components
export { Button, buttonVariants } from './ui/button'
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card'
export { Input } from './ui/input'
export { Badge, badgeVariants } from './ui/badge'
export { Avatar, AvatarImage, AvatarFallback } from './ui/avatar'
export { Skeleton } from './ui/skeleton'
export { ErrorBoundary, useErrorBoundary } from './ui/error-boundary'

// Layout Components
export { Header } from './layout/header'
export { Sidebar } from './layout/sidebar'
export { AppLayout } from './layout/app-layout'

// Portfolio Components
export { PortfolioCard } from './portfolio/portfolio-card'
export { 
  PortfolioForm, 
  BacktestConfigurationForm,
  mockPortfoliosForBacktest,
  mockBacktestResults 
} from './portfolio/portfolio-form'

// Performance Components
export { MetricsDisplay } from './performance/metrics-display'

// Market Monitor Component
export { MarketMonitor } from './market-monitor'

// Chart Components
export { PerformanceChart } from './charts/performance-chart'
export { AllocationChart } from './charts/allocation-chart'

// Backtest Components (will be created)
// export { BacktestForm } from './backtest/backtest-form'
// export { StrategyParameterForm } from './backtest/strategy-parameter-form'
// export { PortfolioSelector } from './backtest/portfolio-selector'
// export { BacktestResults } from './backtest/backtest-results'
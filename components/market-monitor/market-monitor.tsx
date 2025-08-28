'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { RefreshCw, ChevronUp, ChevronDown, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/client-utils';
import { useRouter } from 'next/navigation';

// TypeScript interfaces
interface PortfolioHolding {
  symbol: string;
  allocation: number;
  name: string;
}

interface LazyPortfolio {
  id: string;
  name: string;
  description: string;
  holdings: PortfolioHolding[];
  meta?: {
    category: string;
    riskLevel: 'conservative' | 'moderate' | 'aggressive';
    creator: string;
    totalHoldings: number;
  };
}

interface PortfolioPerformance {
  id: string;
  name: string;
  ytd: number;
  oneYear: number;
  threeYear: number;
}

type SortField = 'name' | 'ytd' | 'oneYear' | 'threeYear';
type SortDirection = 'asc' | 'desc';

// Component props interface
interface MarketMonitorProps {
  onPortfolioClick?: (portfolioName: string) => void;
}

// Static performance data - in a real app, this would come from the API
const performanceData: Record<string, { ytd: number; oneYear: number; threeYear: number }> = {
  'Marc Faber Portfolio': { ytd: 12.31, oneYear: 13.46, threeYear: 10.02 },
  'Harry Browne Permanent Portfolio': { ytd: 10.15, oneYear: 12.45, threeYear: 9.66 },
  'Rick Ferri Core Four': { ytd: 11.27, oneYear: 12.02, threeYear: 11.27 },
  'Stocks/Bonds 60/40': { ytd: 7.73, oneYear: 10.83, threeYear: 10.60 },
  'Bill Bernstein No Brainer': { ytd: 9.82, oneYear: 10.14, threeYear: 10.49 },
  'Scott Burns Couch Potato': { ytd: 7.62, oneYear: 9.89, threeYear: 8.62 },
  'David Swensen Lazy Portfolio': { ytd: 8.91, oneYear: 8.89, threeYear: 8.13 },
  'Mebane Faber Ivy Portfolio': { ytd: 8.25, oneYear: 8.47, threeYear: 6.25 },
  'David Swensen Yale Endowment': { ytd: 8.60, oneYear: 7.64, threeYear: 6.69 },
  'Ray Dalio All Seasons': { ytd: 6.35, oneYear: 6.49, threeYear: 4.25 },
};

export function MarketMonitor({ onPortfolioClick }: MarketMonitorProps = {}) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('ytd');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolios, setPortfolios] = useState<LazyPortfolio[]>([]);

  // Fetch lazy portfolios from API
  const fetchPortfolios = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/lazy-portfolios?limit=10');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch portfolios: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success && data.data) {
        setPortfolios(data.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching portfolios:', err);
      setError(err instanceof Error ? err.message : 'Failed to load portfolios');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch portfolios on mount
  useEffect(() => {
    fetchPortfolios();
  }, []);

  // Combine portfolio data with performance metrics
  const portfolioData = useMemo(() => {
    return portfolios.map(portfolio => {
      const perf = performanceData[portfolio.name] || { ytd: 0, oneYear: 0, threeYear: 0 };
      return {
        id: portfolio.id,
        name: portfolio.name,
        ytd: perf.ytd,
        oneYear: perf.oneYear,
        threeYear: perf.threeYear,
        portfolio: portfolio
      };
    });
  }, [portfolios]);

  // Sort data based on current sort configuration
  const sortedData = useMemo(() => {
    return [...portfolioData].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (sortField === 'name') {
        return sortDirection === 'asc' 
          ? aValue.toString().localeCompare(bValue.toString())
          : bValue.toString().localeCompare(aValue.toString());
      }

      const diff = Number(aValue) - Number(bValue);
      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [portfolioData, sortField, sortDirection]);

  // Handle column sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPortfolios();
    setIsRefreshing(false);
  };

  // Handle portfolio row click
  const handlePortfolioRowClick = async (portfolio: LazyPortfolio) => {
    if (onPortfolioClick) {
      // Use the callback if provided
      onPortfolioClick(portfolio.name);
      return;
    }

    // Navigate to portfolio builder first
    const params = new URLSearchParams({
      preset: portfolio.id,
      portfolioName: portfolio.name,
    });
    router.push(`/portfolio-builder?${params.toString()}`);

    // Trigger backtest immediately
    try {
      // Calculate default dates: 5-year window ending today
      const today = new Date();
      const fiveYearsAgo = new Date(today);
      fiveYearsAgo.setFullYear(today.getFullYear() - 5);
      
      const backtestData = {
        name: portfolio.name,
        holdings: portfolio.holdings.map(holding => ({
          symbol: holding.symbol,
          allocation: holding.allocation / 100,
        })),
        startDate: fiveYearsAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
        initialCapital: 10000,
        strategy: 'buy-hold',
        benchmarkSymbol: null,
      };

      // Try demo-backtest first, then fallback to simple-backtest
      let response = await fetch('/api/demo-backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backtestData),
      });

      if (!response.ok) {
        response = await fetch('/api/simple-backtest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backtestData),
        });
      }

      if (response.ok) {
        const result = await response.json();
        console.log('Backtest completed for', portfolio.name, result);
        
        // Store the result in sessionStorage so Portfolio Builder can access it
        sessionStorage.setItem('pendingBacktestResult', JSON.stringify(result.data));
        console.log('Stored backtest result in sessionStorage for', portfolio.name);
      } else {
        console.error('Backtest failed for', portfolio.name);
      }
    } catch (error) {
      console.error('Error running backtest:', error);
    }
  };

  // Format percentage value
  const formatPercentage = (value: number) => {
    const formatted = value.toFixed(2);
    return `${value >= 0 ? '+' : ''}${formatted}%`;
  };

  // Get color class for returns
  const getReturnColorClass = (value: number) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600';
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <span className="inline-flex ml-1 text-gray-400">
          <ChevronUp className="h-3 w-3 -mb-1" />
          <ChevronDown className="h-3 w-3 -mt-1" />
        </span>
      );
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="inline ml-1 h-4 w-4" />
    ) : (
      <ChevronDown className="inline ml-1 h-4 w-4" />
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-2xl font-bold">
            Market Monitor - Top 10 Lazy Portfolios
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Click any portfolio to view its detailed statistics and backtest results
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : 'Last updated: Today'}
          </span>
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw 
              className={cn(
                "h-4 w-4 text-gray-600",
                (isRefreshing || isLoading) && "animate-spin"
              )} 
            />
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {error && (
          <Alert variant="destructive" className="mx-4 mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-gray-50 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Portfolio
                      <SortIcon field="name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer select-none hover:bg-gray-50 transition-colors"
                    onClick={() => handleSort('ytd')}
                  >
                    <div className="flex items-center justify-end">
                      YTD
                      <SortIcon field="ytd" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer select-none hover:bg-gray-50 transition-colors"
                    onClick={() => handleSort('oneYear')}
                  >
                    <div className="flex items-center justify-end">
                      1Y
                      <SortIcon field="oneYear" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer select-none hover:bg-gray-50 transition-colors"
                    onClick={() => handleSort('threeYear')}
                  >
                    <div className="flex items-center justify-end">
                      3Y
                      <SortIcon field="threeYear" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((item) => (
                  <TableRow 
                    key={item.id}
                    className={cn(
                      "transition-all duration-200",
                      "hover:bg-blue-50 hover:shadow-sm",
                      "cursor-pointer group"
                    )}
                    onClick={() => handlePortfolioRowClick(item.portfolio)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center justify-between">
                        <span>{item.name}</span>
                        <ExternalLink className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold", getReturnColorClass(item.ytd))}>
                      {formatPercentage(item.ytd)}
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold", getReturnColorClass(item.oneYear))}>
                      {formatPercentage(item.oneYear)}
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold", getReturnColorClass(item.threeYear))}>
                      {formatPercentage(item.threeYear)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Export default for lazy loading
export default MarketMonitor;
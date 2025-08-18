'use client'

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AssetPerformanceTable } from './asset-performance-table';
import { AlertTriangle, Database } from 'lucide-react';
import type { BacktestResults } from '@/lib/types';

export function AssetPerformanceDemo() {
  const [realResults, setRealResults] = React.useState<BacktestResults | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const runRealBacktest = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Run a real backtest with actual market data
      const response = await fetch('/api/demo-backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategy: 'buy-hold',
          assets: [
            { symbol: 'VTI', allocation: 0.6 },
            { symbol: 'BND', allocation: 0.3 },
            { symbol: 'GLD', allocation: 0.1 }
          ],
          startDate: '2022-01-01',
          endDate: '2023-12-31',
          initialCapital: 10000
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to run backtest: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setRealResults(data.results);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load real market data';
      setError(errorMessage);
      console.error('Real data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const portfolioAllocation = {
    'VTI': 0.6,
    'BND': 0.3,
    'GLD': 0.1
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-blue-500" />
            <span>Asset Performance Table - Real Data Only</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-start space-x-3">
                <Database className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900">Real Market Data Only</h4>
                  <p className="text-sm text-green-700 mt-1">
                    This component now uses exclusively real market data from Financial Modeling Prep API.
                    No simulated or mock data is ever used.
                  </p>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={runRealBacktest}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Loading Real Market Data...' : 'Run Real Backtest Analysis'}
            </Button>

            {error && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900">Error Loading Real Data</h4>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                    <p className="text-xs text-red-600 mt-2">
                      This component will not fall back to mock data. Please ensure API connectivity.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {realResults && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Portfolio Return</div>
                    <div className="text-lg font-bold">
                      {(realResults.metrics.totalReturn * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Volatility</div>
                    <div className="text-lg font-bold">
                      {(realResults.metrics.volatility * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Sharpe Ratio</div>
                    <div className="text-lg font-bold">
                      {realResults.metrics.sharpeRatio.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>Real Data Information:</p>
                  <p>• Portfolio Values: {realResults.portfolioValues.length} data points</p>
                  <p>• Returns: {realResults.returns.length} data points</p>
                  <p>• Assets: {Object.keys(realResults.weights).join(', ')}</p>
                  <p>• Date Range: {realResults.dates[0]} to {realResults.dates[realResults.dates.length - 1]}</p>
                  <p>• Data Source: Financial Modeling Prep API</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {realResults && (
        <AssetPerformanceTable
          results={realResults}
          portfolioAllocation={portfolioAllocation}
        />
      )}
    </div>
  );
}
'use client'

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AssetPerformanceTablePython } from './asset-performance-table-python';
import { Zap, Database, TrendingUp, AlertTriangle } from 'lucide-react';
import type { BacktestResults } from '@/lib/types';

export function PythonAssetDemo() {
  const [realResults, setRealResults] = React.useState<BacktestResults | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const runPythonBacktest = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Run a real backtest using Python calculations with actual market data
      const response = await fetch('/api/demo-backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategy: 'momentum', // Use momentum strategy for dynamic rebalancing
          assets: [
            { symbol: 'VTI', allocation: 0.6 },
            { symbol: 'BND', allocation: 0.3 },
            { symbol: 'GLD', allocation: 0.1 }
          ],
          startDate: '2022-01-01',
          endDate: '2024-01-01',
          initialCapital: 10000,
          rebalanceFrequency: 'monthly',
          lookbackPeriod: 60
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to run Python backtest: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setRealResults(data.results);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load real market data for Python analysis';
      setError(errorMessage);
      console.error('Python backtest error:', err);
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
            <Zap className="h-5 w-5 text-yellow-500" />
            <span>Python-Powered Asset Performance</span>
            <Badge variant="secondary" className="flex items-center space-x-1">
              <Database className="h-3 w-3" />
              <span>Real Data + NumPy</span>
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Advanced Statistical Analysis - Real Data Only</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Python-based statistical calculations using NumPy and Pandas with exclusively real market data.
                    Features dynamic rebalancing and momentum-based strategy with actual price data from Financial Modeling Prep API.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-start space-x-3">
                <Database className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900">No Mock Data Policy</h4>
                  <p className="text-sm text-green-700 mt-1">
                    This component has been updated to never use simulated data. All calculations are performed
                    on real historical market data only.
                  </p>
                </div>
              </div>
            </div>

            {realResults && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">Portfolio Return</div>
                  <div className="text-lg font-bold text-green-700">
                    {(realResults.metrics.totalReturn * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-green-600">Real data period</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">Annualized Return</div>
                  <div className="text-lg font-bold text-blue-700">
                    {(realResults.metrics.annualizedReturn * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-blue-600">CAGR from real data</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-sm text-purple-600 font-medium">Sharpe Ratio</div>
                  <div className="text-lg font-bold text-purple-700">
                    {realResults.metrics.sharpeRatio.toFixed(2)}
                  </div>
                  <div className="text-xs text-purple-600">Risk-adjusted</div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <strong>Features:</strong> Dynamic rebalancing, momentum strategy, real market data only
              </div>
              <Button 
                onClick={runPythonBacktest}
                disabled={loading}
                variant="default"
              >
                {loading ? 'Running Python Analysis...' : 'Run Python Analysis'}
              </Button>
            </div>

            {error && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900">Error Loading Real Data</h4>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                    <p className="text-xs text-red-600 mt-2">
                      This component will not fall back to mock data. Please ensure API connectivity and try again.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {realResults && (
              <div className="text-xs text-gray-500 space-y-1">
                <p>Real Data Information:</p>
                <p>• Data Points: {realResults.returns.length} trading days</p>
                <p>• Assets: {Object.keys(realResults.weights).join(', ')}</p>
                <p>• Period: {realResults.dates[0]} to {realResults.dates[realResults.dates.length - 1]}</p>
                <p>• Calculation Method: Python NumPy + Real Market Data</p>
                <p>• Data Source: Financial Modeling Prep API</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {realResults && (
        <AssetPerformanceTablePython
          results={realResults}
          portfolioAllocation={portfolioAllocation}
          usePython={true}
        />
      )}
    </div>
  );
}
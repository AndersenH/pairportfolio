'use client';

import React, { useState } from 'react';
import { usePythonBacktest } from '@/lib/python-api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BacktestResultsDisplay } from './performance/backtest-results-display';

export function PythonBacktestDemo() {
  const { runBacktest, loading, error, result } = usePythonBacktest();
  const [useApi, setUseApi] = useState(false);

  const runSimpleBacktest = async () => {
    if (useApi) {
      // Use Python API server
      await runBacktest({
        strategy: 'buy_hold',
        holdings: [
          { symbol: 'SPY', allocation: 0.6 },
          { symbol: 'BND', allocation: 0.4 },
        ],
        start_date: '2022-01-01',
        end_date: '2023-12-31',
        initial_capital: 10000,
      });
    } else {
      // Use child process
      const response = await fetch('/api/python-backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: 'buy_hold',
          holdings: [
            { symbol: 'SPY', allocation: 0.6 },
            { symbol: 'BND', allocation: 0.4 },
          ],
          start_date: '2022-01-01',
          end_date: '2023-12-31',
        }),
      });
      const data = await response.json();
      console.log('Python backtest result:', data);
    }
  };

  const runMomentumBacktest = async () => {
    await runBacktest({
      strategy: 'momentum',
      holdings: [
        { symbol: 'SPY', allocation: 0.2 },
        { symbol: 'QQQ', allocation: 0.2 },
        { symbol: 'IWM', allocation: 0.2 },
        { symbol: 'EFA', allocation: 0.2 },
        { symbol: 'EEM', allocation: 0.2 },
      ],
      start_date: '2021-01-01',
      end_date: '2023-12-31',
      initial_capital: 100000,
      parameters: {
        lookback_period: 60,
        top_n: 3,
        rebalance_frequency: 'monthly',
      },
    });
  };

  const formatChartData = () => {
    if (!result?.portfolio_values || !result?.dates) return [];
    
    return result.dates.map((date: string, i: number) => ({
      date: date.substring(0, 10),
      value: result.portfolio_values[i],
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Python Backtest Engine Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={useApi}
                onChange={(e) => setUseApi(e.target.checked)}
                className="rounded"
              />
              <span>Use Python API Server (requires setup)</span>
            </label>
          </div>

          <div className="flex space-x-4">
            <Button onClick={runSimpleBacktest} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run Simple Backtest
            </Button>
            
            <Button onClick={runMomentumBacktest} disabled={loading} variant="outline">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run Momentum Strategy
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <BacktestResultsDisplay
              results={{
                portfolioValues: result.portfolio_values || [],
                returns: result.returns || [],
                dates: result.dates || [],
                weights: result.weights || {},
                metrics: {
                  totalReturn: result.metrics?.total_return || 0,
                  annualizedReturn: result.metrics?.annualized_return || 0,
                  volatility: result.metrics?.volatility || 0,
                  sharpeRatio: result.metrics?.sharpe_ratio || 0,
                  maxDrawdown: result.metrics?.max_drawdown || 0,
                  maxDrawdownDuration: result.metrics?.max_drawdown_duration || 0,
                  sortinoRatio: result.metrics?.sortino_ratio || 0,
                  calmarRatio: result.metrics?.calmar_ratio || 0,
                  var95: result.metrics?.var_95 || 0,
                  cvar95: result.metrics?.cvar_95 || 0,
                  winRate: result.metrics?.win_rate || 0,
                  profitFactor: result.metrics?.profit_factor || 0,
                },
                drawdown: result.drawdown || [],
                assetPrices: result.asset_prices || null
              }}
              portfolioAllocation={{
                'SPY': 0.6,
                'BND': 0.4,
                ...Object.fromEntries(
                  (result.holdings || []).map((h: any) => [h.symbol, h.allocation])
                )
              }}
              preCalculatedAssetPerformance={result.asset_performance || []} // Pass pre-calculated asset performance
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
{`# 1. Install Python dependencies
cd python
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
pip install -r requirements.txt

# 2. For API Server (optional):
# Install and start Redis
brew install redis  # macOS
redis-server

# Start Python API
python api_server.py

# 3. Test the setup
# Direct script test:
echo '{"strategy":"buy_hold","holdings":[{"symbol":"SPY","allocation":1}],"start_date":"2023-01-01","end_date":"2023-12-31"}' | python3 backtest_runner.py`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
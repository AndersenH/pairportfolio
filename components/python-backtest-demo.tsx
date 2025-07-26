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
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">Total Return</div>
                  <div className="text-xl font-bold">
                    {((result.metrics?.total_return || 0) * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">Annual Return</div>
                  <div className="text-xl font-bold">
                    {((result.metrics?.annualized_return || 0) * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">Volatility</div>
                  <div className="text-xl font-bold">
                    {((result.metrics?.volatility || 0) * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">Sharpe Ratio</div>
                  <div className="text-xl font-bold">
                    {(result.metrics?.sharpe_ratio || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {result.portfolio_values && (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formatChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        domain={['dataMin * 0.95', 'dataMax * 1.05']}
                      />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#8884d8"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
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
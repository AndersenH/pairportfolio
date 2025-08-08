'use client'

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download,
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Cell
} from 'recharts';
import { AssetPerformanceTablePython } from './asset-performance-table-python';
import { MetricsDisplay } from './metrics-display';
import type { BacktestResults } from '@/lib/types';

interface BacktestResultsDisplayProps {
  results: BacktestResults;
  portfolioAllocation: Record<string, number>;
  className?: string;
  preCalculatedAssetPerformance?: any[]; // Pre-calculated asset performance data
  benchmarkSymbol?: string; // Benchmark symbol for display
}

interface ChartDataPoint {
  date: string;
  value: number;
  drawdown: number;
  benchmark?: number;
}

const CHART_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', 
  '#ff00ff', '#00ffff', '#ff0000', '#0000ff', '#ffff00'
];

export function BacktestResultsDisplay({ 
  results, 
  portfolioAllocation, 
  className,
  preCalculatedAssetPerformance = [],
  benchmarkSymbol
}: BacktestResultsDisplayProps) {
  const [showBenchmark, setShowBenchmark] = React.useState(true);
  
  // Extract benchmark symbol from results or use prop, defaulting to 'SPY'
  const actualBenchmarkSymbol = results.benchmarkComparison?.benchmarkSymbol || benchmarkSymbol || 'SPY';
  
  // Check if we have valid benchmark data
  const hasBenchmarkData = !!(results.benchmarkComparison && 
    typeof results.benchmarkComparison.benchmarkReturn === 'number' &&
    !isNaN(results.benchmarkComparison.benchmarkReturn));
  
  // Format chart data
  const formatChartData = (): ChartDataPoint[] => {
    if (!results?.portfolioValues || !results?.dates || !results?.drawdown) return [];
    
    return results.dates.map((date: string, i: number) => ({
      date: date.substring(0, 10),
      value: results.portfolioValues[i],
      drawdown: results.drawdown[i] * 100, // Convert to percentage
      benchmark: results.benchmarkComparison ? 
        results.portfolioValues[0] * (1 + (results.benchmarkComparison.benchmarkReturn * (i / results.dates.length))) : 
        undefined
    }));
  };

  // Format allocation pie chart data
  const formatAllocationData = () => {
    return Object.entries(portfolioAllocation).map(([symbol, allocation], index) => ({
      name: symbol,
      value: allocation * 100,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  };

  // Format weight evolution data
  const formatWeightEvolutionData = () => {
    if (!results?.weights || !results?.dates) return [];
    
    const symbols = Object.keys(results.weights);
    return results.dates.map((date: string, i: number) => {
      const dataPoint: any = { date: date.substring(0, 10) };
      symbols.forEach(symbol => {
        dataPoint[symbol] = (results.weights[symbol][i] || 0) * 100;
      });
      return dataPoint;
    });
  };

  const chartData = formatChartData();
  const allocationData = formatAllocationData();
  const weightEvolutionData = formatWeightEvolutionData();
  const symbols = Object.keys(results.weights || {});

  const getTrendInfo = (value: number) => {
    if (value > 0) return { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' };
    if (value < 0) return { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' };
    return { icon: BarChart3, color: 'text-gray-600', bg: 'bg-gray-50' };
  };

  const downloadResults = () => {
    const data = {
      results,
      portfolioAllocation,
      generatedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest-results-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalReturnTrend = getTrendInfo(results.metrics?.totalReturn || 0);
  const TotalReturnIcon = totalReturnTrend.icon;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Portfolio Value</p>
                <p className="text-2xl font-bold">
                  ${(results.portfolioValues?.[results.portfolioValues.length - 1] || 0).toLocaleString()}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${totalReturnTrend.bg}`}>
                <TotalReturnIcon className={`h-5 w-5 ${totalReturnTrend.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Return</p>
                <p className={`text-2xl font-bold ${totalReturnTrend.color}`}>
                  {((results.metrics?.totalReturn || 0) * 100).toFixed(2)}%
                </p>
              </div>
              <Badge variant={results.metrics?.totalReturn >= 0 ? "default" : "destructive"}>
                {results.metrics?.totalReturn >= 0 ? "Gain" : "Loss"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sharpe Ratio</p>
                <p className="text-2xl font-bold">
                  {(results.metrics?.sharpeRatio || 0).toFixed(2)}
                </p>
              </div>
              <Badge variant={
                (results.metrics?.sharpeRatio || 0) > 1 ? "default" : 
                (results.metrics?.sharpeRatio || 0) > 0.5 ? "secondary" : "destructive"
              }>
                {(results.metrics?.sharpeRatio || 0) > 1 ? "Excellent" : 
                 (results.metrics?.sharpeRatio || 0) > 0.5 ? "Good" : "Poor"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Max Drawdown</p>
                <p className="text-2xl font-bold text-red-600">
                  {Math.abs((results.metrics?.maxDrawdown || 0) * 100).toFixed(2)}%
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadResults}
                  className="flex items-center space-x-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Benchmark Comparison Section - only show if benchmark data exists */}
      {hasBenchmarkData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Benchmark Comparison ({actualBenchmarkSymbol})</span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBenchmark(!showBenchmark)}
                className="flex items-center space-x-2"
              >
                {showBenchmark ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span>{showBenchmark ? 'Hide' : 'Show'} in Charts</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-sm font-medium text-gray-600 mb-1">Benchmark Return</div>
                <div className={`text-xl font-bold ${results.benchmarkComparison.benchmarkReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(results.benchmarkComparison.benchmarkReturn * 100).toFixed(2)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Total Period</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-sm font-medium text-gray-600 mb-1">Alpha</div>
                <div className={`text-xl font-bold ${results.benchmarkComparison.alpha >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(results.benchmarkComparison.alpha * 100).toFixed(2)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">vs {actualBenchmarkSymbol}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-sm font-medium text-gray-600 mb-1">Beta</div>
                <div className="text-xl font-bold text-gray-700">
                  {results.benchmarkComparison.beta.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Market Sensitivity</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-sm font-medium text-gray-600 mb-1">Correlation</div>
                <div className="text-xl font-bold text-gray-700">
                  {(results.benchmarkComparison.correlation * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Price Movement</div>
              </div>
            </div>
            
            {/* Additional benchmark metrics */}
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Benchmark Volatility:</span>
                  <span className="font-medium">{(results.benchmarkComparison.benchmarkVolatility * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Benchmark Sharpe:</span>
                  <span className="font-medium">{results.benchmarkComparison.benchmarkSharpe.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tracking Error:</span>
                  <span className="font-medium">{(results.benchmarkComparison.trackingError * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance" className="flex items-center space-x-2">
            <LineChartIcon className="h-4 w-4" />
            <span>Performance</span>
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Asset Analysis</span>
          </TabsTrigger>
          <TabsTrigger value="allocation" className="flex items-center space-x-2">
            <PieChart className="h-4 w-4" />
            <span>Allocation</span>
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Metrics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          {/* Portfolio Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Performance Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
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
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        name === 'value' ? `$${Number(value).toLocaleString()}` : value,
                        name === 'value' ? 'Portfolio Value' : name === 'benchmark' ? actualBenchmarkSymbol : name
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#8884d8"
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                    {hasBenchmarkData && showBenchmark && (
                      <Line
                        type="monotone"
                        dataKey="benchmark"
                        stroke="#ff7300"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        name={actualBenchmarkSymbol}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Drawdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Drawdown Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ff4444" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      domain={['dataMin', 0]}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Drawdown']}
                    />
                    <Area
                      type="monotone"
                      dataKey="drawdown"
                      stroke="#ff4444"
                      fillOpacity={1}
                      fill="url(#colorDrawdown)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <AssetPerformanceTablePython
            results={results}
            portfolioAllocation={portfolioAllocation}
            usePython={true}
            preCalculatedAssetPerformance={preCalculatedAssetPerformance}
            benchmarkSymbol={actualBenchmarkSymbol}
          />
        </TabsContent>

        <TabsContent value="allocation" className="space-y-6">
          {/* Target vs Actual Allocation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Target Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Tooltip 
                        formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Allocation']}
                      />
                      <RechartsPieChart data={allocationData}>
                        {allocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </RechartsPieChart>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weight Evolution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightEvolutionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        domain={[0, 100]}
                      />
                      <Tooltip />
                      {symbols.map((symbol, index) => (
                        <Line
                          key={symbol}
                          type="monotone"
                          dataKey={symbol}
                          stroke={CHART_COLORS[index % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="metrics">
          <MetricsDisplay 
            metrics={results.metrics}
            benchmarkSymbol={actualBenchmarkSymbol}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
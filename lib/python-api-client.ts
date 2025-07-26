/**
 * Client for interacting with Python Backtest API
 */

interface BacktestRequest {
  strategy: string;
  holdings: Array<{
    symbol: string;
    allocation: number;
  }>;
  start_date: string;
  end_date: string;
  initial_capital?: number;
  parameters?: Record<string, any>;
}

interface BacktestResponse {
  task_id: string;
  status: string;
  message: string;
}

interface BacktestResult {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export class PythonBacktestClient {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.PYTHON_API_URL || 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Create an async backtest task
   */
  async createBacktest(request: BacktestRequest): Promise<BacktestResponse> {
    const response = await fetch(`${this.baseUrl}/backtest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to create backtest: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get backtest result by task ID
   */
  async getBacktestResult(taskId: string): Promise<BacktestResult> {
    const response = await fetch(`${this.baseUrl}/backtest/${taskId}`);

    if (!response.ok) {
      throw new Error(`Failed to get backtest result: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Run backtest synchronously (for small backtests)
   */
  async runBacktestSync(request: BacktestRequest): Promise<any> {
    const response = await fetch(`${this.baseUrl}/backtest/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to run backtest: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Poll for backtest completion
   */
  async waitForBacktest(
    taskId: string, 
    options: { maxAttempts?: number; pollInterval?: number } = {}
  ): Promise<BacktestResult> {
    const { maxAttempts = 60, pollInterval = 1000 } = options;
    
    for (let i = 0; i < maxAttempts; i++) {
      const result = await this.getBacktestResult(taskId);
      
      if (result.status === 'completed' || result.status === 'failed') {
        return result;
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Backtest timed out');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const pythonClient = new PythonBacktestClient();

// React hook for backtesting
import { useState, useCallback } from 'react';

export function usePythonBacktest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const runBacktest = useCallback(async (request: BacktestRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      // For small backtests, use sync endpoint
      if (request.holdings.length <= 5) {
        const response = await pythonClient.runBacktestSync(request);
        setResult(response.data);
      } else {
        // For larger backtests, use async
        const { task_id } = await pythonClient.createBacktest(request);
        const backtestResult = await pythonClient.waitForBacktest(task_id);
        
        if (backtestResult.status === 'failed') {
          throw new Error(backtestResult.error || 'Backtest failed');
        }
        
        setResult(backtestResult.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backtest failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return { runBacktest, loading, error, result };
}
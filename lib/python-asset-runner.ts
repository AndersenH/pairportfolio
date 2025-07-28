import { spawn } from 'child_process';
import path from 'path';

interface AssetPerformanceInput {
  portfolioData: {
    portfolioValues: number[];
    returns: number[];
    weights: Record<string, number[]>;
    dates: string[];
  };
  portfolioAllocation: Record<string, number>;
  assetPriceData?: Record<string, number[]> | null;  // Optional real asset price data
}

interface AssetPerformanceMetrics {
  symbol: string;
  initialWeight: number;
  finalWeight: number;
  avgWeight: number;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  contribution: number;
  allocation: number;
}

interface AssetPerformanceResult {
  success: boolean;
  data?: AssetPerformanceMetrics[];
  error?: string;
  metadata?: {
    assetsProcessed: number;
    calculationMethod: string;
    usingRealData?: boolean;
  };
}

export class PythonAssetRunner {
  private pythonPath: string;
  private scriptPath: string;

  constructor() {
    this.pythonPath = 'python3'; // Use system python3
    this.scriptPath = path.join(process.cwd(), 'python', 'asset_performance_calculator.py');
  }

  /**
   * Calculate asset performance metrics using Python
   */
  async calculateAssetPerformance(input: AssetPerformanceInput): Promise<AssetPerformanceResult> {
    return new Promise((resolve, reject) => {
      try {
        // Validate input
        if (!input.portfolioData || !input.portfolioAllocation) {
          resolve({
            success: false,
            error: 'Missing required input data'
          });
          return;
        }

        const { portfolioValues, returns, weights, dates } = input.portfolioData;
        
        // Basic validation
        if (!portfolioValues?.length || !returns?.length || !weights || !Object.keys(weights).length) {
          resolve({
            success: false,
            error: 'Insufficient portfolio data for calculations'
          });
          return;
        }

        console.log('Starting Python asset performance calculation...');
        console.log(`Portfolio values: ${portfolioValues.length} points`);
        console.log(`Returns: ${returns.length} points`);
        console.log(`Assets: ${Object.keys(weights).join(', ')}`);
        
        // Log asset price data availability
        if (input.assetPriceData && Object.keys(input.assetPriceData).length > 0) {
          console.log(`Asset price data available for: ${Object.keys(input.assetPriceData).join(', ')}`);
          const sampleAsset = Object.keys(input.assetPriceData)[0];
          console.log(`Sample asset ${sampleAsset} has ${input.assetPriceData[sampleAsset]?.length || 0} price points`);
        } else {
          console.log('No asset price data - will use realistic simulation');
        }

        // Spawn Python process
        const pythonProcess = spawn(this.pythonPath, [this.scriptPath], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let outputData = '';
        let errorData = '';

        // Collect stdout
        pythonProcess.stdout.on('data', (data) => {
          outputData += data.toString();
        });

        // Collect stderr
        pythonProcess.stderr.on('data', (data) => {
          errorData += data.toString();
        });

        // Handle process completion
        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            console.error('Python process failed with code:', code);
            console.error('Error output:', errorData);
            resolve({
              success: false,
              error: `Python process failed: ${errorData || 'Unknown error'}`
            });
            return;
          }

          try {
            // Parse Python output
            const result = JSON.parse(outputData) as AssetPerformanceResult;
            
            if (result.success && result.data) {
              console.log(`Successfully calculated metrics for ${result.data.length} assets`);
              console.log('Assets processed:', result.data.map(d => d.symbol).join(', '));
            }
            
            resolve(result);
          } catch (parseError) {
            console.error('Failed to parse Python output:', parseError);
            console.error('Raw output:', outputData);
            resolve({
              success: false,
              error: `Failed to parse Python output: ${parseError}`
            });
          }
        });

        // Handle process errors
        pythonProcess.on('error', (error) => {
          console.error('Python process error:', error);
          resolve({
            success: false,
            error: `Failed to start Python process: ${error.message}`
          });
        });

        // Send input data to Python
        const inputJson = JSON.stringify(input);
        pythonProcess.stdin.write(inputJson);
        pythonProcess.stdin.end();

        // Set timeout
        setTimeout(() => {
          pythonProcess.kill();
          resolve({
            success: false,
            error: 'Python calculation timeout'
          });
        }, 30000); // 30 second timeout

      } catch (error) {
        console.error('Error in calculateAssetPerformance:', error);
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  /**
   * Test Python environment
   */
  async testPythonEnvironment(): Promise<{ success: boolean; error?: string; versions?: any }> {
    return new Promise((resolve) => {
      const pythonProcess = spawn(this.pythonPath, ['-c', 'import sys, numpy, pandas; print(f"Python: {sys.version}"); print(f"NumPy: {numpy.__version__}"); print(f"Pandas: {pandas.__version__}")'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let outputData = '';
      let errorData = '';

      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            error: `Python environment test failed: ${errorData}`
          });
        } else {
          resolve({
            success: true,
            versions: outputData.trim()
          });
        }
      });

      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to test Python environment: ${error.message}`
        });
      });
    });
  }
}

// Export singleton instance
export const pythonAssetRunner = new PythonAssetRunner();
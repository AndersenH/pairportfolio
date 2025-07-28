import { spawn } from 'child_process';
import path from 'path';

interface PythonResult {
  success: boolean;
  data?: any;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export async function runPythonScript(
  scriptPath: string,
  args: string[] = []
): Promise<PythonResult> {
  return new Promise((resolve) => {
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const fullPath = path.join(process.cwd(), scriptPath);
    
    const python = spawn(pythonPath, [fullPath, ...args]);
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: `Python script exited with code ${code}`,
          stderr
        });
      } else {
        try {
          const data = JSON.parse(stdout);
          resolve({ success: true, data });
        } catch (e) {
          resolve({ success: true, stdout, stderr });
        }
      }
    });
    
    python.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });
  });
}

// Run Python with JSON input/output
export async function runPythonWithData(
  scriptPath: string,
  inputData: any
): Promise<PythonResult> {
  return new Promise((resolve) => {
    const pythonDir = path.join(process.cwd(), 'python');
    const venvPython = path.join(pythonDir, 'venv/bin/python3');
    const fullPath = path.join(process.cwd(), scriptPath);
    
    // Use virtual environment Python directly
    const pythonPath = process.env.PYTHON_PATH || venvPython;
    
    const env = {
      ...process.env,
      PYTHONPATH: pythonDir,
      VIRTUAL_ENV: path.join(pythonDir, 'venv')
    };
    
    const python = spawn(pythonPath, [fullPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      cwd: process.cwd()
    });
    
    let stdout = '';
    let stderr = '';
    
    // Transform data format for Python backtest engine
    const transformedData = transformForPython(inputData);
    
    // Send JSON data to Python stdin
    python.stdin.write(JSON.stringify(transformedData));
    python.stdin.end();
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: `Python script exited with code ${code}`,
          stderr
        });
      } else {
        try {
          const result = JSON.parse(stdout);
          if (result.success) {
            resolve({ success: true, data: result.data });
          } else {
            resolve({ success: false, error: result.error, stderr: result.traceback });
          }
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse Python output', stdout, stderr });
        }
      }
    });
    
    python.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });
  });
}

// Transform Next.js API data format to Python backtest engine format
function transformForPython(inputData: any): any {
  const { strategy, holdings, startDate, endDate, initialCapital, parameters, metadata } = inputData;
  
  return {
    strategy: {
      type: strategy || 'buy_hold',
      parameters: parameters || {}
    },
    portfolio: {
      holdings: holdings || []
    },
    start_date: startDate,
    end_date: endDate,
    initial_capital: initialCapital || 10000,
    rebalancing_frequency: parameters?.rebalanceFrequency || 'monthly',
    metadata: metadata || {}
  };
}
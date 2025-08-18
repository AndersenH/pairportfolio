const { spawn } = require('child_process');
const path = require('path');

async function runPythonWithData(scriptPath, inputData) {
  return new Promise((resolve) => {
    const pythonDir = path.join(process.cwd(), 'python');
    const venvPython = path.join(pythonDir, 'venv/bin/python3');
    const fullPath = path.join(process.cwd(), scriptPath);
    
    const env = {
      ...process.env,
      PYTHONPATH: pythonDir,
      VIRTUAL_ENV: path.join(pythonDir, 'venv')
    };
    
    const python = spawn(venvPython, [fullPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      cwd: process.cwd()
    });
    
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
    
    // Transform data format for Python
    const transformedData = {
      strategy: {
        type: inputData.strategy || 'buy_hold',
        parameters: inputData.parameters || {}
      },
      portfolio: {
        holdings: inputData.holdings || []
      },
      start_date: inputData.startDate,
      end_date: inputData.endDate,
      initial_capital: inputData.initialCapital || 10000,
      rebalancing_frequency: inputData.parameters?.rebalanceFrequency || 'monthly',
      metadata: inputData.metadata || {}
    };
    
    python.stdin.write(JSON.stringify(transformedData));
    python.stdin.end();
  });
}

module.exports = { runPythonWithData };
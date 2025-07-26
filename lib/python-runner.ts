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
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const fullPath = path.join(process.cwd(), scriptPath);
    
    const python = spawn(pythonPath, [fullPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    // Send JSON data to Python stdin
    python.stdin.write(JSON.stringify(inputData));
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
          const data = JSON.parse(stdout);
          resolve({ success: true, data });
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse Python output', stdout, stderr });
        }
      }
    });
  });
}
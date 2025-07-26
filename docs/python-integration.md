# Python Integration with Next.js

This document outlines multiple approaches for integrating Python scripts with your Next.js application, specifically for the backtesting engine.

## Approach 1: Child Process (Implemented)

**Pros:**
- Simple to implement
- No additional infrastructure
- Direct control over Python execution

**Cons:**
- Not suitable for long-running processes
- Limited scalability
- No built-in retry mechanism

### Usage Example:

```typescript
// In your Next.js component or API route
const response = await fetch('/api/python-backtest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    strategy: 'momentum',
    holdings: [
      { symbol: 'SPY', allocation: 0.5 },
      { symbol: 'QQQ', allocation: 0.5 }
    ],
    start_date: '2022-01-01',
    end_date: '2023-12-31',
    parameters: {
      lookback_period: 60,
      top_n: 3,
      rebalance_frequency: 'monthly'
    }
  })
});

const result = await response.json();
```

## Approach 2: Python REST API Service

Run Python as a separate Flask/FastAPI service:

```python
# python/api_server.py
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI()

class BacktestRequest(BaseModel):
    strategy: str
    holdings: list
    start_date: str
    end_date: str
    parameters: dict = {}

@app.post("/backtest")
async def run_backtest(request: BacktestRequest):
    # Your backtest logic here
    return {"result": "backtest results"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

Then in Next.js:

```typescript
// lib/python-api-client.ts
export async function runPythonBacktest(data: any) {
  const response = await fetch('http://localhost:8000/backtest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}
```

## Approach 3: Queue-Based Processing (Redis + Celery)

For long-running backtests:

```python
# python/celery_tasks.py
from celery import Celery
import redis

app = Celery('backtest', broker='redis://localhost:6379')
redis_client = redis.Redis()

@app.task
def run_backtest_task(backtest_id: str, params: dict):
    # Update status in Redis
    redis_client.hset(f"backtest:{backtest_id}", "status", "running")
    
    # Run backtest
    result = perform_backtest(params)
    
    # Store result
    redis_client.hset(f"backtest:{backtest_id}", {
        "status": "completed",
        "result": json.dumps(result)
    })
    
    return backtest_id
```

## Approach 4: WebSocket for Real-time Updates

```typescript
// lib/websocket-client.ts
import { io } from 'socket.io-client';

export function createBacktestWebSocket() {
  const socket = io('http://localhost:8001');
  
  socket.on('backtest_progress', (data) => {
    console.log('Progress:', data.progress);
  });
  
  socket.on('backtest_complete', (data) => {
    console.log('Results:', data.results);
  });
  
  return {
    startBacktest: (params: any) => {
      socket.emit('start_backtest', params);
    }
  };
}
```

## Approach 5: Serverless Functions (Vercel/AWS Lambda)

For production deployment:

```python
# api/python-backtest.py (Vercel)
from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data)
        
        # Run backtest
        result = run_backtest(data)
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())
```

## Approach 6: Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  nextjs:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PYTHON_API_URL=http://python:8000
    depends_on:
      - python

  python:
    build: ./python
    ports:
      - "8000:8000"
    volumes:
      - ./python:/app
    command: python api_server.py

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

## Performance Optimization Tips

1. **Use Process Pooling** for multiple concurrent backtests:

```python
from multiprocessing import Pool

def run_multiple_backtests(backtest_params_list):
    with Pool(processes=4) as pool:
        results = pool.map(run_single_backtest, backtest_params_list)
    return results
```

2. **Cache Market Data**:

```python
import pickle
import os

def get_cached_data(symbol, start, end):
    cache_key = f"{symbol}_{start}_{end}.pkl"
    cache_path = f"cache/{cache_key}"
    
    if os.path.exists(cache_path):
        with open(cache_path, 'rb') as f:
            return pickle.load(f)
    
    # Fetch and cache
    data = fetch_market_data(symbol, start, end)
    os.makedirs('cache', exist_ok=True)
    with open(cache_path, 'wb') as f:
        pickle.dump(data, f)
    
    return data
```

3. **Use NumPy/Pandas Vectorization**:

```python
# Instead of loops
returns = []
for i in range(len(prices)-1):
    returns.append((prices[i+1] - prices[i]) / prices[i])

# Use vectorization
returns = prices.pct_change().fillna(0)
```

## Security Considerations

1. **Validate Input**: Always validate data before passing to Python
2. **Sandboxing**: Run Python in Docker container with limited resources
3. **Timeout**: Set execution timeouts to prevent runaway processes
4. **Authentication**: Secure Python API endpoints if exposed

## Recommended Architecture

For your use case, I recommend:

1. **Development**: Child process approach (simple, already implemented)
2. **Production**: Python API service with Redis queue for async processing
3. **Scale**: Kubernetes with separate Python worker pods

## Next Steps

1. Install Python dependencies:
```bash
pip install pandas numpy yfinance fastapi uvicorn redis celery
```

2. Test the implementation:
```bash
# Test Python script directly
echo '{"strategy":"buy_hold","holdings":[{"symbol":"SPY","allocation":1}],"start_date":"2023-01-01","end_date":"2023-12-31"}' | python3 python/backtest_runner.py
```

3. Set Python path in .env:
```
PYTHON_PATH=/usr/bin/python3
```
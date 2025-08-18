#!/usr/bin/env python3
"""
Production-ready Python API server for backtesting
Can be run alongside Next.js for better performance and scalability
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio
import uuid
import redis
import json
import pandas as pd
import numpy as np
import yfinance as yf
from contextlib import asynccontextmanager

# Initialize Redis client
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

# Store for background task results
backtest_results = {}

class Holding(BaseModel):
    symbol: str
    allocation: float = Field(ge=0, le=1)

class BacktestRequest(BaseModel):
    strategy: str = "buy_hold"
    holdings: List[Holding]
    start_date: str
    end_date: str
    initial_capital: float = 10000
    parameters: Optional[Dict[str, Any]] = {}

class BacktestResponse(BaseModel):
    task_id: str
    status: str
    message: str

class BacktestResult(BaseModel):
    task_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# Lifecycle management
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting Python Backtest API Server...")
    yield
    # Shutdown
    print("Shutting down Python Backtest API Server...")

app = FastAPI(
    title="Python Backtest Engine",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BacktestEngine:
    """Enhanced backtest engine with caching and optimization"""
    
    def __init__(self):
        self.data_cache = {}
        
    async def fetch_data_async(self, symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
        """Fetch data asynchronously"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_data, symbol, start_date, end_date)
    
    def _fetch_data(self, symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
        """Fetch historical data with caching"""
        cache_key = f"{symbol}:{start_date}:{end_date}"
        
        # Check Redis cache first
        cached_data = redis_client.get(f"market_data:{cache_key}")
        if cached_data:
            return pd.read_json(cached_data)
        
        # Fetch from yfinance
        ticker = yf.Ticker(symbol)
        data = ticker.history(start=start_date, end=end_date)
        
        # Cache for 1 hour
        redis_client.setex(
            f"market_data:{cache_key}", 
            3600, 
            data.to_json()
        )
        
        return data
    
    async def run_backtest(self, request: BacktestRequest) -> Dict[str, Any]:
        """Run backtest based on strategy"""
        if request.strategy == "momentum":
            return await self.run_momentum_strategy(request)
        else:
            return await self.run_buy_hold_strategy(request)
    
    async def run_buy_hold_strategy(self, request: BacktestRequest) -> Dict[str, Any]:
        """Buy and hold strategy implementation"""
        portfolio_data = {}
        
        # Fetch data for all holdings concurrently
        tasks = []
        for holding in request.holdings:
            task = self.fetch_data_async(
                holding.symbol, 
                request.start_date, 
                request.end_date
            )
            tasks.append((holding, task))
        
        # Wait for all data
        for holding, task in tasks:
            data = await task
            if not data.empty:
                portfolio_data[holding.symbol] = {
                    'prices': data['Close'],
                    'allocation': holding.allocation
                }
        
        # Calculate portfolio performance
        return self._calculate_portfolio_performance(
            portfolio_data, 
            request.initial_capital
        )
    
    async def run_momentum_strategy(self, request: BacktestRequest) -> Dict[str, Any]:
        """Momentum strategy implementation"""
        lookback = request.parameters.get('lookback_period', 60)
        top_n = request.parameters.get('top_n', 3)
        
        # Implementation similar to backtest_runner.py
        # ... (momentum logic here)
        
        return {
            "message": "Momentum strategy execution",
            "parameters": request.parameters
        }
    
    def _calculate_portfolio_performance(self, portfolio_data: Dict, initial_capital: float) -> Dict:
        """Calculate portfolio metrics"""
        if not portfolio_data:
            return {"error": "No valid data for holdings"}
        
        # Align all price series to common dates
        all_prices = pd.DataFrame({
            symbol: data['prices'] 
            for symbol, data in portfolio_data.items()
        })
        all_prices = all_prices.dropna()
        
        # Calculate weighted returns
        weights = pd.Series({
            symbol: data['allocation'] 
            for symbol, data in portfolio_data.items()
        })
        
        returns = all_prices.pct_change()
        portfolio_returns = (returns * weights).sum(axis=1)
        
        # Calculate portfolio values
        portfolio_values = [initial_capital]
        for ret in portfolio_returns[1:]:
            portfolio_values.append(portfolio_values[-1] * (1 + ret))
        
        # Calculate metrics
        total_return = (portfolio_values[-1] / initial_capital) - 1
        annualized_return = (1 + total_return) ** (252 / len(portfolio_values)) - 1
        volatility = portfolio_returns.std() * np.sqrt(252)
        sharpe_ratio = (annualized_return - 0.02) / volatility if volatility > 0 else 0
        
        # Max drawdown
        peak = pd.Series(portfolio_values).expanding().max()
        drawdown = (pd.Series(portfolio_values) - peak) / peak
        max_drawdown = drawdown.min()
        
        return {
            "dates": all_prices.index.strftime('%Y-%m-%d').tolist(),
            "portfolio_values": portfolio_values,
            "returns": portfolio_returns.fillna(0).tolist(),
            "metrics": {
                "total_return": float(total_return),
                "annualized_return": float(annualized_return),
                "volatility": float(volatility),
                "sharpe_ratio": float(sharpe_ratio),
                "max_drawdown": float(max_drawdown)
            }
        }

# Initialize engine
engine = BacktestEngine()

@app.get("/")
async def root():
    return {"message": "Python Backtest API Server", "status": "running"}

@app.post("/backtest", response_model=BacktestResponse)
async def create_backtest(request: BacktestRequest, background_tasks: BackgroundTasks):
    """Create a new backtest task"""
    task_id = str(uuid.uuid4())
    
    # Store initial status
    redis_client.hset(f"backtest:{task_id}", mapping={
        "status": "pending",
        "created_at": datetime.utcnow().isoformat()
    })
    
    # Add to background tasks
    background_tasks.add_task(run_backtest_task, task_id, request)
    
    return BacktestResponse(
        task_id=task_id,
        status="pending",
        message="Backtest task created"
    )

@app.get("/backtest/{task_id}", response_model=BacktestResult)
async def get_backtest_result(task_id: str):
    """Get backtest result by task ID"""
    # Check Redis for result
    task_data = redis_client.hgetall(f"backtest:{task_id}")
    
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    result = None
    if task_data.get("result"):
        result = json.loads(task_data["result"])
    
    return BacktestResult(
        task_id=task_id,
        status=task_data.get("status", "unknown"),
        result=result,
        error=task_data.get("error")
    )

@app.post("/backtest/sync")
async def run_backtest_sync(request: BacktestRequest):
    """Run backtest synchronously (for small/quick backtests)"""
    try:
        result = await engine.run_backtest(request)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def run_backtest_task(task_id: str, request: BacktestRequest):
    """Background task to run backtest"""
    try:
        # Update status
        redis_client.hset(f"backtest:{task_id}", "status", "running")
        
        # Run backtest
        result = await engine.run_backtest(request)
        
        # Store result
        redis_client.hset(f"backtest:{task_id}", mapping={
            "status": "completed",
            "result": json.dumps(result),
            "completed_at": datetime.utcnow().isoformat()
        })
        
        # Expire after 1 hour
        redis_client.expire(f"backtest:{task_id}", 3600)
        
    except Exception as e:
        # Store error
        redis_client.hset(f"backtest:{task_id}", mapping={
            "status": "failed",
            "error": str(e),
            "failed_at": datetime.utcnow().isoformat()
        })

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check Redis connection
        redis_client.ping()
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "redis": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
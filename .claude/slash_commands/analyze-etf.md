# /analyze-etf - ETF Analysis Command

Perform comprehensive analysis on an ETF including performance metrics, risk analysis, and market context.

## Usage

```
/analyze-etf [symbol] [options]
```

## Parameters

- **symbol**: ETF ticker symbol (required)
- **period**: Analysis period (1y, 3y, 5y, 10y, ytd, max) (default: 5y)
- **compare**: Compare with other ETFs (optional)
- **include**: Specific analyses to include (price, risk, correlation, fundamental)

## Examples

1. Basic analysis:
   ```
   /analyze-etf SPY
   ```

2. With comparison:
   ```
   /analyze-etf QQQ compare=SPY,VTI period=3y
   ```

3. Specific analysis:
   ```
   /analyze-etf BND include=risk,correlation period=10y
   ```

## Output Sections

### 1. Overview
- Current price and change
- 52-week range
- Average volume
- Expense ratio
- AUM

### 2. Performance Analysis
- Returns (1m, 3m, 6m, 1y, 3y, 5y)
- Risk-adjusted returns (Sharpe, Sortino)
- Drawdown analysis
- Performance chart

### 3. Risk Metrics
- Volatility (annualized)
- Beta vs benchmark
- Maximum drawdown
- Value at Risk (VaR)
- Downside deviation

### 4. Technical Indicators
- Moving averages
- RSI
- MACD
- Bollinger Bands
- Support/Resistance levels

### 5. Correlation Analysis
- Correlation with major indices
- Correlation with similar ETFs
- Rolling correlation trends

### 6. Holdings Analysis (if available)
- Top 10 holdings
- Sector breakdown
- Geographic exposure
- Concentration risk

## Example Output

```
📊 ETF Analysis: QQQ - Invesco QQQ Trust

📈 Overview
├─ Price: $378.45 (+1.23% today)
├─ 52-Week Range: $312.50 - $384.20
├─ Expense Ratio: 0.20%
├─ AUM: $189.3B
└─ Avg Volume: 52.3M shares

💰 Performance (vs SPY)
├─ 1 Year: +28.4% (SPY: +22.1%)
├─ 3 Years: +45.2% ann. (SPY: +32.8%)
├─ 5 Years: +18.9% ann. (SPY: +14.2%)
└─ Sharpe Ratio: 0.92 (SPY: 0.81)

⚠️ Risk Metrics
├─ Volatility: 22.8% (High)
├─ Max Drawdown: -32.4% (Mar 2020)
├─ Beta: 1.18 (vs S&P 500)
└─ VaR (95%): -3.2% daily

📊 Technical Analysis
├─ Trend: Bullish (above 50 & 200 MA)
├─ RSI: 58 (Neutral)
├─ MACD: Bullish crossover
└─ Support: $365, Resistance: $385

🔗 Correlations
├─ SPY: 0.89 (Very High)
├─ VTI: 0.91 (Very High)
├─ IWM: 0.76 (High)
└─ EFA: 0.72 (High)

💡 Key Insights:
• Tech-heavy exposure provides growth but higher volatility
• Outperformed S&P 500 by 6.3% annually over 5 years
• Consider balancing with value or defensive ETFs
• Current technical setup suggests continued momentum
```

## Implementation Details

1. Fetch market data using FMP/Yahoo Finance APIs
2. Calculate all metrics using performance-metrics library
3. Generate charts using recharts components
4. Cache results for 15 minutes
5. Handle errors gracefully with fallbacks
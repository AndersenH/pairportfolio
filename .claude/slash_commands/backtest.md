# /backtest - Portfolio Backtest Command

Run a portfolio backtest with specified holdings and parameters.

## Usage

```
/backtest [portfolio_config]
```

## Parameters

- **holdings**: ETF symbols and allocations (e.g., "SPY 60% BND 40%")
- **start_date**: Start date in YYYY-MM-DD format (default: 5 years ago)
- **end_date**: End date in YYYY-MM-DD format (default: today)
- **initial_capital**: Starting investment amount (default: $10,000)
- **strategy**: "buy-hold" or "momentum" (default: "buy-hold")

## Examples

1. Basic backtest:
   ```
   /backtest SPY 60% BND 40%
   ```

2. With custom dates:
   ```
   /backtest SPY 50% QQQ 30% BND 20% from 2020-01-01 to 2023-12-31
   ```

3. With all parameters:
   ```
   /backtest SPY 70% GLD 30% start=2019-01-01 end=2024-01-01 capital=25000 strategy=momentum
   ```

## Implementation

When this command is invoked:

1. Parse the portfolio configuration from the command
2. Validate the inputs (allocations sum to 100%, valid dates, etc.)
3. Check if the development server is running
4. Call the appropriate backtest API endpoint
5. Display results in a formatted table
6. Optionally generate charts or detailed reports

## Output Format

The command should output:
- Portfolio summary
- Performance metrics table
- Key insights or warnings
- Suggestions for next steps

Example output:
```
📊 Backtest Results: SPY-BND Portfolio (60/40)
Period: 2020-01-01 to 2023-12-31

Performance Metrics:
├─ Initial Investment: $10,000
├─ Final Value: $13,842
├─ Total Return: 38.42%
├─ CAGR: 8.48%
├─ Max Drawdown: -15.23%
├─ Sharpe Ratio: 0.72
└─ Volatility: 12.34%

✅ The portfolio outperformed a 100% stock allocation on a risk-adjusted basis.
💡 Consider rebalancing quarterly to maintain target allocations.
```
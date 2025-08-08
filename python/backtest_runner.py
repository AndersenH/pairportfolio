#!/usr/bin/env python3
"""
Backward-compatible backtest runner that delegates to the enhanced version
This maintains compatibility with existing Next.js integration
"""

import sys
import json
import traceback
from datetime import datetime, timedelta
from enhanced_backtest_runner import EnhancedBacktestRunner

def get_default_dates():
    """Calculate default dates: 5-year window ending today (July 28, 2025)"""
    today = datetime(2025, 7, 28)
    five_years_ago = today - timedelta(days=5*365)
    
    return {
        'start': five_years_ago.strftime('%Y-%m-%d'),
        'end': today.strftime('%Y-%m-%d')
    }

def main():
    """Main entry point that converts old format to new format"""
    try:
        # Read JSON from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Convert old format to new format
        config = convert_legacy_format(input_data)
        
        # Use enhanced runner
        runner = EnhancedBacktestRunner()
        result = runner.run_backtest(config)
        
        # Output result
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }
        print(json.dumps(error_result))
        sys.exit(1)

def convert_legacy_format(old_data):
    """Convert legacy input format to new enhanced format"""
    # Handle legacy format where strategy was a string
    strategy_type = old_data.get('strategy', 'buy_hold')
    
    if isinstance(strategy_type, str):
        strategy = {
            'type': strategy_type,
            'parameters': old_data.get('parameters', {})
        }
    else:
        strategy = strategy_type
    
    # Convert holdings format
    holdings = old_data.get('holdings', [])
    portfolio = {'holdings': holdings}
    
    # Build new config format
    config = {
        'strategy': strategy,
        'portfolio': portfolio,
        'start_date': old_data.get('start_date', get_default_dates()['start']),
        'end_date': old_data.get('end_date', get_default_dates()['end']),
        'initial_capital': old_data.get('initial_capital', 10000),
        'rebalancing_frequency': old_data.get('rebalancing_frequency', 'monthly'),
        'include_benchmark': old_data.get('include_benchmark', True)
    }
    
    return config

if __name__ == '__main__':
    main()
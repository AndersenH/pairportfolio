import { Strategy, StrategyParameters, RebalancingFrequency } from './types';

export class StrategyConfigValidator {
  /**
   * Validate strategy parameters based on strategy type
   */
  static validateStrategy(strategy: Strategy): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!strategy.id || !strategy.name || !strategy.type) {
      errors.push('Strategy must have id, name, and type');
    }

    // Type-specific validation
    switch (strategy.type) {
      case 'buy_hold':
        // No specific parameters needed for buy and hold
        break;

      case 'momentum':
        this.validateMomentumParameters(strategy.parameters, errors);
        break;

      case 'mean_reversion':
        this.validateMeanReversionParameters(strategy.parameters, errors);
        break;

      case 'risk_parity':
        this.validateRiskParityParameters(strategy.parameters, errors);
        break;

      case 'tactical_allocation':
        this.validateTacticalAllocationParameters(strategy.parameters, errors);
        break;

      case 'rotation':
        this.validateRotationParameters(strategy.parameters, errors);
        break;

      default:
        errors.push(`Unsupported strategy type: ${strategy.type}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate rebalancing frequency
   */
  static validateRebalancingFrequency(frequency: RebalancingFrequency): boolean {
    const validFrequencies: RebalancingFrequency[] = ['daily', 'weekly', 'monthly', 'quarterly', 'annually'];
    return validFrequencies.includes(frequency);
  }

  /**
   * Validate portfolio allocation (sum should equal 1.0)
   */
  static validatePortfolioAllocations(allocations: Record<string, number>): { isValid: boolean; error?: string } {
    const totalAllocation = Object.values(allocations).reduce((sum, allocation) => sum + allocation, 0);
    const tolerance = 0.001; // Allow small rounding errors

    if (Math.abs(totalAllocation - 1.0) > tolerance) {
      return {
        isValid: false,
        error: `Portfolio allocations must sum to 1.0, got ${totalAllocation.toFixed(4)}`
      };
    }

    // Check individual allocations
    for (const [symbol, allocation] of Object.entries(allocations)) {
      if (allocation < 0 || allocation > 1) {
        return {
          isValid: false,
          error: `Allocation for ${symbol} must be between 0 and 1, got ${allocation}`
        };
      }
    }

    return { isValid: true };
  }

  private static validateMomentumParameters(params: StrategyParameters, errors: string[]): void {
    if (params.lookback_period !== undefined) {
      if (!Number.isInteger(params.lookback_period) || params.lookback_period < 1 || params.lookback_period > 252) {
        errors.push('Momentum lookback_period must be an integer between 1 and 252');
      }
    }

    if (params.top_n !== undefined) {
      if (!Number.isInteger(params.top_n) || params.top_n < 1 || params.top_n > 20) {
        errors.push('Momentum top_n must be an integer between 1 and 20');
      }
    }
  }

  private static validateMeanReversionParameters(params: StrategyParameters, errors: string[]): void {
    if (params.ma_period !== undefined) {
      if (!Number.isInteger(params.ma_period) || params.ma_period < 5 || params.ma_period > 200) {
        errors.push('Mean reversion ma_period must be an integer between 5 and 200');
      }
    }

    if (params.deviation_threshold !== undefined) {
      if (typeof params.deviation_threshold !== 'number' || params.deviation_threshold < 0.01 || params.deviation_threshold > 0.5) {
        errors.push('Mean reversion deviation_threshold must be a number between 0.01 and 0.5');
      }
    }
  }

  private static validateRiskParityParameters(params: StrategyParameters, errors: string[]): void {
    if (params.volatility_window !== undefined) {
      if (!Number.isInteger(params.volatility_window) || params.volatility_window < 20 || params.volatility_window > 252) {
        errors.push('Risk parity volatility_window must be an integer between 20 and 252');
      }
    }
  }

  private static validateTacticalAllocationParameters(params: StrategyParameters, errors: string[]): void {
    if (params.risk_on_allocation !== undefined) {
      if (typeof params.risk_on_allocation !== 'number' || params.risk_on_allocation < 0 || params.risk_on_allocation > 1) {
        errors.push('Tactical allocation risk_on_allocation must be a number between 0 and 1');
      }
    }

    if (params.risk_off_allocation !== undefined) {
      if (typeof params.risk_off_allocation !== 'number' || params.risk_off_allocation < 0 || params.risk_off_allocation > 1) {
        errors.push('Tactical allocation risk_off_allocation must be a number between 0 and 1');
      }
    }

    // Check that risk_on and risk_off allocations sum to 1
    if (params.risk_on_allocation !== undefined && params.risk_off_allocation !== undefined) {
      const total = params.risk_on_allocation + params.risk_off_allocation;
      if (Math.abs(total - 1.0) > 0.001) {
        errors.push('Tactical allocation risk_on_allocation + risk_off_allocation must equal 1.0');
      }
    }
  }

  private static validateRotationParameters(params: StrategyParameters, errors: string[]): void {
    if (params.number_of_sectors !== undefined) {
      if (!Number.isInteger(params.number_of_sectors) || params.number_of_sectors < 1 || params.number_of_sectors > 10) {
        errors.push('Rotation number_of_sectors must be an integer between 1 and 10');
      }
    }
  }
}

export class StrategyFactory {
  /**
   * Create default system strategies
   */
  static createSystemStrategies(): Strategy[] {
    return [
      {
        id: 'buy-hold',
        name: 'Buy and Hold',
        type: 'buy_hold',
        description: 'Static portfolio allocation - buy and hold target allocations',
        parameters: {}
      },
      {
        id: 'momentum-60-3',
        name: 'Momentum (60-day, Top 3)',
        type: 'momentum',
        description: 'Select top 3 assets based on 60-day momentum, rebalance monthly',
        parameters: {
          lookback_period: 60,
          top_n: 3
        }
      },
      {
        id: 'momentum-120-5',
        name: 'Momentum (120-day, Top 5)',
        type: 'momentum',
        description: 'Select top 5 assets based on 120-day momentum, rebalance monthly',
        parameters: {
          lookback_period: 120,
          top_n: 5
        }
      },
      {
        id: 'mean-reversion-50',
        name: 'Mean Reversion (50-day MA)',
        type: 'mean_reversion',
        description: 'Overweight assets trading below 50-day moving average',
        parameters: {
          ma_period: 50,
          deviation_threshold: 0.1
        }
      },
      {
        id: 'risk-parity-60',
        name: 'Risk Parity (60-day volatility)',
        type: 'risk_parity',
        description: 'Inverse volatility weighting based on 60-day rolling volatility',
        parameters: {
          volatility_window: 60
        }
      },
      {
        id: 'tactical-200ma',
        name: 'Tactical Allocation (200-day MA)',
        type: 'tactical_allocation',
        description: 'Switch between risk-on and risk-off based on 200-day moving average',
        parameters: {
          risk_on_allocation: 0.8,
          risk_off_allocation: 0.2
        }
      },
      {
        id: 'sector-rotation-3',
        name: 'Sector Rotation (Top 3)',
        type: 'rotation',
        description: 'Momentum-based rotation among top 3 performing sectors',
        parameters: {
          number_of_sectors: 3,
          rotation_model: 'momentum_based'
        }
      }
    ];
  }

  /**
   * Create a custom momentum strategy
   */
  static createMomentumStrategy(
    id: string,
    name: string,
    lookbackPeriod: number = 60,
    topN: number = 3,
    description?: string
  ): Strategy {
    return {
      id,
      name,
      type: 'momentum',
      description: description || `Momentum strategy with ${lookbackPeriod}-day lookback, top ${topN} assets`,
      parameters: {
        lookback_period: lookbackPeriod,
        top_n: topN
      }
    };
  }

  /**
   * Create a custom mean reversion strategy
   */
  static createMeanReversionStrategy(
    id: string,
    name: string,
    maPeriod: number = 50,
    deviationThreshold: number = 0.1,
    description?: string
  ): Strategy {
    return {
      id,
      name,
      type: 'mean_reversion',
      description: description || `Mean reversion strategy with ${maPeriod}-day MA, ${deviationThreshold * 100}% threshold`,
      parameters: {
        ma_period: maPeriod,
        deviation_threshold: deviationThreshold
      }
    };
  }

  /**
   * Create a custom risk parity strategy
   */
  static createRiskParityStrategy(
    id: string,
    name: string,
    volatilityWindow: number = 60,
    description?: string
  ): Strategy {
    return {
      id,
      name,
      type: 'risk_parity',
      description: description || `Risk parity strategy with ${volatilityWindow}-day volatility window`,
      parameters: {
        volatility_window: volatilityWindow
      }
    };
  }

  /**
   * Create a custom tactical allocation strategy
   */
  static createTacticalAllocationStrategy(
    id: string,
    name: string,
    riskOnAllocation: number = 0.8,
    riskOffAllocation: number = 0.2,
    description?: string
  ): Strategy {
    return {
      id,
      name,
      type: 'tactical_allocation',
      description: description || `Tactical allocation: ${riskOnAllocation * 100}% risk-on, ${riskOffAllocation * 100}% risk-off`,
      parameters: {
        risk_on_allocation: riskOnAllocation,
        risk_off_allocation: riskOffAllocation
      }
    };
  }

  /**
   * Get default parameters for a strategy type
   */
  static getDefaultParameters(strategyType: string): StrategyParameters {
    switch (strategyType) {
      case 'buy_hold':
        return {};
      
      case 'momentum':
        return {
          lookback_period: 60,
          top_n: 3
        };
      
      case 'mean_reversion':
        return {
          ma_period: 50,
          deviation_threshold: 0.1
        };
      
      case 'risk_parity':
        return {
          volatility_window: 60
        };
      
      case 'tactical_allocation':
        return {
          risk_on_allocation: 0.8,
          risk_off_allocation: 0.2
        };
      
      case 'rotation':
        return {
          number_of_sectors: 3,
          rotation_model: 'momentum_based'
        };
      
      default:
        return {};
    }
  }

  /**
   * Get parameter constraints for a strategy type
   */
  static getParameterConstraints(strategyType: string): Record<string, { min: number; max: number; type: 'integer' | 'float' }> {
    switch (strategyType) {
      case 'momentum':
        return {
          lookback_period: { min: 1, max: 252, type: 'integer' },
          top_n: { min: 1, max: 20, type: 'integer' }
        };
      
      case 'mean_reversion':
        return {
          ma_period: { min: 5, max: 200, type: 'integer' },
          deviation_threshold: { min: 0.01, max: 0.5, type: 'float' }
        };
      
      case 'risk_parity':
        return {
          volatility_window: { min: 20, max: 252, type: 'integer' }
        };
      
      case 'tactical_allocation':
        return {
          risk_on_allocation: { min: 0, max: 1, type: 'float' },
          risk_off_allocation: { min: 0, max: 1, type: 'float' }
        };
      
      case 'rotation':
        return {
          number_of_sectors: { min: 1, max: 10, type: 'integer' }
        };
      
      default:
        return {};
    }
  }
}
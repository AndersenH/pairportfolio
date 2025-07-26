"""
Strategy Configuration Classes with Validation and Parameter Management
Provides type-safe configuration for all trading strategies
"""

from typing import Dict, Any, Union, Optional, List
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import json
import logging

logger = logging.getLogger(__name__)

@dataclass
class BaseStrategyConfig(ABC):
    """Base configuration class for all strategies"""
    name: str
    description: Optional[str] = None
    
    @abstractmethod
    def validate(self) -> bool:
        """Validate strategy configuration"""
        pass
    
    @abstractmethod
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format"""
        pass
    
    @classmethod
    @abstractmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BaseStrategyConfig':
        """Create from dictionary"""
        pass

@dataclass
class BuyHoldConfig(BaseStrategyConfig):
    """Buy and hold strategy configuration"""
    name: str = "Buy and Hold"
    description: str = "Static allocation strategy with no rebalancing"
    target_allocations: Optional[Dict[str, float]] = None
    
    def validate(self) -> bool:
        """Validate buy and hold configuration"""
        if self.target_allocations:
            # Check allocations sum to 1.0 (with small tolerance for rounding)
            total = sum(self.target_allocations.values())
            if abs(total - 1.0) > 0.01:
                logger.error(f"Target allocations sum to {total}, expected 1.0")
                return False
            
            # Check all allocations are positive
            for symbol, allocation in self.target_allocations.items():
                if allocation < 0 or allocation > 1:
                    logger.error(f"Invalid allocation for {symbol}: {allocation}")
                    return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': 'buy_hold',
            'name': self.name,
            'description': self.description,
            'parameters': {
                'target_allocations': self.target_allocations
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BuyHoldConfig':
        params = data.get('parameters', {})
        return cls(
            name=data.get('name', 'Buy and Hold'),
            description=data.get('description', 'Static allocation strategy with no rebalancing'),
            target_allocations=params.get('target_allocations')
        )

@dataclass
class MomentumConfig(BaseStrategyConfig):
    """Momentum strategy configuration"""
    name: str = "Momentum"
    description: str = "Momentum-based strategy selecting top performing assets"
    lookback_period: int = 60
    top_n: int = 3
    
    def validate(self) -> bool:
        """Validate momentum configuration"""
        if self.lookback_period <= 0:
            logger.error(f"Invalid lookback_period: {self.lookback_period}")
            return False
        
        if self.lookback_period < 5:
            logger.warning(f"Very short lookback_period: {self.lookback_period}")
        
        if self.top_n <= 0:
            logger.error(f"Invalid top_n: {self.top_n}")
            return False
        
        if self.lookback_period > 252:
            logger.warning(f"Very long lookback_period: {self.lookback_period} days")
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': 'momentum',
            'name': self.name,
            'description': self.description,
            'parameters': {
                'lookback_period': self.lookback_period,
                'top_n': self.top_n
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MomentumConfig':
        params = data.get('parameters', {})
        return cls(
            name=data.get('name', 'Momentum'),
            description=data.get('description', 'Momentum-based strategy selecting top performing assets'),
            lookback_period=params.get('lookback_period', 60),
            top_n=params.get('top_n', 3)
        )

@dataclass
class RelativeStrengthConfig(BaseStrategyConfig):
    """Relative strength strategy configuration"""
    name: str = "Relative Strength"
    description: str = "Relative strength strategy vs benchmark"
    lookback_period: int = 126
    top_n: int = 2
    benchmark_symbol: str = "SPY"
    
    def validate(self) -> bool:
        """Validate relative strength configuration"""
        if self.lookback_period <= 0:
            logger.error(f"Invalid lookback_period: {self.lookback_period}")
            return False
        
        if self.top_n <= 0:
            logger.error(f"Invalid top_n: {self.top_n}")
            return False
        
        if not self.benchmark_symbol:
            logger.error("Benchmark symbol is required")
            return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': 'relative_strength',
            'name': self.name,
            'description': self.description,
            'parameters': {
                'lookback_period': self.lookback_period,
                'top_n': self.top_n,
                'benchmark_symbol': self.benchmark_symbol
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RelativeStrengthConfig':
        params = data.get('parameters', {})
        return cls(
            name=data.get('name', 'Relative Strength'),
            description=data.get('description', 'Relative strength strategy vs benchmark'),
            lookback_period=params.get('lookback_period', 126),
            top_n=params.get('top_n', 2),
            benchmark_symbol=params.get('benchmark_symbol', 'SPY')
        )

@dataclass
class MeanReversionConfig(BaseStrategyConfig):
    """Mean reversion strategy configuration"""
    name: str = "Mean Reversion"
    description: str = "Mean reversion strategy using moving averages"
    ma_period: int = 50
    deviation_threshold: float = 0.1
    
    def validate(self) -> bool:
        """Validate mean reversion configuration"""
        if self.ma_period <= 0:
            logger.error(f"Invalid ma_period: {self.ma_period}")
            return False
        
        if self.ma_period < 10:
            logger.warning(f"Very short ma_period: {self.ma_period}")
        
        if self.deviation_threshold <= 0 or self.deviation_threshold > 1:
            logger.error(f"Invalid deviation_threshold: {self.deviation_threshold}")
            return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': 'mean_reversion',
            'name': self.name,
            'description': self.description,
            'parameters': {
                'ma_period': self.ma_period,
                'deviation_threshold': self.deviation_threshold
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MeanReversionConfig':
        params = data.get('parameters', {})
        return cls(
            name=data.get('name', 'Mean Reversion'),
            description=data.get('description', 'Mean reversion strategy using moving averages'),
            ma_period=params.get('ma_period', 50),
            deviation_threshold=params.get('deviation_threshold', 0.1)
        )

@dataclass
class RiskParityConfig(BaseStrategyConfig):
    """Risk parity strategy configuration"""
    name: str = "Risk Parity"
    description: str = "Risk parity strategy with inverse volatility weighting"
    volatility_window: int = 60
    min_weight: float = 0.05
    max_weight: float = 0.5
    
    def validate(self) -> bool:
        """Validate risk parity configuration"""
        if self.volatility_window <= 0:
            logger.error(f"Invalid volatility_window: {self.volatility_window}")
            return False
        
        if self.volatility_window < 20:
            logger.warning(f"Very short volatility_window: {self.volatility_window}")
        
        if not 0 <= self.min_weight <= 1:
            logger.error(f"Invalid min_weight: {self.min_weight}")
            return False
        
        if not 0 <= self.max_weight <= 1:
            logger.error(f"Invalid max_weight: {self.max_weight}")
            return False
        
        if self.min_weight >= self.max_weight:
            logger.error(f"min_weight ({self.min_weight}) must be less than max_weight ({self.max_weight})")
            return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': 'risk_parity',
            'name': self.name,
            'description': self.description,
            'parameters': {
                'volatility_window': self.volatility_window,
                'min_weight': self.min_weight,
                'max_weight': self.max_weight
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RiskParityConfig':
        params = data.get('parameters', {})
        return cls(
            name=data.get('name', 'Risk Parity'),
            description=data.get('description', 'Risk parity strategy with inverse volatility weighting'),
            volatility_window=params.get('volatility_window', 60),
            min_weight=params.get('min_weight', 0.05),
            max_weight=params.get('max_weight', 0.5)
        )

@dataclass
class TacticalAllocationConfig(BaseStrategyConfig):
    """Tactical allocation strategy configuration"""
    name: str = "Tactical Allocation"
    description: str = "Tactical asset allocation based on market regime"
    indicator: str = "moving_average"
    ma_period: int = 200
    risk_on_allocation: float = 0.8
    risk_off_allocation: float = 0.2
    
    def validate(self) -> bool:
        """Validate tactical allocation configuration"""
        valid_indicators = ["moving_average", "volatility", "momentum"]
        if self.indicator not in valid_indicators:
            logger.error(f"Invalid indicator: {self.indicator}. Must be one of {valid_indicators}")
            return False
        
        if self.ma_period <= 0:
            logger.error(f"Invalid ma_period: {self.ma_period}")
            return False
        
        if not 0 <= self.risk_on_allocation <= 1:
            logger.error(f"Invalid risk_on_allocation: {self.risk_on_allocation}")
            return False
        
        if not 0 <= self.risk_off_allocation <= 1:
            logger.error(f"Invalid risk_off_allocation: {self.risk_off_allocation}")
            return False
        
        if abs(self.risk_on_allocation + self.risk_off_allocation - 1.0) > 0.01:
            logger.error(f"risk_on_allocation + risk_off_allocation must sum to 1.0")
            return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': 'tactical_allocation',
            'name': self.name,
            'description': self.description,
            'parameters': {
                'indicator': self.indicator,
                'ma_period': self.ma_period,
                'risk_on_allocation': self.risk_on_allocation,
                'risk_off_allocation': self.risk_off_allocation
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TacticalAllocationConfig':
        params = data.get('parameters', {})
        return cls(
            name=data.get('name', 'Tactical Allocation'),
            description=data.get('description', 'Tactical asset allocation based on market regime'),
            indicator=params.get('indicator', 'moving_average'),
            ma_period=params.get('ma_period', 200),
            risk_on_allocation=params.get('risk_on_allocation', 0.8),
            risk_off_allocation=params.get('risk_off_allocation', 0.2)
        )

@dataclass
class RotationConfig(BaseStrategyConfig):
    """Rotation strategy configuration"""
    name: str = "Rotation"
    description: str = "Sector rotation strategy"
    rotation_model: str = "momentum_based"
    number_of_sectors: int = 3
    lookback_period: int = 90
    
    def validate(self) -> bool:
        """Validate rotation configuration"""
        valid_models = ["momentum_based", "mean_reversion", "relative_strength"]
        if self.rotation_model not in valid_models:
            logger.error(f"Invalid rotation_model: {self.rotation_model}. Must be one of {valid_models}")
            return False
        
        if self.number_of_sectors <= 0:
            logger.error(f"Invalid number_of_sectors: {self.number_of_sectors}")
            return False
        
        if self.lookback_period <= 0:
            logger.error(f"Invalid lookback_period: {self.lookback_period}")
            return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': 'rotation',
            'name': self.name,
            'description': self.description,
            'parameters': {
                'rotation_model': self.rotation_model,
                'number_of_sectors': self.number_of_sectors,
                'lookback_period': self.lookback_period
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RotationConfig':
        params = data.get('parameters', {})
        return cls(
            name=data.get('name', 'Rotation'),
            description=data.get('description', 'Sector rotation strategy'),
            rotation_model=params.get('rotation_model', 'momentum_based'),
            number_of_sectors=params.get('number_of_sectors', 3),
            lookback_period=params.get('lookback_period', 90)
        )

class StrategyConfigFactory:
    """Factory for creating strategy configurations"""
    
    _strategies = {
        'buy_hold': BuyHoldConfig,
        'momentum': MomentumConfig,
        'relative_strength': RelativeStrengthConfig,
        'mean_reversion': MeanReversionConfig,
        'risk_parity': RiskParityConfig,
        'tactical_allocation': TacticalAllocationConfig,
        'rotation': RotationConfig
    }
    
    @classmethod
    def create_config(cls, strategy_type: str, **kwargs) -> BaseStrategyConfig:
        """Create a strategy configuration"""
        if strategy_type not in cls._strategies:
            available = list(cls._strategies.keys())
            raise ValueError(f"Unknown strategy type: {strategy_type}. Available: {available}")
        
        config_class = cls._strategies[strategy_type]
        return config_class(**kwargs)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> BaseStrategyConfig:
        """Create configuration from dictionary"""
        strategy_type = data.get('type')
        if not strategy_type:
            raise ValueError("Strategy type is required")
        
        if strategy_type not in cls._strategies:
            available = list(cls._strategies.keys())
            raise ValueError(f"Unknown strategy type: {strategy_type}. Available: {available}")
        
        config_class = cls._strategies[strategy_type]
        return config_class.from_dict(data)
    
    @classmethod
    def get_available_strategies(cls) -> List[str]:
        """Get list of available strategy types"""
        return list(cls._strategies.keys())
    
    @classmethod
    def get_strategy_schema(cls, strategy_type: str) -> Dict[str, Any]:
        """Get JSON schema for a strategy type"""
        if strategy_type not in cls._strategies:
            raise ValueError(f"Unknown strategy type: {strategy_type}")
        
        # Return basic schema information
        config_class = cls._strategies[strategy_type]
        
        # Get default instance to extract parameter names and types
        try:
            default_config = config_class()
            return {
                'type': strategy_type,
                'name': default_config.name,
                'description': default_config.description,
                'parameters': default_config.to_dict()['parameters']
            }
        except Exception as e:
            logger.error(f"Error generating schema for {strategy_type}: {str(e)}")
            return {'type': strategy_type, 'error': str(e)}

@dataclass
class PortfolioConfig:
    """Portfolio configuration"""
    holdings: List[Dict[str, Union[str, float]]]
    
    def validate(self) -> bool:
        """Validate portfolio configuration"""
        if not self.holdings:
            logger.error("Portfolio must have at least one holding")
            return False
        
        total_allocation = 0
        symbols = set()
        
        for i, holding in enumerate(self.holdings):
            # Check required fields
            if 'symbol' not in holding or 'allocation' not in holding:
                logger.error(f"Holding {i} missing required fields (symbol, allocation)")
                return False
            
            # Check symbol
            symbol = holding['symbol']
            if not isinstance(symbol, str) or not symbol.strip():
                logger.error(f"Invalid symbol in holding {i}: {symbol}")
                return False
            
            if symbol in symbols:
                logger.error(f"Duplicate symbol in portfolio: {symbol}")
                return False
            symbols.add(symbol)
            
            # Check allocation
            allocation = holding['allocation']
            if not isinstance(allocation, (int, float)):
                logger.error(f"Invalid allocation type in holding {i}: {type(allocation)}")
                return False
            
            if allocation <= 0 or allocation > 1:
                logger.error(f"Invalid allocation in holding {i}: {allocation}")
                return False
            
            total_allocation += allocation
        
        # Check total allocation
        if abs(total_allocation - 1.0) > 0.01:
            logger.error(f"Total allocation must sum to 1.0, got {total_allocation}")
            return False
        
        return True
    
    def normalize_allocations(self) -> None:
        """Normalize allocations to sum to 1.0"""
        total = sum(holding['allocation'] for holding in self.holdings)
        if total > 0:
            for holding in self.holdings:
                holding['allocation'] = holding['allocation'] / total

# Utility functions for configuration management

def save_config_to_file(config: BaseStrategyConfig, filename: str) -> None:
    """Save configuration to JSON file"""
    try:
        with open(filename, 'w') as f:
            json.dump(config.to_dict(), f, indent=2)
        logger.info(f"Configuration saved to {filename}")
    except Exception as e:
        logger.error(f"Error saving configuration: {str(e)}")
        raise

def load_config_from_file(filename: str) -> BaseStrategyConfig:
    """Load configuration from JSON file"""
    try:
        with open(filename, 'r') as f:
            data = json.load(f)
        
        config = StrategyConfigFactory.from_dict(data)
        logger.info(f"Configuration loaded from {filename}")
        return config
    except Exception as e:
        logger.error(f"Error loading configuration: {str(e)}")
        raise

# Example usage and testing
if __name__ == "__main__":
    print("Testing Strategy Configuration Classes")
    print("=" * 50)
    
    # Test momentum strategy configuration
    momentum_config = MomentumConfig(lookback_period=120, top_n=5)
    print(f"Momentum config valid: {momentum_config.validate()}")
    print(f"Momentum config dict: {momentum_config.to_dict()}")
    
    # Test creating from factory
    print("\nTesting Strategy Factory:")
    
    config_data = {
        'type': 'risk_parity',
        'parameters': {
            'volatility_window': 90,
            'min_weight': 0.1,
            'max_weight': 0.4
        }
    }
    
    risk_parity_config = StrategyConfigFactory.from_dict(config_data)
    print(f"Risk parity config: {risk_parity_config}")
    print(f"Valid: {risk_parity_config.validate()}")
    
    # Test portfolio configuration
    print("\nTesting Portfolio Configuration:")
    
    portfolio_config = PortfolioConfig([
        {'symbol': 'AAPL', 'allocation': 0.4},
        {'symbol': 'GOOGL', 'allocation': 0.3},
        {'symbol': 'MSFT', 'allocation': 0.3}
    ])
    
    print(f"Portfolio valid: {portfolio_config.validate()}")
    
    # Test available strategies
    print(f"\nAvailable strategies: {StrategyConfigFactory.get_available_strategies()}")
    
    print("\nAll tests completed!")
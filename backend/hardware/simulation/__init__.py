"""
Hardware Simulation Module
Provides realistic simulation of hardware devices for testing and development
"""

from .device_profiles import (
    DeviceProfile,
    SensorProfile,
    ActuatorProfile,
    RoverProfile,
    create_default_profiles
)

from .physics_simulator import (
    PhysicsSimulator,
    SensorPhysics,
    ActuatorPhysics,
    EnvironmentalConditions
)

from .network_simulator import (
    NetworkSimulator,
    NetworkCondition,
    NetworkProfile,
    create_network_profiles
)

from .scenario_manager import (
    ScenarioManager,
    Scenario,
    ScenarioStep,
    ScenarioPlayer
)

from .simulation_engine import (
    SimulationEngine,
    SimulationConfig,
    SimulationState
)

__all__ = [
    # Device Profiles
    'DeviceProfile',
    'SensorProfile',
    'ActuatorProfile',
    'RoverProfile',
    'create_default_profiles',
    
    # Physics
    'PhysicsSimulator',
    'SensorPhysics',
    'ActuatorPhysics',
    'EnvironmentalConditions',
    
    # Network
    'NetworkSimulator',
    'NetworkCondition',
    'NetworkProfile',
    'create_network_profiles',
    
    # Scenarios
    'ScenarioManager',
    'Scenario',
    'ScenarioStep',
    'ScenarioPlayer',
    
    # Engine
    'SimulationEngine',
    'SimulationConfig',
    'SimulationState'
]
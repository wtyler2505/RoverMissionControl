#!/usr/bin/env python3
"""
Test the complete HAL simulation system including:
- Simulation engine
- Device profiles
- Physics simulation
- Network simulation
- Scenario execution
"""

import asyncio
import sys
import logging
import json
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Import HAL components
from hardware.simulation.simulation_engine import (
    SimulationEngine, SimulationConfig, SimulationMode, SimulationState
)
from hardware.simulation.device_profiles import (
    create_default_profiles, SensorType, ActuatorType
)
from hardware.simulation.physics_simulator import (
    PhysicsSimulator, EnvironmentalConditions, TerrainType
)
from hardware.simulation.network_simulator import (
    NetworkSimulator, create_network_profiles
)
from hardware.simulation.scenario_manager import (
    ScenarioManager, Scenario, ScenarioStep, ScenarioActionType, ScenarioStatus
)
from hardware.simulation.hal_integration import HALSimulationIntegration

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SimulationSystemTester:
    """Test the complete HAL simulation system"""
    
    def __init__(self):
        self.passed_tests = 0
        self.failed_tests = 0
    
    def print_header(self, title):
        """Print a section header"""
        print(f"\n{'=' * 60}")
        print(f"{title.center(60)}")
        print(f"{'=' * 60}")
    
    def print_test(self, test_name, passed, error=None):
        """Print test result"""
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} {test_name}")
        if error:
            print(f"       Error: {error}")
        
        if passed:
            self.passed_tests += 1
        else:
            self.failed_tests += 1
    
    async def test_simulation_engine(self):
        """Test basic simulation engine functionality"""
        print("\nTesting Simulation Engine...")
        
        try:
            # Create simulation engine
            config = SimulationConfig(
                simulation_rate=10.0,  # 10 Hz
                time_acceleration=2.0,  # 2x speed
                enable_physics=True,
                enable_network_simulation=True
            )
            engine = SimulationEngine(config)
            
            # Load device profiles
            profiles = create_default_profiles()
            
            # Start simulation
            await engine.start(SimulationMode.REALTIME)
            self.print_test("Engine started", engine.state == SimulationState.RUNNING)
            
            # Add a temperature sensor
            temp_profile = profiles.get("temp_sensor")
            if temp_profile:
                adapter = await engine.add_device(temp_profile)
                self.print_test("Temperature sensor added", adapter is not None)
            
            # Add an IMU sensor
            imu_profile = profiles.get("imu_sensor")
            if imu_profile:
                adapter = await engine.add_device(imu_profile)
                self.print_test("IMU sensor added", adapter is not None)
            
            # Add a motor
            motor_profile = profiles.get("dc_motor")
            if motor_profile:
                adapter = await engine.add_device(motor_profile)
                self.print_test("DC motor added", adapter is not None)
            
            # Let simulation run briefly
            await asyncio.sleep(1.0)
            
            # Check simulation metrics
            metrics = engine.get_metrics()
            self.print_test("Metrics available", metrics is not None)
            
            # Stop simulation
            await engine.stop()
            self.print_test("Engine stopped", engine.state == SimulationState.STOPPED)
            
        except Exception as e:
            self.print_test("Simulation engine test", False, str(e))
    
    async def test_physics_simulation(self):
        """Test physics simulation"""
        print("\nTesting Physics Simulation...")
        
        try:
            # Create physics simulator
            physics = PhysicsSimulator()
            
            # Set environmental conditions
            conditions = EnvironmentalConditions(
                temperature=25.0,  # 25°C
                pressure=101325.0,  # 1 atm
                humidity=60.0,  # 60%
                wind_speed=5.0,  # 5 m/s
                terrain_type=TerrainType.SANDY
            )
            physics.set_environment(conditions)
            self.print_test("Environment set", physics.env == conditions)
            
            # Update physics
            physics.update(0.1)  # 100ms update
            self.print_test("Physics update", True)
            
        except Exception as e:
            self.print_test("Physics simulation test", False, str(e))
    
    async def test_network_simulation(self):
        """Test network simulation"""
        print("\nTesting Network Simulation...")
        
        try:
            # Create network profiles
            profiles = create_network_profiles()
            
            # Test WiFi profile
            wifi_profile = profiles.get("wifi_good")
            if wifi_profile:
                network = NetworkSimulator(wifi_profile)
                await network.start()
                
                # Simulate packet transmission
                result = await network.send_packet(b'x' * 1024, "test_source")  # 1KB packet
                self.print_test("WiFi packet transmission", result is not None)
                
                await network.stop()
            
            # Test poor network conditions
            poor_profile = profiles.get("cellular_poor")
            if poor_profile:
                network = NetworkSimulator(poor_profile)
                await network.start()
                
                # Check expected packet loss
                delivered = 0
                for _ in range(10):
                    result = await network.send_packet(b'x' * 512, "test_source")
                    if result:  # send_packet returns bool
                        delivered += 1
                
                # Should have some packet loss
                self.print_test("Poor network packet loss", delivered < 10)
                
                await network.stop()
            
        except Exception as e:
            self.print_test("Network simulation test", False, str(e))
    
    async def test_hal_integration(self):
        """Test HAL integration with simulation"""
        print("\nTesting HAL Integration...")
        
        try:
            # Create HAL integration
            integration = HALSimulationIntegration()
            
            # Initialize with config
            config = {
                "simulation_rate": 50.0,
                "enable_physics": True,
                "enable_network_simulation": True
            }
            await integration.initialize(config)
            self.print_test("HAL integration initialized", True)
            
            # Start simulation
            await integration.start_simulation()
            self.print_test("HAL simulation started", True)
            
            # Add simulated devices
            temp_id = await integration.add_simulated_device("temp_sensor")
            self.print_test("Temperature sensor added via HAL", temp_id is not None)
            
            imu_id = await integration.add_simulated_device("imu_sensor")
            self.print_test("IMU sensor added via HAL", imu_id is not None)
            
            # Get device list
            devices = await integration.get_simulated_devices()
            self.print_test("Device list retrieved", len(devices) == 2)
            
            # Send command to temperature sensor
            try:
                command = {"action": "read"}
                response = await integration.send_command(temp_id, command)
                self.print_test("Command sent to sensor", response is not None)
            except Exception as e:
                self.print_test("Command sent to sensor", False, str(e))
            
            # Get telemetry
            telemetry = await integration.get_device_telemetry(temp_id)
            self.print_test("Telemetry retrieved", telemetry is not None)
            
            # Update device state
            new_state = {"calibration_offset": 0.5}
            await integration.update_device_state(temp_id, new_state)
            self.print_test("Device state updated", True)
            
            # Remove device
            await integration.remove_simulated_device(temp_id)
            devices = await integration.get_simulated_devices()
            self.print_test("Device removed", len(devices) == 1)
            
            # Stop simulation
            await integration.stop_simulation()
            self.print_test("HAL simulation stopped", True)
            
        except Exception as e:
            self.print_test("HAL integration test", False, str(e))
    
    async def test_scenario_execution(self):
        """Test scenario execution"""
        print("\nTesting Scenario Execution...")
        
        try:
            # Create simulation engine with scenario support
            scenarios_dir = Path("test_scenarios")
            scenarios_dir.mkdir(exist_ok=True)
            config = SimulationConfig(
                scenarios_directory=scenarios_dir,
                enable_physics=True,
                enable_network_simulation=True
            )
            engine = SimulationEngine(config)
            manager = engine.scenario_manager
            
            # Create a test scenario
            scenario = manager.create_scenario(
                "Test Rover Operations",
                "Test basic rover operations including sensors and actuators"
            )
            
            # Add setup steps
            scenario.setup_steps.append(ScenarioStep(
                step_id="setup_1",
                action_type=ScenarioActionType.LOG_MESSAGE,
                parameters={"message": "Starting test scenario", "level": "info"},
                description="Log start message"
            ))
            
            # Add main steps
            scenario.steps.extend([
                ScenarioStep(
                    step_id="step_1",
                    action_type=ScenarioActionType.WAIT,
                    parameters={"duration": 0.5},
                    description="Wait 500ms"
                ),
                ScenarioStep(
                    step_id="step_2",
                    action_type=ScenarioActionType.SET_ENVIRONMENT,
                    parameters={
                        "temperature": 30.0,
                        "pressure": 100000.0,
                        "humidity": 40.0
                    },
                    description="Set hot environment"
                ),
                ScenarioStep(
                    step_id="step_3",
                    action_type=ScenarioActionType.CHECKPOINT,
                    parameters={"name": "environment_set"},
                    description="Save checkpoint"
                ),
                ScenarioStep(
                    step_id="step_4",
                    action_type=ScenarioActionType.LOG_MESSAGE,
                    parameters={"message": "Scenario completed", "level": "info"},
                    description="Log completion"
                )
            ])
            
            # Save scenario
            manager.save_scenario(scenario.scenario_id)
            self.print_test("Scenario created and saved", True)
            
            # Execute scenario
            context = await manager.execute_scenario(scenario.scenario_id)
            
            # Check execution results
            self.print_test("Scenario executed", context.status == ScenarioStatus.COMPLETED)
            self.print_test("All steps executed", len(context.executed_steps) == len(scenario.steps) + len(scenario.setup_steps))
            self.print_test("Checkpoint saved", "environment_set" in context.checkpoints)
            
            # Clean up
            import shutil
            shutil.rmtree(scenarios_dir, ignore_errors=True)
            
        except Exception as e:
            self.print_test("Scenario execution test", False, str(e))
    
    async def run_all_tests(self):
        """Run all simulation system tests"""
        self.print_header("HAL SIMULATION SYSTEM TEST SUITE")
        
        # Run tests
        await self.test_simulation_engine()
        await self.test_physics_simulation()
        await self.test_network_simulation()
        await self.test_hal_integration()
        await self.test_scenario_execution()
        
        # Print summary
        self.print_header("TEST SUMMARY")
        total_tests = self.passed_tests + self.failed_tests
        print(f"Tests passed: {self.passed_tests}/{total_tests}")
        
        if self.failed_tests == 0:
            print("\n[SUCCESS] ALL TESTS PASSED!")
        else:
            print(f"\n[ERROR] {self.failed_tests} TESTS FAILED")
        
        return self.failed_tests == 0


async def main():
    """Main test function"""
    tester = SimulationSystemTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
"""
Physics-based Simulation
Provides realistic physics simulation for sensors and actuators
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Tuple, Callable
from enum import Enum
import math
import random
from datetime import datetime, timedelta
import numpy as np


class TerrainType(Enum):
    """Types of terrain for rover simulation"""
    FLAT = "flat"
    ROCKY = "rocky"
    SANDY = "sandy"
    SLOPE = "slope"
    CRATER = "crater"


@dataclass
class Vector3:
    """3D vector for physics calculations"""
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    
    def __add__(self, other: 'Vector3') -> 'Vector3':
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)
    
    def __sub__(self, other: 'Vector3') -> 'Vector3':
        return Vector3(self.x - other.x, self.y - other.y, self.z - other.z)
    
    def __mul__(self, scalar: float) -> 'Vector3':
        return Vector3(self.x * scalar, self.y * scalar, self.z * scalar)
    
    def magnitude(self) -> float:
        return math.sqrt(self.x**2 + self.y**2 + self.z**2)
    
    def normalize(self) -> 'Vector3':
        mag = self.magnitude()
        if mag > 0:
            return Vector3(self.x/mag, self.y/mag, self.z/mag)
        return Vector3(0, 0, 0)
    
    def dot(self, other: 'Vector3') -> float:
        return self.x * other.x + self.y * other.y + self.z * other.z
    
    def cross(self, other: 'Vector3') -> 'Vector3':
        return Vector3(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x
        )


@dataclass
class EnvironmentalConditions:
    """Environmental conditions affecting sensors and actuators"""
    temperature: float = 20.0  # Celsius
    pressure: float = 101325.0  # Pascals
    humidity: float = 50.0  # Percentage
    
    # Atmospheric
    wind_speed: float = 0.0  # m/s
    wind_direction: float = 0.0  # degrees
    dust_density: float = 0.0  # mg/m³
    
    # Lighting
    solar_irradiance: float = 1000.0  # W/m²
    ambient_light: float = 10000.0  # lux
    
    # Magnetic field
    magnetic_field: Vector3 = field(default_factory=lambda: Vector3(0, 0, -50))  # μT
    
    # Gravity
    gravity: float = 9.81  # m/s²
    
    # Terrain
    terrain_type: TerrainType = TerrainType.FLAT
    terrain_slope: float = 0.0  # degrees
    terrain_roughness: float = 0.0  # 0.0 to 1.0
    
    # Radio environment
    radio_noise_floor: float = -90.0  # dBm
    multipath_severity: float = 0.0  # 0.0 to 1.0
    
    def get_temperature_effect(self, nominal_temp: float = 25.0) -> float:
        """Calculate temperature effect on electronics (simplified model)"""
        # Temperature coefficient: ~0.2% per degree C
        temp_diff = self.temperature - nominal_temp
        return 1.0 + (temp_diff * 0.002)
    
    def get_pressure_effect(self, nominal_pressure: float = 101325.0) -> float:
        """Calculate pressure effect (mainly for pressure sensors)"""
        return self.pressure / nominal_pressure
    
    def get_atmospheric_attenuation(self, frequency: float = 2.4e9) -> float:
        """Calculate radio signal attenuation due to atmosphere (dB/km)"""
        # Simplified model for atmospheric attenuation
        base_attenuation = 0.01  # dB/km at sea level
        
        # Dust effect
        dust_attenuation = self.dust_density * 0.001  # dB/km per mg/m³
        
        # Humidity effect (more significant at higher frequencies)
        humidity_factor = (self.humidity / 100.0) * (frequency / 1e9) * 0.01
        
        return base_attenuation + dust_attenuation + humidity_factor


@dataclass
class PhysicsState:
    """Physical state of an object"""
    position: Vector3 = field(default_factory=Vector3)
    velocity: Vector3 = field(default_factory=Vector3)
    acceleration: Vector3 = field(default_factory=Vector3)
    orientation: Vector3 = field(default_factory=Vector3)  # Roll, pitch, yaw in radians
    angular_velocity: Vector3 = field(default_factory=Vector3)
    
    # Forces and torques
    forces: List[Vector3] = field(default_factory=list)
    torques: List[Vector3] = field(default_factory=list)
    
    # Physical properties
    mass: float = 1.0  # kg
    inertia_tensor: np.ndarray = field(default_factory=lambda: np.eye(3))
    
    def apply_force(self, force: Vector3):
        """Apply a force to the object"""
        self.forces.append(force)
    
    def apply_torque(self, torque: Vector3):
        """Apply a torque to the object"""
        self.torques.append(torque)
    
    def update(self, dt: float):
        """Update physics state using Euler integration"""
        # Calculate net force and acceleration
        net_force = Vector3()
        for force in self.forces:
            net_force = net_force + force
        
        self.acceleration = net_force * (1.0 / self.mass)
        
        # Update velocity and position
        self.velocity = self.velocity + self.acceleration * dt
        self.position = self.position + self.velocity * dt
        
        # Calculate net torque and angular acceleration
        net_torque = Vector3()
        for torque in self.torques:
            net_torque = net_torque + torque
        
        # Simplified angular dynamics (assumes diagonal inertia tensor)
        angular_acceleration = Vector3(
            net_torque.x / self.inertia_tensor[0, 0],
            net_torque.y / self.inertia_tensor[1, 1],
            net_torque.z / self.inertia_tensor[2, 2]
        )
        
        # Update angular velocity and orientation
        self.angular_velocity = self.angular_velocity + angular_acceleration * dt
        self.orientation = self.orientation + self.angular_velocity * dt
        
        # Clear forces and torques for next frame
        self.forces.clear()
        self.torques.clear()


class SensorPhysics:
    """Physics simulation for various sensor types"""
    
    @staticmethod
    def simulate_temperature_sensor(
        true_temp: float,
        sensor_position: Vector3,
        env: EnvironmentalConditions,
        thermal_mass: float = 0.01,  # kg
        thermal_conductivity: float = 0.5  # W/(m·K)
    ) -> float:
        """Simulate temperature sensor reading with thermal dynamics"""
        # Add spatial temperature variation
        altitude_effect = -0.0065 * sensor_position.z  # -6.5°C per km altitude
        
        # Add temporal variation (simplified diurnal cycle)
        time_of_day = datetime.now().hour + datetime.now().minute / 60.0
        diurnal_variation = 5.0 * math.sin((time_of_day - 6) * math.pi / 12)
        
        # Local heating effects (e.g., from nearby electronics)
        local_heating = random.gauss(0, 0.5)
        
        # Wind cooling effect
        wind_cooling = -0.1 * env.wind_speed * math.sqrt(abs(true_temp - env.temperature))
        
        measured_temp = true_temp + altitude_effect + diurnal_variation + \
                       local_heating + wind_cooling
        
        return measured_temp
    
    @staticmethod
    def simulate_accelerometer(
        physics_state: PhysicsState,
        env: EnvironmentalConditions,
        sensor_axes: Tuple[Vector3, Vector3, Vector3] = None
    ) -> Tuple[float, float, float]:
        """Simulate 3-axis accelerometer readings"""
        if sensor_axes is None:
            # Default to aligned with world axes
            sensor_axes = (Vector3(1, 0, 0), Vector3(0, 1, 0), Vector3(0, 0, 1))
        
        # Total acceleration includes gravity
        gravity_vector = Vector3(0, 0, -env.gravity)
        total_acceleration = physics_state.acceleration + gravity_vector
        
        # Add vibration based on velocity and terrain
        vibration_magnitude = physics_state.velocity.magnitude() * env.terrain_roughness * 0.1
        vibration = Vector3(
            random.gauss(0, vibration_magnitude),
            random.gauss(0, vibration_magnitude),
            random.gauss(0, vibration_magnitude)
        )
        
        total_acceleration = total_acceleration + vibration
        
        # Project onto sensor axes
        ax = total_acceleration.dot(sensor_axes[0])
        ay = total_acceleration.dot(sensor_axes[1])
        az = total_acceleration.dot(sensor_axes[2])
        
        return (ax, ay, az)
    
    @staticmethod
    def simulate_gyroscope(
        physics_state: PhysicsState,
        env: EnvironmentalConditions,
        drift_rate: float = 0.01  # degrees/second
    ) -> Tuple[float, float, float]:
        """Simulate 3-axis gyroscope readings"""
        # Convert angular velocity to degrees/second
        wx = math.degrees(physics_state.angular_velocity.x)
        wy = math.degrees(physics_state.angular_velocity.y)
        wz = math.degrees(physics_state.angular_velocity.z)
        
        # Add drift
        drift_x = drift_rate * (2 * random.random() - 1)
        drift_y = drift_rate * (2 * random.random() - 1)
        drift_z = drift_rate * (2 * random.random() - 1)
        
        # Add noise proportional to rotation rate
        noise_factor = 0.01
        noise_x = random.gauss(0, abs(wx) * noise_factor + 0.1)
        noise_y = random.gauss(0, abs(wy) * noise_factor + 0.1)
        noise_z = random.gauss(0, abs(wz) * noise_factor + 0.1)
        
        return (wx + drift_x + noise_x, 
                wy + drift_y + noise_y, 
                wz + drift_z + noise_z)
    
    @staticmethod
    def simulate_magnetometer(
        sensor_position: Vector3,
        env: EnvironmentalConditions,
        hard_iron_offset: Vector3 = None,
        soft_iron_matrix: np.ndarray = None
    ) -> Tuple[float, float, float]:
        """Simulate 3-axis magnetometer readings"""
        # Start with environmental magnetic field
        mag_field = env.magnetic_field
        
        # Add local magnetic anomalies
        anomaly = Vector3(
            random.gauss(0, 2),
            random.gauss(0, 2),
            random.gauss(0, 2)
        )
        
        mag_field = mag_field + anomaly
        
        # Apply hard iron offset (permanent magnetization)
        if hard_iron_offset:
            mag_field = mag_field + hard_iron_offset
        
        # Apply soft iron effect (magnetic distortion)
        if soft_iron_matrix is not None:
            field_array = np.array([mag_field.x, mag_field.y, mag_field.z])
            distorted = soft_iron_matrix @ field_array
            mag_field = Vector3(distorted[0], distorted[1], distorted[2])
        
        return (mag_field.x, mag_field.y, mag_field.z)
    
    @staticmethod
    def simulate_gps(
        true_position: Vector3,
        env: EnvironmentalConditions,
        satellites_visible: int = 8,
        hdop: float = 1.5  # Horizontal dilution of precision
    ) -> Dict[str, float]:
        """Simulate GPS readings with realistic errors"""
        # Base accuracy depends on number of satellites
        base_accuracy = 5.0 * hdop / math.sqrt(max(4, satellites_visible))
        
        # Multipath effects
        multipath_error = env.multipath_severity * 2.0
        
        # Atmospheric effects
        ionospheric_error = random.gauss(0, 1.0)
        tropospheric_error = random.gauss(0, 0.5)
        
        # Total position error
        error_magnitude = base_accuracy + multipath_error + \
                         abs(ionospheric_error) + abs(tropospheric_error)
        
        # Random error direction
        error_angle = random.uniform(0, 2 * math.pi)
        error_x = error_magnitude * math.cos(error_angle)
        error_y = error_magnitude * math.sin(error_angle)
        error_z = random.gauss(0, error_magnitude * 1.5)  # Vertical error typically larger
        
        # Calculate position
        measured_position = true_position + Vector3(error_x, error_y, error_z)
        
        # Convert to lat/lon (simplified flat Earth approximation)
        earth_radius = 6371000  # meters
        latitude = measured_position.y / earth_radius * 180 / math.pi
        longitude = measured_position.x / (earth_radius * math.cos(math.radians(latitude))) * 180 / math.pi
        altitude = measured_position.z
        
        # Calculate velocity (with noise)
        velocity_error = random.gauss(0, 0.1)
        ground_speed = math.sqrt(true_position.x**2 + true_position.y**2) + velocity_error
        
        return {
            'latitude': latitude,
            'longitude': longitude,
            'altitude': altitude,
            'satellites': satellites_visible,
            'hdop': hdop,
            'ground_speed': ground_speed,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def simulate_lidar(
        sensor_position: Vector3,
        sensor_orientation: Vector3,
        env: EnvironmentalConditions,
        max_range: float = 100.0,  # meters
        beam_divergence: float = 0.001,  # radians
        num_points: int = 360
    ) -> List[Tuple[float, float]]:
        """Simulate LIDAR scan data"""
        scan_data = []
        
        for i in range(num_points):
            # Scan angle
            angle = (i / num_points) * 2 * math.pi
            
            # Add angular noise
            angle_noise = random.gauss(0, beam_divergence)
            scan_angle = angle + angle_noise
            
            # Simulate range measurement
            # In real implementation, this would ray-cast against terrain/obstacles
            base_range = random.uniform(1.0, max_range * 0.8)
            
            # Add range noise
            range_noise_factor = 0.002  # 0.2% of range
            range_noise = random.gauss(0, base_range * range_noise_factor)
            
            # Dust attenuation
            dust_attenuation = 1.0 - (env.dust_density / 1000.0)
            effective_range = (base_range + range_noise) * dust_attenuation
            
            # Limit to max range
            if effective_range > max_range or effective_range < 0:
                effective_range = max_range  # No return
            
            scan_data.append((scan_angle, effective_range))
        
        return scan_data


class ActuatorPhysics:
    """Physics simulation for various actuator types"""
    
    @staticmethod
    def simulate_dc_motor(
        command_voltage: float,
        current_speed: float,  # RPM
        load_torque: float,  # N·m
        motor_constant: float = 0.01,  # N·m/A
        resistance: float = 1.0,  # Ohms
        inductance: float = 0.001,  # Henries
        inertia: float = 0.0001,  # kg·m²
        friction: float = 0.0001,  # N·m·s/rad
        dt: float = 0.01  # Time step
    ) -> Tuple[float, float, float]:
        """Simulate DC motor dynamics"""
        # Convert speed to rad/s
        omega = current_speed * 2 * math.pi / 60
        
        # Back EMF
        back_emf = motor_constant * omega
        
        # Current (simplified, ignoring inductance dynamics)
        current = (command_voltage - back_emf) / resistance
        
        # Motor torque
        motor_torque = motor_constant * current
        
        # Net torque
        net_torque = motor_torque - load_torque - friction * omega
        
        # Angular acceleration
        alpha = net_torque / inertia
        
        # Update speed
        omega_new = omega + alpha * dt
        speed_new = omega_new * 60 / (2 * math.pi)  # Convert back to RPM
        
        # Power consumption
        power = command_voltage * current
        
        return speed_new, current, power
    
    @staticmethod
    def simulate_servo(
        target_position: float,  # degrees
        current_position: float,  # degrees
        max_speed: float = 60.0,  # degrees/second
        proportional_gain: float = 5.0,
        derivative_gain: float = 0.5,
        integral_gain: float = 0.1,
        dt: float = 0.01,
        integral_sum: float = 0.0
    ) -> Tuple[float, float]:
        """Simulate servo position control with PID"""
        # Position error
        error = target_position - current_position
        
        # Limit error to ±180 degrees
        while error > 180:
            error -= 360
        while error < -180:
            error += 360
        
        # PID control
        proportional = proportional_gain * error
        integral_sum += integral_gain * error * dt
        integral_sum = max(-max_speed, min(max_speed, integral_sum))  # Anti-windup
        
        # Approximate derivative (would need previous error in real implementation)
        derivative = -derivative_gain * (current_position / dt if dt > 0 else 0)
        
        # Control signal (desired velocity)
        control_signal = proportional + integral_sum + derivative
        
        # Limit to max speed
        desired_velocity = max(-max_speed, min(max_speed, control_signal))
        
        # Update position
        new_position = current_position + desired_velocity * dt
        
        # Add mechanical limits and backlash
        backlash = 0.5  # degrees
        if abs(desired_velocity) < 0.1:  # Dead zone
            new_position = current_position
        elif abs(error) < backlash:
            new_position = current_position
        
        return new_position, integral_sum
    
    @staticmethod
    def simulate_stepper_motor(
        step_command: int,  # Number of steps commanded
        current_step: int,  # Current step position
        steps_per_revolution: int = 200,
        max_step_rate: float = 1000,  # steps/second
        load_inertia: float = 0.0001,  # kg·m²
        holding_torque: float = 0.5,  # N·m
        detent_torque: float = 0.05,  # N·m
        miss_step_probability: float = 0.001
    ) -> Tuple[int, bool]:
        """Simulate stepper motor operation"""
        # Calculate step direction and distance
        step_delta = step_command - current_step
        step_direction = 1 if step_delta > 0 else -1 if step_delta < 0 else 0
        
        if step_direction == 0:
            return current_step, False
        
        # Check for missed steps under load
        if random.random() < miss_step_probability:
            # Missed step
            return current_step, True
        
        # Take one step
        new_step = current_step + step_direction
        
        # Add occasional stalling under heavy load
        acceleration_required = max_step_rate**2 * load_inertia
        torque_required = acceleration_required * 2 * math.pi / steps_per_revolution
        
        if torque_required > holding_torque:
            # Motor stalls
            return current_step, True
        
        return new_step, False


class PhysicsSimulator:
    """Main physics simulation engine"""
    
    def __init__(self):
        self.env = EnvironmentalConditions()
        self.objects: Dict[str, PhysicsState] = {}
        self.sensor_physics = SensorPhysics()
        self.actuator_physics = ActuatorPhysics()
        self.time = 0.0
        self.dt = 0.01  # 100 Hz simulation rate
    
    def add_object(self, object_id: str, physics_state: PhysicsState):
        """Add an object to the simulation"""
        self.objects[object_id] = physics_state
    
    def remove_object(self, object_id: str):
        """Remove an object from the simulation"""
        if object_id in self.objects:
            del self.objects[object_id]
    
    def set_environment(self, env: EnvironmentalConditions):
        """Update environmental conditions"""
        self.env = env
    
    def update(self, dt: Optional[float] = None):
        """Update physics simulation by one time step"""
        if dt is None:
            dt = self.dt
        
        # Update all physics objects
        for obj_id, state in self.objects.items():
            # Apply environmental forces
            self._apply_environmental_forces(state)
            
            # Update physics state
            state.update(dt)
        
        self.time += dt
    
    def _apply_environmental_forces(self, state: PhysicsState):
        """Apply environmental forces to an object"""
        # Gravity
        gravity_force = Vector3(0, 0, -state.mass * self.env.gravity)
        state.apply_force(gravity_force)
        
        # Wind resistance (simplified)
        if self.env.wind_speed > 0:
            # Assume some drag coefficient and area
            drag_coefficient = 0.5
            area = 0.1  # m²
            air_density = self.env.pressure / (287.05 * (self.env.temperature + 273.15))
            
            wind_force = Vector3(
                -drag_coefficient * area * air_density * self.env.wind_speed**2 * 0.5,
                0, 0
            )
            state.apply_force(wind_force)
    
    def get_simulation_time(self) -> float:
        """Get current simulation time"""
        return self.time
    
    def reset(self):
        """Reset simulation to initial state"""
        self.objects.clear()
        self.time = 0.0
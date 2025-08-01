"""
Device Behavior Profiles
Defines realistic behavior patterns for common hardware devices
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Callable, Tuple
from enum import Enum
import random
import math
from datetime import datetime, timedelta


class DeviceType(Enum):
    """Types of devices that can be simulated"""
    SENSOR = "sensor"
    ACTUATOR = "actuator"
    CONTROLLER = "controller"
    COMMUNICATION = "communication"
    POWER = "power"


class SensorType(Enum):
    """Common sensor types"""
    TEMPERATURE = "temperature"
    PRESSURE = "pressure"
    HUMIDITY = "humidity"
    ACCELEROMETER = "accelerometer"
    GYROSCOPE = "gyroscope"
    MAGNETOMETER = "magnetometer"
    GPS = "gps"
    LIDAR = "lidar"
    CAMERA = "camera"
    ULTRASONIC = "ultrasonic"
    CURRENT = "current"
    VOLTAGE = "voltage"


class ActuatorType(Enum):
    """Common actuator types"""
    MOTOR = "motor"
    SERVO = "servo"
    STEPPER = "stepper"
    RELAY = "relay"
    LED = "led"
    HEATER = "heater"
    VALVE = "valve"
    PUMP = "pump"


@dataclass
class NoiseProfile:
    """Defines noise characteristics for sensor readings"""
    gaussian_stddev: float = 0.0  # Standard deviation for Gaussian noise
    periodic_amplitude: float = 0.0  # Amplitude of periodic noise
    periodic_frequency: float = 1.0  # Frequency of periodic noise (Hz)
    random_walk_step: float = 0.0  # Step size for random walk drift
    spike_probability: float = 0.0  # Probability of random spikes
    spike_magnitude: float = 0.0  # Magnitude of spikes
    
    def apply_noise(self, value: float, time_offset: float = 0.0) -> float:
        """Apply noise to a sensor reading"""
        noisy_value = value
        
        # Gaussian noise
        if self.gaussian_stddev > 0:
            noisy_value += random.gauss(0, self.gaussian_stddev)
        
        # Periodic noise
        if self.periodic_amplitude > 0:
            noisy_value += self.periodic_amplitude * math.sin(
                2 * math.pi * self.periodic_frequency * time_offset
            )
        
        # Random spikes
        if random.random() < self.spike_probability:
            spike = self.spike_magnitude * (1 if random.random() > 0.5 else -1)
            noisy_value += spike
        
        return noisy_value


@dataclass
class ResponseProfile:
    """Defines device response characteristics"""
    delay_min: float = 0.0  # Minimum response delay (seconds)
    delay_max: float = 0.1  # Maximum response delay (seconds)
    rise_time: float = 0.0  # Time to reach target value (seconds)
    overshoot: float = 0.0  # Percentage overshoot (0.0 to 1.0)
    settling_time: float = 0.0  # Time to settle to final value (seconds)
    
    def get_response_delay(self) -> float:
        """Get randomized response delay"""
        return random.uniform(self.delay_min, self.delay_max)
    
    def calculate_response(self, current: float, target: float, elapsed: float) -> float:
        """Calculate response value with dynamics"""
        if elapsed < 0:
            return current
        
        if self.rise_time <= 0:
            return target
        
        # Simple exponential response with overshoot
        t_normalized = elapsed / self.rise_time
        
        if t_normalized >= 1.0:
            # Past rise time, handle settling
            if self.settling_time > 0 and elapsed < self.rise_time + self.settling_time:
                # Damped oscillation during settling
                settling_progress = (elapsed - self.rise_time) / self.settling_time
                overshoot_factor = self.overshoot * math.exp(-3 * settling_progress) * \
                                 math.cos(2 * math.pi * settling_progress)
                return target * (1 + overshoot_factor)
            else:
                return target
        
        # During rise time
        response = current + (target - current) * (1 - math.exp(-3 * t_normalized))
        
        # Add overshoot
        if self.overshoot > 0:
            overshoot_factor = self.overshoot * t_normalized * math.exp(-2 * t_normalized)
            response += (target - current) * overshoot_factor
        
        return response


@dataclass
class ErrorProfile:
    """Defines device error characteristics"""
    failure_rate: float = 0.0  # Probability of failure per operation
    recovery_time: float = 1.0  # Time to recover from failure (seconds)
    degradation_rate: float = 0.0  # Performance degradation over time
    intermittent_fault_rate: float = 0.0  # Rate of intermittent faults
    error_codes: List[str] = field(default_factory=list)  # Possible error codes
    
    def check_failure(self) -> Tuple[bool, Optional[str]]:
        """Check if device should fail"""
        if random.random() < self.failure_rate:
            error_code = random.choice(self.error_codes) if self.error_codes else "DEVICE_ERROR"
            return True, error_code
        return False, None


@dataclass
class DeviceProfile:
    """Base device behavior profile"""
    device_id: str
    device_type: DeviceType
    name: str
    model: str = "Generic"
    manufacturer: str = "SimCorp"
    
    # Operating parameters
    power_consumption: float = 0.0  # Watts
    operating_voltage: float = 5.0  # Volts
    operating_current: float = 0.0  # Amps
    
    # Environmental limits
    temp_min: float = -40.0  # Celsius
    temp_max: float = 85.0  # Celsius
    humidity_max: float = 95.0  # Percentage
    
    # Communication
    protocol: str = "serial"
    baud_rate: int = 115200
    response_format: str = "ascii"  # ascii, binary, json
    
    # Behavior profiles
    response_profile: ResponseProfile = field(default_factory=ResponseProfile)
    error_profile: ErrorProfile = field(default_factory=ErrorProfile)
    
    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def validate_operating_conditions(self, temp: float, humidity: float) -> bool:
        """Check if device can operate in given conditions"""
        return (self.temp_min <= temp <= self.temp_max and 
                humidity <= self.humidity_max)


@dataclass
class SensorProfile(DeviceProfile):
    """Sensor-specific behavior profile"""
    sensor_type: SensorType = SensorType.TEMPERATURE
    
    # Measurement characteristics
    range_min: float = 0.0
    range_max: float = 100.0
    resolution: float = 0.1
    accuracy: float = 1.0  # ± percentage
    sampling_rate: float = 10.0  # Hz
    
    # Calibration
    calibration_offset: float = 0.0
    calibration_scale: float = 1.0
    requires_warmup: bool = False
    warmup_time: float = 0.0  # Seconds
    
    # Noise and drift
    noise_profile: NoiseProfile = field(default_factory=NoiseProfile)
    drift_rate: float = 0.0  # Units per hour
    
    # Data processing
    averaging_samples: int = 1
    outlier_threshold: float = 3.0  # Standard deviations
    
    def __post_init__(self):
        self.device_type = DeviceType.SENSOR
        if not hasattr(self, 'response_format'):
            self.response_format = self._get_default_format()
    
    def _get_default_format(self) -> str:
        """Get default response format for sensor type"""
        format_map = {
            SensorType.GPS: "nmea",
            SensorType.CAMERA: "binary",
            SensorType.LIDAR: "binary",
        }
        return format_map.get(self.sensor_type, "ascii")
    
    def generate_reading(self, true_value: float, elapsed_time: float = 0.0) -> float:
        """Generate sensor reading with all effects applied"""
        # Clamp to sensor range
        value = max(self.range_min, min(self.range_max, true_value))
        
        # Apply calibration
        value = (value - self.calibration_offset) * self.calibration_scale
        
        # Apply drift
        if self.drift_rate != 0:
            drift = self.drift_rate * (elapsed_time / 3600.0)  # Convert to hours
            value += drift
        
        # Apply noise
        value = self.noise_profile.apply_noise(value, elapsed_time)
        
        # Quantize to resolution
        if self.resolution > 0:
            value = round(value / self.resolution) * self.resolution
        
        # Apply accuracy limits
        accuracy_factor = self.accuracy / 100.0
        accuracy_band = abs(value) * accuracy_factor
        value += random.uniform(-accuracy_band, accuracy_band)
        
        # Final clamp to range
        return max(self.range_min, min(self.range_max, value))


@dataclass
class ActuatorProfile(DeviceProfile):
    """Actuator-specific behavior profile"""
    actuator_type: ActuatorType = ActuatorType.MOTOR
    
    # Control characteristics
    control_type: str = "position"  # position, velocity, torque, pwm
    control_range_min: float = 0.0
    control_range_max: float = 100.0
    
    # Physical limits
    max_speed: float = 100.0  # Units/second
    max_acceleration: float = 50.0  # Units/second²
    max_force: float = 10.0  # Newtons
    
    # Feedback
    has_feedback: bool = True
    feedback_type: str = "encoder"  # encoder, potentiometer, current
    feedback_resolution: float = 0.1
    
    # Safety limits
    current_limit: float = 1.0  # Amps
    temperature_limit: float = 80.0  # Celsius
    duty_cycle_limit: float = 1.0  # 0.0 to 1.0
    
    # Mechanical characteristics
    backlash: float = 0.0  # Units
    friction: float = 0.1  # Coefficient
    inertia: float = 0.01  # kg·m²
    
    def __post_init__(self):
        self.device_type = DeviceType.ACTUATOR
    
    def calculate_motion(self, current_pos: float, target_pos: float, 
                        elapsed_time: float, velocity: float = 0.0) -> Tuple[float, float]:
        """Calculate position and velocity with physical constraints"""
        if elapsed_time <= 0:
            return current_pos, velocity
        
        # Simple motion profile with acceleration limits
        distance = target_pos - current_pos
        direction = 1 if distance > 0 else -1
        
        # Apply backlash
        if abs(distance) < self.backlash:
            return current_pos, 0.0
        
        # Calculate desired velocity
        desired_velocity = direction * min(self.max_speed, abs(distance) / 0.1)
        
        # Apply acceleration limits
        velocity_change = desired_velocity - velocity
        max_velocity_change = self.max_acceleration * elapsed_time
        
        if abs(velocity_change) > max_velocity_change:
            velocity_change = direction * max_velocity_change
        
        new_velocity = velocity + velocity_change
        
        # Apply friction
        new_velocity *= (1 - self.friction * elapsed_time)
        
        # Calculate new position
        avg_velocity = (velocity + new_velocity) / 2
        new_position = current_pos + avg_velocity * elapsed_time
        
        # Check if we've reached or passed the target
        if (direction > 0 and new_position >= target_pos) or \
           (direction < 0 and new_position <= target_pos):
            return target_pos, 0.0
        
        return new_position, new_velocity


@dataclass
class RoverProfile:
    """Complete rover system profile"""
    rover_id: str
    name: str
    
    # Physical characteristics
    mass: float = 50.0  # kg
    dimensions: Tuple[float, float, float] = (1.0, 0.8, 0.6)  # Length, width, height (meters)
    wheel_diameter: float = 0.2  # meters
    wheel_base: float = 0.6  # meters
    track_width: float = 0.5  # meters
    
    # Power system
    battery_capacity: float = 100.0  # Wh
    solar_panel_power: float = 20.0  # Watts
    idle_power: float = 5.0  # Watts
    
    # Locomotion
    max_speed: float = 1.0  # m/s
    max_turn_rate: float = 45.0  # degrees/s
    max_climb_angle: float = 30.0  # degrees
    
    # Sensors
    sensors: List[SensorProfile] = field(default_factory=list)
    
    # Actuators
    actuators: List[ActuatorProfile] = field(default_factory=list)
    
    # Communication
    comm_range: float = 1000.0  # meters
    comm_power: float = 2.0  # Watts
    data_rate: float = 115200  # bps
    
    def calculate_power_consumption(self, speed: float = 0.0, 
                                  sensors_active: int = 0,
                                  comm_active: bool = False) -> float:
        """Calculate total power consumption"""
        power = self.idle_power
        
        # Locomotion power (simplified model)
        if speed > 0:
            power += 10.0 * (speed / self.max_speed) ** 2
        
        # Sensor power
        if self.sensors:
            active_sensors = min(sensors_active, len(self.sensors))
            power += sum(s.power_consumption for s in self.sensors[:active_sensors])
        
        # Communication power
        if comm_active:
            power += self.comm_power
        
        return power


def create_default_profiles() -> Dict[str, DeviceProfile]:
    """Create a set of default device profiles for common hardware"""
    profiles = {}
    
    # Temperature sensor
    temp_sensor = SensorProfile(
        device_id="temp_sensor_01",
        device_type=DeviceType.SENSOR,
        name="Temperature Sensor",
        model="DS18B20",
        sensor_type=SensorType.TEMPERATURE,
        range_min=-55.0,
        range_max=125.0,
        resolution=0.0625,
        accuracy=0.5,
        sampling_rate=1.0,
        power_consumption=0.001,
        noise_profile=NoiseProfile(gaussian_stddev=0.1),
        response_profile=ResponseProfile(delay_min=0.75, delay_max=0.85)
    )
    profiles["temp_sensor"] = temp_sensor
    
    # IMU (Accelerometer + Gyroscope)
    imu_sensor = SensorProfile(
        device_id="imu_sensor_01",
        device_type=DeviceType.SENSOR,
        name="6-DOF IMU",
        model="MPU6050",
        sensor_type=SensorType.ACCELEROMETER,
        range_min=-16.0,
        range_max=16.0,
        resolution=0.001,
        accuracy=2.0,
        sampling_rate=100.0,
        power_consumption=0.005,
        noise_profile=NoiseProfile(
            gaussian_stddev=0.05,
            periodic_amplitude=0.02,
            periodic_frequency=50.0  # Power line interference
        ),
        response_profile=ResponseProfile(delay_min=0.001, delay_max=0.002)
    )
    profiles["imu_sensor"] = imu_sensor
    
    # GPS
    gps_sensor = SensorProfile(
        device_id="gps_sensor_01",
        device_type=DeviceType.SENSOR,
        name="GPS Module",
        model="NEO-6M",
        sensor_type=SensorType.GPS,
        range_min=-180.0,
        range_max=180.0,
        resolution=0.000001,
        accuracy=2.5,  # meters
        sampling_rate=1.0,
        power_consumption=0.05,
        requires_warmup=True,
        warmup_time=30.0,
        noise_profile=NoiseProfile(
            gaussian_stddev=1.0,
            random_walk_step=0.0001
        ),
        response_profile=ResponseProfile(delay_min=1.0, delay_max=1.5)
    )
    profiles["gps_sensor"] = gps_sensor
    
    # DC Motor
    dc_motor = ActuatorProfile(
        device_id="dc_motor_01",
        device_type=DeviceType.ACTUATOR,
        name="Drive Motor",
        model="775 DC Motor",
        actuator_type=ActuatorType.MOTOR,
        control_type="velocity",
        control_range_min=-100.0,
        control_range_max=100.0,
        max_speed=300.0,  # RPM
        max_acceleration=200.0,  # RPM/s
        power_consumption=20.0,
        current_limit=5.0,
        has_feedback=True,
        feedback_type="encoder",
        feedback_resolution=1.0,
        response_profile=ResponseProfile(
            delay_min=0.01,
            delay_max=0.02,
            rise_time=0.2,
            overshoot=0.1,
            settling_time=0.5
        ),
        backlash=2.0,
        friction=0.05
    )
    profiles["dc_motor"] = dc_motor
    
    # Servo
    servo = ActuatorProfile(
        device_id="servo_01",
        device_type=DeviceType.ACTUATOR,
        name="Camera Servo",
        model="SG90",
        actuator_type=ActuatorType.SERVO,
        control_type="position",
        control_range_min=0.0,
        control_range_max=180.0,
        max_speed=60.0,  # degrees/second
        max_acceleration=200.0,
        power_consumption=0.5,
        current_limit=0.5,
        has_feedback=False,
        response_profile=ResponseProfile(
            delay_min=0.005,
            delay_max=0.01,
            rise_time=0.12,
            overshoot=0.05
        ),
        backlash=1.0
    )
    profiles["servo"] = servo
    
    # Complete rover
    rover = RoverProfile(
        rover_id="rover_01",
        name="Mars Explorer Mk1",
        mass=45.0,
        dimensions=(1.2, 0.9, 0.7),
        wheel_diameter=0.25,
        max_speed=0.5,
        battery_capacity=200.0,
        sensors=[temp_sensor, imu_sensor, gps_sensor],
        actuators=[dc_motor, servo]
    )
    profiles["rover"] = rover
    
    return profiles
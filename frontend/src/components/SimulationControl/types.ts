/**
 * Type definitions for simulation control components
 */

export enum SimulationMode {
  REALTIME = 'realtime',
  ACCELERATED = 'accelerated',
  STEP = 'step',
  PLAYBACK = 'playback'
}

export enum SimulationState {
  STOPPED = 'stopped',
  RUNNING = 'running',
  PAUSED = 'paused',
  ERROR = 'error'
}

export enum DeviceType {
  SENSOR = 'sensor',
  ACTUATOR = 'actuator',
  CONTROLLER = 'controller',
  COMMUNICATION = 'communication',
  POWER = 'power'
}

export enum SensorType {
  TEMPERATURE = 'temperature',
  PRESSURE = 'pressure',
  HUMIDITY = 'humidity',
  ACCELEROMETER = 'accelerometer',
  GYROSCOPE = 'gyroscope',
  MAGNETOMETER = 'magnetometer',
  GPS = 'gps',
  LIDAR = 'lidar',
  CAMERA = 'camera',
  ULTRASONIC = 'ultrasonic',
  CURRENT = 'current',
  VOLTAGE = 'voltage'
}

export enum ActuatorType {
  MOTOR = 'motor',
  SERVO = 'servo',
  STEPPER = 'stepper',
  RELAY = 'relay',
  LED = 'led',
  HEATER = 'heater',
  VALVE = 'valve',
  PUMP = 'pump'
}

export enum TerrainType {
  FLAT = 'flat',
  ROCKY = 'rocky',
  SANDY = 'sandy',
  SLOPE = 'slope',
  CRATER = 'crater'
}

export enum NetworkConditionType {
  PERFECT = 'perfect',
  SATELLITE = 'satellite',
  CELLULAR_4G = 'cellular_4g',
  CELLULAR_3G = 'cellular_3g',
  WIFI_GOOD = 'wifi_good',
  WIFI_POOR = 'wifi_poor',
  CONGESTED = 'congested',
  INTERMITTENT = 'intermittent',
  CUSTOM = 'custom'
}

export interface NoiseProfile {
  gaussianStddev: number;
  periodicAmplitude: number;
  periodicFrequency: number;
  randomWalkStep: number;
  spikeProbability: number;
  spikeMagnitude: number;
}

export interface ResponseProfile {
  delayMin: number;
  delayMax: number;
  riseTime: number;
  overshoot: number;
  settlingTime: number;
}

export interface ErrorProfile {
  failureRate: number;
  recoveryTime: number;
  degradationRate: number;
  intermittentFaultRate: number;
  errorCodes: string[];
}

export interface DeviceProfile {
  deviceId: string;
  deviceType: DeviceType;
  name: string;
  model: string;
  manufacturer: string;
  powerConsumption: number;
  operatingVoltage: number;
  operatingCurrent: number;
  tempMin: number;
  tempMax: number;
  humidityMax: number;
  protocol: string;
  baudRate: number;
  responseFormat: string;
  responseProfile: ResponseProfile;
  errorProfile: ErrorProfile;
  metadata?: Record<string, any>;
}

export interface SensorProfile extends DeviceProfile {
  sensorType: SensorType;
  rangeMin: number;
  rangeMax: number;
  resolution: number;
  accuracy: number;
  samplingRate: number;
  calibrationOffset: number;
  calibrationScale: number;
  requiresWarmup: boolean;
  warmupTime: number;
  noiseProfile: NoiseProfile;
  driftRate: number;
  averagingSamples: number;
  outlierThreshold: number;
}

export interface ActuatorProfile extends DeviceProfile {
  actuatorType: ActuatorType;
  controlType: string;
  controlRangeMin: number;
  controlRangeMax: number;
  maxSpeed: number;
  maxAcceleration: number;
  maxForce: number;
  hasFeedback: boolean;
  feedbackType: string;
  feedbackResolution: number;
  currentLimit: number;
  temperatureLimit: number;
  dutyCycleLimit: number;
  backlash: number;
  friction: number;
  inertia: number;
}

export interface NetworkProfile {
  name: string;
  latencyBase: number;
  latencyVariation: number;
  latencySpikeProbability: number;
  latencySpikeMultiplier: number;
  packetLossRate: number;
  burstLossProbability: number;
  burstLossDuration: number;
  bandwidthLimit: number;
  bandwidthVariation: number;
  connectionDropRate: number;
  connectionRecoveryTime: number;
  corruptionRate: number;
  duplicationRate: number;
  reorderRate: number;
  reorderDelay: number;
  uploadMultiplier: number;
  enableTimePatterns: boolean;
  peakHours: number[];
  peakDegradation: number;
}

export interface EnvironmentalConditions {
  temperature: number;
  pressure: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  dustDensity: number;
  solarIrradiance: number;
  ambientLight: number;
  magneticField: { x: number; y: number; z: number };
  gravity: number;
  terrainType: TerrainType;
  terrainSlope: number;
  terrainRoughness: number;
  radioNoiseFloor: number;
  multipathSeverity: number;
}

export interface ScenarioStep {
  stepId: string;
  actionType: string;
  parameters: Record<string, any>;
  description: string;
  delayBefore: number;
  timeout: number;
  skipCondition?: Record<string, any>;
  retryCount: number;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface Scenario {
  scenarioId: string;
  name: string;
  description: string;
  version: string;
  steps: ScenarioStep[];
  setupSteps: ScenarioStep[];
  teardownSteps: ScenarioStep[];
  variables: Record<string, any>;
  author: string;
  createdAt: string;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface SimulationEvent {
  timestamp: string;
  eventType: string;
  source: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SimulationConfig {
  simulationRate: number;
  timeAcceleration: number;
  enableRecording: boolean;
  recordingBufferSize: number;
  autoSaveInterval: number;
  enablePhysics: boolean;
  physicsRate: number;
  enableNetworkSimulation: boolean;
  defaultNetworkProfile: string;
  autoDiscoverDevices: boolean;
  deviceStartupDelay: number;
  maxConcurrentDevices: number;
  eventQueueSize: number;
  verboseLogging: boolean;
  debugMode: boolean;
}

export interface SimulationStats {
  simulationTime: number;
  realTime: number;
  devicesActive: number;
  eventsProcessed: number;
  cpuUsage: number;
  memoryUsage: number;
  networkStats?: {
    packetsSent: number;
    packetsReceived: number;
    packetsLost: number;
    avgLatency: number;
    bandwidth: number;
  };
}

export interface DeviceState {
  deviceId: string;
  profile: DeviceProfile;
  connected: boolean;
  lastActivity: string;
  sensorData?: Record<string, any>;
  actuatorState?: Record<string, any>;
  errors: string[];
  metadata?: Record<string, any>;
}
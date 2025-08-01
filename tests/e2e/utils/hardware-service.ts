import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import WebSocket from 'ws';

const execAsync = promisify(exec);

/**
 * Hardware Service for E2E Tests
 * 
 * Manages hardware simulators and mock devices for testing.
 * Provides realistic hardware behavior without requiring physical devices.
 */
export class HardwareService {
  private simulators: Map<string, ChildProcess> = new Map();
  private wsConnections: Map<string, WebSocket> = new Map();

  /**
   * Start all hardware simulators
   */
  async startSimulators(): Promise<void> {
    console.log('🔧 Starting hardware simulators...');

    try {
      await Promise.all([
        this.startArduinoSimulator(),
        this.startESP32Simulator(),
        this.startCameraSimulator(),
        this.startSensorSimulator()
      ]);

      // Wait for simulators to be ready
      await this.waitForSimulatorsReady();

      console.log('✅ All hardware simulators started');
    } catch (error) {
      console.error('❌ Failed to start hardware simulators:', error);
      await this.stopSimulators();
      throw error;
    }
  }

  /**
   * Stop all hardware simulators
   */
  async stopSimulators(): Promise<void> {
    console.log('🛑 Stopping hardware simulators...');

    // Close WebSocket connections
    for (const [name, ws] of this.wsConnections) {
      try {
        ws.close();
        console.log(`📡 Closed WebSocket for ${name}`);
      } catch (error) {
        console.warn(`Failed to close WebSocket for ${name}:`, error);
      }
    }
    this.wsConnections.clear();

    // Stop simulator processes
    for (const [name, process] of this.simulators) {
      try {
        process.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          process.on('exit', resolve);
          setTimeout(resolve, 5000); // Force kill after 5 seconds
        });
        
        console.log(`🔧 Stopped simulator: ${name}`);
      } catch (error) {
        console.warn(`Failed to stop simulator ${name}:`, error);
        // Force kill if graceful shutdown failed
        try {
          process.kill('SIGKILL');
        } catch (killError) {
          console.warn(`Failed to force kill ${name}:`, killError);
        }
      }
    }
    this.simulators.clear();

    console.log('✅ All hardware simulators stopped');
  }

  /**
   * Start Arduino rover simulator
   */
  private async startArduinoSimulator(): Promise<void> {
    const simulatorScript = `
import asyncio
import websockets
import json
import time
import random
from datetime import datetime

class ArduinoRoverSimulator:
    def __init__(self):
        self.battery_voltage = 12.0
        self.motor_current = 1.5
        self.position = {'x': 0, 'y': 0, 'heading': 0}
        self.is_moving = False
        
    async def handle_command(self, websocket, command):
        try:
            cmd = json.loads(command)
            response = {'command_id': cmd.get('command_id'), 'status': 'success'}
            
            if cmd['type'] == 'move':
                self.is_moving = True
                direction = cmd['parameters']['direction']
                speed = cmd['parameters']['speed']
                duration = cmd['parameters']['duration']
                
                # Simulate movement
                await asyncio.sleep(duration / 1000)  # Convert ms to seconds
                self.is_moving = False
                
                response['result'] = 'Movement completed'
                
            elif cmd['type'] == 'get_status':
                response['result'] = {
                    'battery_voltage': self.battery_voltage,
                    'motor_current': self.motor_current,
                    'position': self.position,
                    'is_moving': self.is_moving
                }
                
            await websocket.send(json.dumps(response))
            
        except Exception as e:
            error_response = {
                'command_id': cmd.get('command_id', 'unknown'),
                'status': 'error',
                'error': str(e)
            }
            await websocket.send(json.dumps(error_response))
    
    async def send_telemetry(self, websocket):
        while True:
            try:
                # Add some realistic variation
                self.battery_voltage += random.uniform(-0.1, 0.1)
                self.battery_voltage = max(10.0, min(14.0, self.battery_voltage))
                
                if self.is_moving:
                    self.motor_current = 2.0 + random.uniform(-0.2, 0.2)
                else:
                    self.motor_current = 0.5 + random.uniform(-0.1, 0.1)
                
                telemetry = {
                    'type': 'telemetry',
                    'device_id': 'arduino_rover_01',
                    'timestamp': datetime.now().isoformat(),
                    'data': {
                        'battery_voltage': round(self.battery_voltage, 2),
                        'motor_current': round(self.motor_current, 2),
                        'position': self.position,
                        'is_moving': self.is_moving
                    }
                }
                
                await websocket.send(json.dumps(telemetry))
                await asyncio.sleep(1)  # Send telemetry every second
                
            except websockets.exceptions.ConnectionClosed:
                break
            except Exception as e:
                print(f"Telemetry error: {e}")
                await asyncio.sleep(5)
    
    async def handle_client(self, websocket, path):
        print(f"Arduino simulator connected: {path}")
        
        # Start telemetry task
        telemetry_task = asyncio.create_task(self.send_telemetry(websocket))
        
        try:
            async for message in websocket:
                await self.handle_command(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            print("Arduino simulator disconnected")
        finally:
            telemetry_task.cancel()

# Start the simulator
simulator = ArduinoRoverSimulator()
start_server = websockets.serve(simulator.handle_client, "localhost", 8801)

print("Arduino Rover Simulator started on ws://localhost:8801")
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
`;

    await this.startPythonSimulator('arduino', simulatorScript, 8801);
  }

  /**
   * Start ESP32 sensor simulator
   */
  private async startESP32Simulator(): Promise<void> {
    const simulatorScript = `
import asyncio
import websockets
import json
import time
import random
from datetime import datetime

class ESP32SensorSimulator:
    def __init__(self):
        self.temperature = 25.0
        self.humidity = 50.0
        self.pressure = 1013.25
        self.light_level = 500
        
    async def handle_command(self, websocket, command):
        try:
            cmd = json.loads(command)
            response = {'command_id': cmd.get('command_id'), 'status': 'success'}
            
            if cmd['type'] == 'calibrate':
                sensor_type = cmd['parameters']['sensor_type']
                # Simulate calibration
                await asyncio.sleep(2)
                response['result'] = f'{sensor_type} sensor calibrated'
                
            elif cmd['type'] == 'get_readings':
                response['result'] = {
                    'temperature': self.temperature,
                    'humidity': self.humidity,
                    'pressure': self.pressure,
                    'light_level': self.light_level
                }
                
            await websocket.send(json.dumps(response))
            
        except Exception as e:
            error_response = {
                'command_id': cmd.get('command_id', 'unknown'),
                'status': 'error',
                'error': str(e)
            }
            await websocket.send(json.dumps(error_response))
    
    async def send_telemetry(self, websocket):
        while True:
            try:
                # Simulate realistic environmental changes
                self.temperature += random.uniform(-0.5, 0.5)
                self.temperature = max(15.0, min(35.0, self.temperature))
                
                self.humidity += random.uniform(-2.0, 2.0)
                self.humidity = max(30.0, min(80.0, self.humidity))
                
                self.pressure += random.uniform(-1.0, 1.0)
                self.pressure = max(950.0, min(1050.0, self.pressure))
                
                self.light_level += random.uniform(-50, 50)
                self.light_level = max(0, min(1000, self.light_level))
                
                telemetry = {
                    'type': 'telemetry',
                    'device_id': 'esp32_sensor_01',
                    'timestamp': datetime.now().isoformat(),
                    'data': {
                        'temperature': round(self.temperature, 1),
                        'humidity': round(self.humidity, 1),
                        'pressure': round(self.pressure, 2),
                        'light_level': int(self.light_level)
                    }
                }
                
                await websocket.send(json.dumps(telemetry))
                await asyncio.sleep(2)  # Send telemetry every 2 seconds
                
            except websockets.exceptions.ConnectionClosed:
                break
            except Exception as e:
                print(f"Telemetry error: {e}")
                await asyncio.sleep(5)
    
    async def handle_client(self, websocket, path):
        print(f"ESP32 simulator connected: {path}")
        
        # Start telemetry task
        telemetry_task = asyncio.create_task(self.send_telemetry(websocket))
        
        try:
            async for message in websocket:
                await self.handle_command(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            print("ESP32 simulator disconnected")
        finally:
            telemetry_task.cancel()

# Start the simulator
simulator = ESP32SensorSimulator()
start_server = websockets.serve(simulator.handle_client, "localhost", 8802)

print("ESP32 Sensor Simulator started on ws://localhost:8802")
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
`;

    await this.startPythonSimulator('esp32', simulatorScript, 8802);
  }

  /**
   * Start camera simulator
   */
  private async startCameraSimulator(): Promise<void> {
    const simulatorScript = `
import asyncio
import websockets
import json
import base64
from datetime import datetime

class CameraSimulator:
    def __init__(self):
        self.is_recording = False
        self.frame_count = 0
        
    async def handle_command(self, websocket, command):
        try:
            cmd = json.loads(command)
            response = {'command_id': cmd.get('command_id'), 'status': 'success'}
            
            if cmd['type'] == 'start_stream':
                self.is_recording = True
                response['result'] = 'Stream started'
                
            elif cmd['type'] == 'stop_stream':
                self.is_recording = False
                response['result'] = 'Stream stopped'
                
            elif cmd['type'] == 'capture_image':
                # Simulate image capture
                fake_image_data = base64.b64encode(b'fake_image_data').decode('utf-8')
                response['result'] = {
                    'image_data': fake_image_data,
                    'format': 'jpeg',
                    'timestamp': datetime.now().isoformat()
                }
                
            await websocket.send(json.dumps(response))
            
        except Exception as e:
            error_response = {
                'command_id': cmd.get('command_id', 'unknown'),
                'status': 'error',
                'error': str(e)
            }
            await websocket.send(json.dumps(error_response))
    
    async def send_frames(self, websocket):
        while True:
            try:
                if self.is_recording:
                    self.frame_count += 1
                    frame_data = {
                        'type': 'frame',
                        'device_id': 'camera_module_01',
                        'timestamp': datetime.now().isoformat(),
                        'frame_number': self.frame_count,
                        'data': base64.b64encode(f'frame_{self.frame_count}'.encode()).decode()
                    }
                    
                    await websocket.send(json.dumps(frame_data))
                    await asyncio.sleep(0.033)  # ~30 FPS
                else:
                    await asyncio.sleep(1)
                    
            except websockets.exceptions.ConnectionClosed:
                break
            except Exception as e:
                print(f"Frame error: {e}")
                await asyncio.sleep(1)
    
    async def handle_client(self, websocket, path):
        print(f"Camera simulator connected: {path}")
        
        # Start frame streaming task
        frame_task = asyncio.create_task(self.send_frames(websocket))
        
        try:
            async for message in websocket:
                await self.handle_command(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            print("Camera simulator disconnected")
        finally:
            frame_task.cancel()

# Start the simulator
simulator = CameraSimulator()
start_server = websockets.serve(simulator.handle_client, "localhost", 8803)

print("Camera Simulator started on ws://localhost:8803")
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
`;

    await this.startPythonSimulator('camera', simulatorScript, 8803);
  }

  /**
   * Start generic sensor simulator
   */
  private async startSensorSimulator(): Promise<void> {
    const simulatorScript = `
import asyncio
import websockets
import json
import random
from datetime import datetime

class GenericSensorSimulator:
    def __init__(self):
        self.sensors = {
            'accelerometer': {'x': 0, 'y': 0, 'z': 9.81},
            'gyroscope': {'x': 0, 'y': 0, 'z': 0},
            'magnetometer': {'x': 0, 'y': 0, 'z': 0},
            'gps': {'lat': 40.7128, 'lon': -74.0060, 'alt': 10.0}
        }
    
    async def send_telemetry(self, websocket):
        while True:
            try:
                # Add noise to sensor readings
                self.sensors['accelerometer']['x'] += random.uniform(-0.1, 0.1)
                self.sensors['accelerometer']['y'] += random.uniform(-0.1, 0.1)
                
                self.sensors['gyroscope']['z'] += random.uniform(-0.5, 0.5)
                
                # Simulate small GPS drift
                self.sensors['gps']['lat'] += random.uniform(-0.0001, 0.0001)
                self.sensors['gps']['lon'] += random.uniform(-0.0001, 0.0001)
                
                telemetry = {
                    'type': 'telemetry',
                    'device_id': 'generic_sensors_01',
                    'timestamp': datetime.now().isoformat(),
                    'data': self.sensors
                }
                
                await websocket.send(json.dumps(telemetry))
                await asyncio.sleep(0.1)  # High frequency sensor data
                
            except websockets.exceptions.ConnectionClosed:
                break
            except Exception as e:
                print(f"Sensor telemetry error: {e}")
                await asyncio.sleep(1)
    
    async def handle_client(self, websocket, path):
        print(f"Generic sensor simulator connected: {path}")
        
        # Start telemetry task
        telemetry_task = asyncio.create_task(self.send_telemetry(websocket))
        
        try:
            async for message in websocket:
                # Echo commands for testing
                cmd = json.loads(message)
                response = {
                    'command_id': cmd.get('command_id'),
                    'status': 'success',
                    'result': 'Sensor command processed'
                }
                await websocket.send(json.dumps(response))
        except websockets.exceptions.ConnectionClosed:
            print("Generic sensor simulator disconnected")
        finally:
            telemetry_task.cancel()

# Start the simulator
simulator = GenericSensorSimulator()
start_server = websockets.serve(simulator.handle_client, "localhost", 8804)

print("Generic Sensor Simulator started on ws://localhost:8804")
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
`;

    await this.startPythonSimulator('sensors', simulatorScript, 8804);
  }

  /**
   * Start a Python simulator script
   */
  private async startPythonSimulator(name: string, script: string, port: number): Promise<void> {
    const scriptPath = `temp_${name}_simulator.py`;
    
    // Write script to temporary file
    const fs = require('fs/promises');
    await fs.writeFile(scriptPath, script);
    
    // Start the simulator process
    const process = spawn('python', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });
    
    this.simulators.set(name, process);
    
    // Handle process output
    process.stdout.on('data', (data) => {
      console.log(`[${name} simulator] ${data}`);
    });
    
    process.stderr.on('data', (data) => {
      console.error(`[${name} simulator error] ${data}`);
    });
    
    process.on('exit', (code) => {
      console.log(`[${name} simulator] Process exited with code ${code}`);
      this.simulators.delete(name);
      
      // Clean up script file
      fs.unlink(scriptPath).catch(() => {});
    });
    
    // Wait for simulator to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`✅ ${name} simulator started on port ${port}`);
  }

  /**
   * Wait for all simulators to be ready
   */
  private async waitForSimulatorsReady(): Promise<void> {
    const ports = [8801, 8802, 8803, 8804];
    const maxRetries = 10;
    
    for (const port of ports) {
      let retries = 0;
      while (retries < maxRetries) {
        try {
          const ws = new WebSocket(`ws://localhost:${port}`);
          
          await new Promise((resolve, reject) => {
            ws.on('open', () => {
              ws.close();
              resolve(true);
            });
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Timeout')), 2000);
          });
          
          console.log(`✅ Simulator on port ${port} is ready`);
          break;
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            throw new Error(`Simulator on port ${port} failed to start after ${maxRetries} retries`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  }

  /**
   * Get simulator status
   */
  getSimulatorStatus(): { [key: string]: boolean } {
    const status: { [key: string]: boolean } = {};
    
    for (const [name, process] of this.simulators) {
      status[name] = !process.killed && process.exitCode === null;
    }
    
    return status;
  }

  /**
   * Restart a specific simulator
   */
  async restartSimulator(name: string): Promise<void> {
    console.log(`🔄 Restarting ${name} simulator...`);
    
    // Stop the simulator if it's running  
    const process = this.simulators.get(name);
    if (process) {
      process.kill('SIGTERM');
      await new Promise(resolve => {
        process.on('exit', resolve);
        setTimeout(resolve, 5000);
      });
    }
    
    // Restart based on simulator type
    switch (name) {
      case 'arduino':
        await this.startArduinoSimulator();
        break;
      case 'esp32':
        await this.startESP32Simulator();
        break;
      case 'camera':
        await this.startCameraSimulator();
        break;
      case 'sensors':
        await this.startSensorSimulator();
        break;
      default:
        throw new Error(`Unknown simulator: ${name}`);
    }
  }
}
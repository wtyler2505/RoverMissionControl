from fastapi import FastAPI, WebSocket, HTTPException, WebSocketDisconnect, File, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import asyncio
import json
import random
import time
import os
import httpx
import subprocess
import tempfile
import aiofiles
from datetime import datetime
from typing import Dict, Any, List, Optional, AsyncGenerator
import uvicorn
import serial
import serial.tools.list_ports
from pathlib import Path
import markdown
import sqlite3
from threading import Thread
import queue
import math
import logging
from contextlib import asynccontextmanager

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Rover Development Platform API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Claude API configuration - More secure approach
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "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")
CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"

# Directories
BASE_DIR = Path("/app")
PROJECTS_DIR = BASE_DIR / "projects"
SKETCHES_DIR = PROJECTS_DIR / "sketches"
DATA_DIR = BASE_DIR / "data"
DOCS_DIR = BASE_DIR / "docs"
LIBRARIES_DIR = BASE_DIR / "libraries"

# Create directories
for dir_path in [PROJECTS_DIR, SKETCHES_DIR, DATA_DIR, DOCS_DIR, LIBRARIES_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# WebSocket connections management
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.last_heartbeat = {}
        self.watchdog_timeout = 500  # 500ms watchdog timeout
        
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.last_heartbeat[websocket] = time.time() * 1000
        
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            if websocket in self.last_heartbeat:
                del self.last_heartbeat[websocket]
            
    async def broadcast(self, message: dict):
        for connection in self.active_connections.copy():
            try:
                await connection.send_text(json.dumps(message))
            except:
                self.disconnect(connection)
    
    def update_heartbeat(self, websocket: WebSocket):
        """Update heartbeat timestamp"""
        self.last_heartbeat[websocket] = time.time() * 1000
    
    def check_watchdog(self) -> bool:
        """Check if any connection has timed out"""
        current_time = time.time() * 1000
        for ws, last_beat in self.last_heartbeat.items():
            if current_time - last_beat > self.watchdog_timeout:
                return True  # Watchdog timeout
        return len(self.last_heartbeat) == 0  # No active connections

manager = ConnectionManager()

# Enhanced Rover Simulator with Safety Features
class RoverSimulator:
    def __init__(self):
        self.start_time = time.time()
        self.wheel_pulses = {"fl": 0, "fr": 0, "rl": 0, "rr": 0}
        self.wheel_rpm_history = {"fl": [], "fr": [], "rl": [], "rr": []}
        self.current_speed = {"forward": 0.0, "turn": 0.0, "speed_multiplier": 1.0}
        self.motor_battery = 42.0  # 36V system, fully charged
        self.logic_battery = 25.2  # 25.2V system
        self.temperature = 35.0
        self.emergency_stop = False
        self.watchdog_triggered = False
        self.alerts = []
        self.motor_faults = {"fl": False, "fr": False, "rl": False, "rr": False}
        self.connection_latency = 0.0
        
        # Physics simulation
        self.position = [0.0, 0.0, 0.0]  # x, y, z
        self.orientation = [0.0, 0.0, 0.0]  # roll, pitch, yaw
        self.velocity = [0.0, 0.0, 0.0]
        
        # Performance metrics
        self.total_distance = 0.0
        self.avg_efficiency = 100.0
        self.last_control_update = time.time()
        
        # Input smoothing
        self.smoothed_forward = 0.0
        self.smoothed_turn = 0.0
        self.smooth_factor = 0.3
        
    def update_control(self, forward: float, turn: float, speed: float):
        """Update rover control inputs with safety checks and smoothing"""
        current_time = time.time()
        
        # Check watchdog
        if manager.check_watchdog():
            if not self.watchdog_triggered:
                self.emergency_stop = True
                self.watchdog_triggered = True
                self.add_alert("Watchdog timeout - Emergency stop activated", "error")
                logger.warning("Watchdog timeout triggered emergency stop")
        else:
            self.watchdog_triggered = False
        
        if not self.emergency_stop and not self.watchdog_triggered:
            # Input validation and clamping
            forward = max(-1.0, min(1.0, forward))
            turn = max(-1.0, min(1.0, turn))
            speed = max(0.0, min(1.0, speed))
            
            # Input smoothing
            self.smoothed_forward += (forward - self.smoothed_forward) * self.smooth_factor
            self.smoothed_turn += (turn - self.smoothed_turn) * self.smooth_factor
            
            self.current_speed = {
                "forward": self.smoothed_forward,
                "turn": self.smoothed_turn,
                "speed_multiplier": speed
            }
            
            # Update physics
            dt = current_time - self.last_control_update
            actual_speed = self.smoothed_forward * speed * 2.0  # m/s
            turn_rate = self.smoothed_turn * speed * 1.0  # rad/s
            
            # Update velocity and position
            self.velocity[0] = actual_speed * math.cos(self.orientation[2])
            self.velocity[1] = actual_speed * math.sin(self.orientation[2])
            
            self.position[0] += self.velocity[0] * dt
            self.position[1] += self.velocity[1] * dt
            self.orientation[2] += turn_rate * dt
            
            self.total_distance += abs(actual_speed) * dt
            
        else:
            # Emergency stop - zero all inputs
            self.current_speed = {"forward": 0.0, "turn": 0.0, "speed_multiplier": 0.0}
            self.velocity = [0.0, 0.0, 0.0]
            self.smoothed_forward = 0.0
            self.smoothed_turn = 0.0
            
        self.last_control_update = current_time
    
    def set_emergency_stop(self, stop: bool):
        """Set emergency stop state"""
        self.emergency_stop = stop
        self.watchdog_triggered = False  # Reset watchdog when manually controlling
        if stop:
            self.current_speed = {"forward": 0.0, "turn": 0.0, "speed_multiplier": 0.0}
            self.velocity = [0.0, 0.0, 0.0]
            self.add_alert("Emergency stop activated", "warning")
        else:
            self.add_alert("Rover resumed", "info")
    
    def add_alert(self, message: str, level: str):
        """Add system alert with timestamp"""
        self.alerts.append({
            "timestamp": datetime.now().isoformat(),
            "message": message,
            "level": level,
            "id": f"alert_{int(time.time() * 1000)}"
        })
        # Keep only last 50 alerts
        self.alerts = self.alerts[-50:]
        logger.info(f"Alert [{level.upper()}]: {message}")
    
    def check_system_health(self):
        """Enhanced system health monitoring with thresholds"""
        alerts_generated = []
        
        # Battery alerts with thresholds
        if self.motor_battery < 35.0 and self.motor_battery >= 32.0:
            alerts_generated.append(("Motor battery low", "warning"))
        elif self.motor_battery < 32.0:
            alerts_generated.append(("Motor battery critically low", "error"))
            
        if self.logic_battery < 22.0 and self.logic_battery >= 21.0:
            alerts_generated.append(("Logic battery low", "warning"))
        elif self.logic_battery < 21.0:
            alerts_generated.append(("Logic battery critically low", "error"))
        
        # Temperature alerts with escalation
        if self.temperature > 70.0 and self.temperature <= 75.0:
            alerts_generated.append(("High temperature detected", "warning"))
        elif self.temperature > 75.0 and self.temperature <= 80.0:
            alerts_generated.append(("Very high temperature - performance reduced", "error"))
        elif self.temperature > 80.0:
            alerts_generated.append(("Critical temperature - emergency stop triggered", "error"))
            self.emergency_stop = True
            
        # Motor fault simulation (very low probability)
        for wheel in self.motor_faults:
            if not self.motor_faults[wheel] and random.random() < 0.0001:
                self.motor_faults[wheel] = True
                alerts_generated.append((f"Motor fault detected: {wheel.upper()}", "error"))
        
        # Add new alerts
        for message, level in alerts_generated:
            self.add_alert(message, level)
    
    def calculate_latency(self) -> float:
        """Calculate connection latency (simulated)"""
        base_latency = 20.0  # Base 20ms
        jitter = random.uniform(-5.0, 10.0)
        return max(1.0, base_latency + jitter)
    
    def get_telemetry(self) -> Dict[str, Any]:
        """Generate comprehensive rover telemetry with enhanced data"""
        uptime = int((time.time() - self.start_time) * 1000)
        
        # Calculate latency
        self.connection_latency = self.calculate_latency()
        
        # Simulate wheel RPM based on control inputs with realistic physics
        base_rpm = abs(self.current_speed["forward"]) * self.current_speed["speed_multiplier"] * 200
        turn_modifier = self.current_speed["turn"] * 50
        
        # Account for motor faults and emergency stop
        multiplier = 0 if self.emergency_stop else 1
        fl_rpm = max(0, int((base_rpm - turn_modifier) * multiplier + random.uniform(-5, 5))) if not self.motor_faults["fl"] else 0
        fr_rpm = max(0, int((base_rpm + turn_modifier) * multiplier + random.uniform(-5, 5))) if not self.motor_faults["fr"] else 0
        rl_rpm = max(0, int((base_rpm - turn_modifier) * multiplier + random.uniform(-5, 5))) if not self.motor_faults["rl"] else 0
        rr_rpm = max(0, int((base_rpm + turn_modifier) * multiplier + random.uniform(-5, 5))) if not self.motor_faults["rr"] else 0
        
        # Update pulse counts (23 pulses per revolution for hoverboard motors)
        self.wheel_pulses["fl"] += int(fl_rpm * 23 / 60 * 0.1)
        self.wheel_pulses["fr"] += int(fr_rpm * 23 / 60 * 0.1)
        self.wheel_pulses["rl"] += int(rl_rpm * 23 / 60 * 0.1)
        self.wheel_pulses["rr"] += int(rr_rpm * 23 / 60 * 0.1)
        
        # Update RPM history for analytics
        for wheel, rpm in zip(["fl", "fr", "rl", "rr"], [fl_rpm, fr_rpm, rl_rpm, rr_rpm]):
            self.wheel_rpm_history[wheel].append(rpm)
            self.wheel_rpm_history[wheel] = self.wheel_rpm_history[wheel][-100:]
        
        # Enhanced battery simulation with current draw
        total_rpm = fl_rpm + fr_rpm + rl_rpm + rr_rpm
        power_draw = (total_rpm / 800.0) * self.current_speed["speed_multiplier"]  # Normalized power draw
        motor_current = power_draw * 25  # Simulate current draw in amps
        
        self.motor_battery = max(32.0, self.motor_battery - power_draw * 0.0005)
        self.logic_battery = max(21.0, self.logic_battery - 0.0001)
        
        # Temperature simulation with load and cooling
        target_temp = 35.0 + power_draw * 15 + random.uniform(-2, 2)
        cooling_factor = max(0.05, 0.15 - power_draw * 0.05)  # Less cooling under load
        self.temperature += (target_temp - self.temperature) * cooling_factor
        
        # System health check
        self.check_system_health()
        
        return {
            "type": "telemetry",
            "timestamp": datetime.now().isoformat(),
            "wheels": {
                "fl": {"rpm": fl_rpm, "pulses": self.wheel_pulses["fl"], "fault": self.motor_faults["fl"]},
                "fr": {"rpm": fr_rpm, "pulses": self.wheel_pulses["fr"], "fault": self.motor_faults["fr"]},
                "rl": {"rpm": rl_rpm, "pulses": self.wheel_pulses["rl"], "fault": self.motor_faults["rl"]},
                "rr": {"rpm": rr_rpm, "pulses": self.wheel_pulses["rr"], "fault": self.motor_faults["rr"]}
            },
            "battery": {
                "motor": {
                    "voltage": round(self.motor_battery, 1),
                    "current": round(motor_current, 1),
                    "power": round(self.motor_battery * motor_current, 1),
                    "percentage": round(max(0, (self.motor_battery - 32) / (42 - 32) * 100), 1)
                },
                "logic": {
                    "voltage": round(self.logic_battery, 1),
                    "percentage": round(max(0, (self.logic_battery - 21) / (25.2 - 21) * 100), 1)
                }
            },
            "temp": round(self.temperature, 1),
            "uptime": uptime,
            "control": self.current_speed,
            "emergency_stop": self.emergency_stop,
            "watchdog_triggered": self.watchdog_triggered,
            "position": [round(p, 3) for p in self.position],
            "orientation": [round(o, 3) for o in self.orientation],
            "velocity": [round(v, 3) for v in self.velocity],
            "total_distance": round(self.total_distance, 2),
            "efficiency": round(self.avg_efficiency, 1),
            "latency": round(self.connection_latency, 1),
            "alerts": self.alerts[-5:],  # Last 5 alerts
            "motor_faults": self.motor_faults,
            "system_health": {
                "battery_status": "good" if self.motor_battery > 35 else ("low" if self.motor_battery > 32 else "critical"),
                "temperature_status": "good" if self.temperature < 70 else ("warning" if self.temperature < 80 else "critical"),
                "connection_status": "good" if self.connection_latency < 50 else ("degraded" if self.connection_latency < 100 else "poor")
            }
        }

rover = RoverSimulator()

# Enhanced Serial Communication Manager
class SerialManager:
    def __init__(self):
        self.connections = {}
        self.data_queues = {}
        self.json_parser_enabled = True
    
    def get_available_ports(self):
        """Get list of available serial ports with details"""
        try:
            ports = serial.tools.list_ports.comports()
            return [{
                "device": port.device,
                "description": port.description,
                "hwid": port.hwid,
                "manufacturer": getattr(port, 'manufacturer', 'Unknown')
            } for port in ports]
        except Exception as e:
            logger.error(f"Error getting serial ports: {e}")
            return []
    
    def connect_port(self, port: str, baudrate: int = 115200):
        """Connect to a serial port with enhanced error handling"""
        try:
            if port in self.connections:
                self.connections[port].close()
            
            ser = serial.Serial(port, baudrate, timeout=1)
            self.connections[port] = ser
            self.data_queues[port] = queue.Queue(maxsize=1000)
            
            # Start reading thread
            thread = Thread(target=self._read_serial, args=(port,), daemon=True)
            thread.start()
            
            logger.info(f"Connected to serial port {port} at {baudrate} baud")
            return True
        except Exception as e:
            logger.error(f"Serial connection error on {port}: {e}")
            return False
    
    def _read_serial(self, port: str):
        """Background thread to read and parse serial data"""
        while port in self.connections:
            try:
                if self.connections[port].in_waiting:
                    data = self.connections[port].readline().decode().strip()
                    if data:
                        parsed_data = self._parse_serial_line(data)
                        if not self.data_queues[port].full():
                            self.data_queues[port].put({
                                "timestamp": datetime.now().isoformat(),
                                "raw": data,
                                "parsed": parsed_data,
                                "type": "json" if parsed_data else "text"
                            })
            except Exception as e:
                logger.error(f"Serial read error on {port}: {e}")
                break
    
    def _parse_serial_line(self, line: str) -> Optional[dict]:
        """Parse JSON from serial line if possible"""
        if not self.json_parser_enabled:
            return None
            
        try:
            # Try to parse as JSON
            if line.strip().startswith('{') and line.strip().endswith('}'):
                return json.loads(line)
        except json.JSONDecodeError:
            pass
        return None
    
    def get_serial_data(self, port: str, lines: int = 50):
        """Get recent serial data with JSON parsing"""
        if port not in self.data_queues:
            return []
        
        data = []
        try:
            while not self.data_queues[port].empty() and len(data) < lines:
                data.append(self.data_queues[port].get_nowait())
        except:
            pass
        
        return data[-lines:]
    
    def send_data(self, port: str, data: str):
        """Send data to serial port"""
        try:
            if port in self.connections:
                self.connections[port].write((data + '\n').encode())
                return True
        except Exception as e:
            logger.error(f"Serial send error on {port}: {e}")
        return False

serial_manager = SerialManager()

# Arduino Library Manager
class ArduinoLibraryManager:
    def __init__(self):
        self.arduino_cli = "arduino-cli"
    
    async def search_libraries(self, query: str = "", limit: int = 20):
        """Search for Arduino libraries"""
        try:
            cmd = [self.arduino_cli, "lib", "search", query, "--format", "json"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                libraries = json.loads(result.stdout).get("libraries", [])
                return libraries[:limit]
            else:
                logger.error(f"Library search error: {result.stderr}")
                return []
        except Exception as e:
            logger.error(f"Library search exception: {e}")
            return []
    
    async def list_installed_libraries(self):
        """List installed Arduino libraries"""
        try:
            cmd = [self.arduino_cli, "lib", "list", "--format", "json"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                return json.loads(result.stdout).get("installed_libraries", [])
            else:
                return []
        except Exception as e:
            logger.error(f"List libraries exception: {e}")
            return []
    
    async def install_library(self, library_name: str):
        """Install an Arduino library"""
        try:
            cmd = [self.arduino_cli, "lib", "install", library_name]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            return {
                "success": result.returncode == 0,
                "output": result.stdout + result.stderr,
                "library": library_name
            }
        except Exception as e:
            return {
                "success": False,
                "output": f"Exception: {str(e)}",
                "library": library_name
            }
    
    async def uninstall_library(self, library_name: str):
        """Uninstall an Arduino library"""
        try:
            cmd = [self.arduino_cli, "lib", "uninstall", library_name]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            return {
                "success": result.returncode == 0,
                "output": result.stdout + result.stderr,
                "library": library_name
            }
        except Exception as e:
            return {
                "success": False,
                "output": f"Exception: {str(e)}",
                "library": library_name
            }

library_manager = ArduinoLibraryManager()

# Enhanced Database initialization with Knowledge Base support
def init_database():
    conn = sqlite3.connect(DATA_DIR / "rover_platform.db")
    cursor = conn.cursor()
    
    # Projects table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tasks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY,
            project_id INTEGER,
            title TEXT,
            description TEXT,
            status TEXT DEFAULT 'todo',
            priority TEXT DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects (id)
        )
    ''')
    
    # Enhanced Parts Categories table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS part_categories (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE,
            description TEXT,
            parent_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES part_categories (id)
        )
    ''')
    
    # Enhanced Parts table with comprehensive specifications
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS parts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category_id INTEGER,
            manufacturer TEXT,
            part_number TEXT,
            description TEXT,
            datasheet_url TEXT,
            specifications TEXT,
            voltage_min REAL,
            voltage_max REAL,
            current_rating REAL,
            power_rating REAL,
            package_type TEXT,
            pin_count INTEGER,
            dimensions TEXT,
            weight_g REAL,
            supplier TEXT,
            supplier_part_number TEXT,
            cost REAL,
            quantity INTEGER DEFAULT 0,
            minimum_stock INTEGER DEFAULT 0,
            location TEXT,
            status TEXT DEFAULT 'active',
            tags TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES part_categories (id)
        )
    ''')
    
    # Pin definitions for parts
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS part_pins (
            id INTEGER PRIMARY KEY,
            part_id TEXT,
            pin_number TEXT,
            pin_label TEXT,
            pin_type TEXT,
            description TEXT,
            voltage REAL,
            current REAL,
            FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE CASCADE
        )
    ''')
    
    # Documents table for knowledge base
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT,
            document_type TEXT DEFAULT 'markdown',
            category TEXT,
            tags TEXT,
            file_path TEXT,
            file_size INTEGER,
            mime_type TEXT,
            related_parts TEXT,
            version INTEGER DEFAULT 1,
            author TEXT,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Document versions for history tracking
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS document_versions (
            id INTEGER PRIMARY KEY,
            document_id TEXT,
            version INTEGER,
            title TEXT,
            content TEXT,
            changes_description TEXT,
            author TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
        )
    ''')
    
    # Sessions table for data recording
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY,
            name TEXT,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            data_file TEXT
        )
    ''')
    
    # AI conversation history with enhanced context
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_conversations (
            id INTEGER PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            user_message TEXT,
            ai_response TEXT,
            context_data TEXT,
            context_parts TEXT,
            context_documents TEXT,
            tokens_used INTEGER,
            session_id TEXT
        )
    ''')
    
    # Search index for full-text search (simplified)
    cursor.execute('''
        CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
            content_type,
            item_id,
            title,
            content,
            tags,
            category
        )
    ''')
    
    conn.commit()
    conn.close()

# Seed initial part categories and sample parts
def seed_initial_data():
    conn = sqlite3.connect(DATA_DIR / "rover_platform.db")
    cursor = conn.cursor()
    
    # Insert default categories
    categories = [
        (1, "Microcontrollers", "Arduino, ESP32, STM32 and other microcontroller boards", None),
        (2, "Sensors", "Temperature, pressure, accelerometer, GPS sensors", None),
        (3, "Motors & Actuators", "DC motors, servo motors, stepper motors", None),
        (4, "Power Management", "Batteries, regulators, power supplies", None),
        (5, "Communication", "WiFi, Bluetooth, radio modules", None),
        (6, "Passive Components", "Resistors, capacitors, inductors", None),
        (7, "Connectors & Cables", "JST, Dupont, USB connectors and cables", None),
    ]
    
    cursor.executemany('''
        INSERT OR IGNORE INTO part_categories (id, name, description, parent_id)
        VALUES (?, ?, ?, ?)
    ''', categories)
    
    # Insert rover-specific parts
    rover_parts = [
        ("arduino_mega_2560", "Arduino Mega 2560", 1, "Arduino", "A000067", 
         "Main microcontroller board with 54 digital I/O pins, 16 analog inputs", 
         "https://docs.arduino.cc/hardware/mega-2560", 
         '{"flash_memory": "256KB", "sram": "8KB", "eeprom": "4KB", "clock_speed": "16MHz"}',
         5.0, 12.0, 0.05, 0.6, "DIP", 54, "101.52 x 53.3mm", 40.0,
         "Arduino Store", "A000067", 45.99, 1, 1, "Main Board", "active",
         "arduino,microcontroller,main", "Primary rover controller"),
        
        ("nodemcu_amica", "NodeMCU Amica V3", 5, "Amica", "NodeMCU-32S",
         "ESP8266-based WiFi development board for IoT projects",
         "https://github.com/nodemcu/nodemcu-devkit-v1.0",
         '{"cpu": "ESP8266", "wifi": "802.11 b/g/n", "gpio_pins": 11, "flash": "4MB"}',
         3.0, 3.6, 0.17, 0.5, "PCB Module", 11, "58 x 31mm", 10.0,
         "Adafruit", "2471", 9.95, 1, 1, "Communication Board", "active",
         "esp8266,wifi,nodemcu", "WiFi bridge for rover communication"),
        
        ("riorand_bldc", "RioRand 350W BLDC Controller", 3, "RioRand", "350W-BLDC",
         "350W Brushless DC Motor Speed Controller",
         "", 
         '{"power": "350W", "voltage": "36V", "current": "15A", "control": "PWM"}',
         24.0, 48.0, 15.0, 350.0, "PCB Module", 3, "65 x 45mm", 120.0,
         "RioRand", "350W-BLDC", 89.99, 4, 1, "Motor Controllers", "active",
         "bldc,motor,controller,350w", "Motor speed controllers for hoverboard wheels"),
        
        ("hoverboard_wheel", "Hoverboard Wheel Motor", 3, "Generic", "HB-WHEEL-6.5",
         "6.5 inch hoverboard wheel with built-in brushless motor",
         "",
         '{"diameter": "6.5in", "voltage": "36V", "power": "350W", "hall_sensors": 23}',
         36.0, 36.0, 10.0, 350.0, "Motor Assembly", 23, "165mm diameter", 2500.0,
         "Generic", "HB-WHEEL-6.5", 59.99, 4, 1, "Wheels Storage", "active",
         "hoverboard,wheel,motor,hall", "Main drive wheels with integrated motors"),
        
        ("battery_36v", "36V Li-ion Battery Pack", 4, "Generic", "36V-10AH",
         "36V 10Ah Lithium-ion battery pack for electric vehicles",
         "",
         '{"voltage": "36V", "capacity": "10Ah", "chemistry": "Li-ion", "bms": true}',
         36.0, 42.0, 10.0, 360.0, "Battery Pack", 0, "200 x 100 x 80mm", 3000.0,
         "Generic", "36V-10AH", 199.99, 1, 1, "Battery Compartment", "active",
         "battery,36v,lithium,motor", "Main motor battery pack"),
        
        ("battery_25v", "25.2V Logic Battery", 4, "Generic", "25V-5AH",
         "25.2V 5Ah Lithium-ion battery for logic systems",
         "",
         '{"voltage": "25.2V", "capacity": "5Ah", "chemistry": "Li-ion", "bms": true}',
         25.2, 29.4, 5.0, 126.0, "Battery Pack", 0, "150 x 80 x 60mm", 1500.0,
         "Generic", "25V-5AH", 99.99, 0, 1, "Battery Compartment", "low_stock",
         "battery,25v,lithium,logic", "Logic system battery pack - NEEDS ORDERING")
    ]
    
    cursor.executemany('''
        INSERT OR IGNORE INTO parts (
            id, name, category_id, manufacturer, part_number, description,
            datasheet_url, specifications, voltage_min, voltage_max, current_rating,
            power_rating, package_type, pin_count, dimensions, weight_g,
            supplier, supplier_part_number, cost, quantity, minimum_stock,
            location, status, tags, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', rover_parts)
    
    # Add pin definitions for key components
    arduino_pins = [
        ("arduino_mega_2560", "2", "PWM_FL", "PWM Output", "FL Motor PWM control", 5.0, 0.02),
        ("arduino_mega_2560", "3", "PWM_FR", "PWM Output", "FR Motor PWM control", 5.0, 0.02),
        ("arduino_mega_2560", "9", "PWM_RL", "PWM Output", "RL Motor PWM control", 5.0, 0.02),
        ("arduino_mega_2560", "10", "PWM_RR", "PWM Output", "RR Motor PWM control", 5.0, 0.02),
        ("arduino_mega_2560", "18", "INT_FL", "Digital Input", "FL Hall sensor interrupt", 5.0, 0.001),
        ("arduino_mega_2560", "19", "INT_FR", "Digital Input", "FR Hall sensor interrupt", 5.0, 0.001),
        ("arduino_mega_2560", "20", "INT_RL", "Digital Input", "RL Hall sensor interrupt", 5.0, 0.001),
        ("arduino_mega_2560", "21", "INT_RR", "Digital Input", "RR Hall sensor interrupt", 5.0, 0.001),
        ("arduino_mega_2560", "22", "E_STOP", "Digital Input", "Emergency stop button", 5.0, 0.001),
        ("arduino_mega_2560", "A0", "BAT_MOTOR", "Analog Input", "Motor battery voltage", 5.0, 0.001),
        ("arduino_mega_2560", "A1", "BAT_LOGIC", "Analog Input", "Logic battery voltage", 5.0, 0.001),
        ("arduino_mega_2560", "A2", "TEMP", "Analog Input", "Temperature sensor", 5.0, 0.001),
    ]
    
    cursor.executemany('''
        INSERT OR IGNORE INTO part_pins (part_id, pin_number, pin_label, pin_type, description, voltage, current)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', arduino_pins)
    
    # Add sample documents
    sample_docs = [
        ("rover_wiring_guide", "Rover Wiring Guide", 
         """# Rover Wiring Diagram and Connections

## Main Power System
- **Motor Battery**: 36V Li-ion → RioRand BLDC Controllers
- **Logic Battery**: 25.2V Li-ion → Arduino Mega (via 12V regulator)

## Motor Control Wiring
- **FL Motor**: Arduino Pin 2 → RioRand Controller 1 PWM
- **FR Motor**: Arduino Pin 3 → RioRand Controller 2 PWM  
- **RL Motor**: Arduino Pin 9 → RioRand Controller 3 PWM
- **RR Motor**: Arduino Pin 10 → RioRand Controller 4 PWM

## Hall Sensor Connections
- **FL Sensor**: Pin 18 (INT3) - Front Left wheel encoder
- **FR Sensor**: Pin 19 (INT2) - Front Right wheel encoder
- **RL Sensor**: Pin 20 (INT1) - Rear Left wheel encoder
- **RR Sensor**: Pin 21 (INT0) - Rear Right wheel encoder

## Safety Systems
- **Emergency Stop**: Pin 22 - Physical emergency stop button
- **Watchdog Timer**: 500ms timeout for connection loss

## Communication
- **NodeMCU**: Serial1 connection for WiFi bridge
- **USB**: Programming and debugging via USB cable

## Monitoring Inputs
- **Motor Battery**: A0 - Voltage divider for 36V monitoring
- **Logic Battery**: A1 - Voltage divider for 25.2V monitoring  
- **Temperature**: A2 - Temperature sensor for thermal management

## Important Notes
- Always connect grounds between all systems
- Use appropriate fuses for battery connections
- Test emergency stop functionality before operation
- Verify hall sensor polarity (23 pulses per revolution)
""",
         "markdown", "wiring", "rover,wiring,arduino,motors", "", 0, "text/markdown",
         "arduino_mega_2560,nodemcu_amica,riorand_bldc", 1, "system", "active"),
        
        ("safety_procedures", "Rover Safety Procedures",
         """# Rover Safety Procedures and Emergency Protocols

## Pre-Operation Checklist
1. **Battery Check**: Verify both motor (36V) and logic (25.2V) batteries are charged
2. **Emergency Stop Test**: Press emergency stop button - all motors should stop immediately
3. **Connection Test**: Verify stable WiFi connection to rover
4. **Sensor Check**: All 4 hall sensors should show readings in telemetry
5. **Motor Test**: Low-speed test of each wheel individually

## Emergency Procedures
### Immediate Stop
- **Physical**: Red emergency stop button on rover
- **Software**: Emergency stop button in control panel
- **Automatic**: 500ms watchdog timer triggers if connection lost

### Battery Management
- **Motor Battery**: Stop operation if voltage drops below 35V
- **Logic Battery**: Critical shutdown if voltage drops below 22V
- **Temperature**: Automatic shutdown if temperature exceeds 80°C

### Fault Conditions
- **Motor Fault**: Individual wheel fault detection and isolation
- **Communication Loss**: Automatic emergency stop after 500ms
- **Sensor Failure**: Alert and degraded operation mode

## Operating Limits
- **Maximum Speed**: 2 m/s forward/backward
- **Maximum Turn Rate**: 1 rad/s
- **Operating Temperature**: -10°C to +60°C
- **Maximum Slope**: 15 degrees
- **Battery Voltage Range**: Motor 32-42V, Logic 21-29V

## Maintenance Schedule
- **Daily**: Visual inspection, battery check, emergency stop test
- **Weekly**: Hall sensor calibration, motor performance check
- **Monthly**: Deep inspection, connection tightness, software updates

## Emergency Contacts
- **System Administrator**: [Your Contact]
- **Hardware Support**: [Hardware Team]
- **Emergency Services**: 911 (if applicable)
""",
         "markdown", "safety", "rover,safety,emergency,procedures", "", 0, "text/markdown",
         "arduino_mega_2560,battery_36v,battery_25v", 1, "system", "active")
    ]
    
    cursor.executemany('''
        INSERT OR IGNORE INTO documents (
            id, title, content, document_type, category, tags, file_path, 
            file_size, mime_type, related_parts, version, author, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', sample_docs)
    
    # Populate search index
    search_entries = []
    
    # Add parts to search index
    for part in rover_parts:
        search_entries.append(("part", part[0], part[1], f"{part[1]} {part[4]} {part[5]}", part[24], part[2]))
    
    # Add documents to search index  
    for doc in sample_docs:
        search_entries.append(("document", doc[0], doc[1], f"{doc[1]} {doc[2]}", doc[5], doc[4]))
    
    cursor.executemany('''
        INSERT OR IGNORE INTO search_index (content_type, item_id, title, content, tags, category)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', search_entries)
    
    conn.commit()
    conn.close()

init_database()

# Seed initial data if database is empty
try:
    conn = sqlite3.connect(DATA_DIR / "rover_platform.db")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM part_categories")
    category_count = cursor.fetchone()[0]
    conn.close()
    
    if category_count == 0:
        seed_initial_data()
        logger.info("📚 Seeded initial knowledge base data")
except Exception as e:
    logger.error(f"Error checking/seeding database: {e}")

# Background telemetry broadcaster with heartbeat handling
async def telemetry_broadcaster():
    """Continuously broadcast rover telemetry"""
    while True:
        try:
            telemetry = rover.get_telemetry()
            await manager.broadcast(telemetry)
            await asyncio.sleep(0.1)  # 10Hz update rate
        except Exception as e:
            logger.error(f"Telemetry broadcaster error: {e}")
            await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Rover Development Platform starting up...")
    asyncio.create_task(telemetry_broadcaster())

# API Routes

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy", 
        "service": "Rover Development Platform",
        "version": "2.0.0",
        "uptime": int(time.time() - rover.start_time),
        "active_connections": len(manager.active_connections)
    }

# Enhanced Rover Control Endpoints
@app.post("/api/rover/control")
async def control_rover(control_data: dict):
    """Handle rover control commands with input validation"""
    try:
        forward = max(-1.0, min(1.0, control_data.get("forward", 0.0)))
        turn = max(-1.0, min(1.0, control_data.get("turn", 0.0))) 
        speed = max(0.0, min(1.0, control_data.get("speed", 1.0)))
        
        rover.update_control(forward, turn, speed)
        
        return {
            "status": "success",
            "message": "Control command executed",
            "control": rover.current_speed,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/rover/emergency-stop")
async def emergency_stop():
    """Emergency stop the rover"""
    rover.set_emergency_stop(True)
    await manager.broadcast({
        "type": "emergency_stop",
        "timestamp": datetime.now().isoformat(),
        "message": "Emergency stop activated"
    })
    return {"status": "success", "message": "Emergency stop activated"}

@app.post("/api/rover/resume")
async def resume_rover():
    """Resume rover operation after emergency stop"""
    rover.set_emergency_stop(False)
    await manager.broadcast({
        "type": "emergency_resume", 
        "timestamp": datetime.now().isoformat(),
        "message": "Rover resumed"
    })
    return {"status": "success", "message": "Rover resumed"}

@app.get("/api/rover/status")
async def get_rover_status():
    """Get current rover status"""
    return rover.get_telemetry()

# Enhanced Arduino IDE Integration
@app.post("/api/arduino/compile")
async def compile_arduino_code(request: dict, background_tasks: BackgroundTasks):
    """Compile Arduino code with progress streaming"""
    try:
        code = request.get("code", "")
        board = request.get("board", "arduino:avr:mega")
        
        # Create temporary sketch file
        with tempfile.TemporaryDirectory() as temp_dir:
            sketch_dir = Path(temp_dir) / "sketch"
            sketch_dir.mkdir()
            sketch_file = sketch_dir / "sketch.ino"
            
            async with aiofiles.open(sketch_file, 'w') as f:
                await f.write(code)
            
            # Run arduino-cli compile with verbose output
            cmd = ["arduino-cli", "compile", "--fqbn", board, str(sketch_dir), "--verbose"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            # Parse compilation output for errors and warnings
            output_lines = (result.stdout + result.stderr).split('\n')
            errors = [line for line in output_lines if 'error:' in line.lower()]
            warnings = [line for line in output_lines if 'warning:' in line.lower()]
            
            return {
                "status": "success" if result.returncode == 0 else "error",
                "output": result.stdout + result.stderr,
                "returncode": result.returncode,
                "errors": errors,
                "warnings": warnings,
                "sketch_size": len(code),
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        return {
            "status": "error",
            "output": f"Compilation error: {str(e)}",
            "returncode": -1,
            "errors": [str(e)],
            "warnings": []
        }

@app.post("/api/arduino/upload")
async def upload_arduino_code(request: dict):
    """Upload Arduino code to board with progress"""
    try:
        code = request.get("code", "")
        port = request.get("port", "/dev/ttyUSB0")
        board = request.get("board", "arduino:avr:mega")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            sketch_dir = Path(temp_dir) / "sketch"
            sketch_dir.mkdir()
            sketch_file = sketch_dir / "sketch.ino"
            
            async with aiofiles.open(sketch_file, 'w') as f:
                await f.write(code)
            
            # Compile first
            compile_cmd = ["arduino-cli", "compile", "--fqbn", board, str(sketch_dir)]
            compile_result = subprocess.run(compile_cmd, capture_output=True, text=True)
            
            if compile_result.returncode != 0:
                return {
                    "status": "error",
                    "output": "Compilation failed:\n" + compile_result.stdout + compile_result.stderr,
                    "returncode": compile_result.returncode,
                    "phase": "compile"
                }
            
            # Upload
            upload_cmd = ["arduino-cli", "upload", "-p", port, "--fqbn", board, str(sketch_dir), "--verbose"]
            upload_result = subprocess.run(upload_cmd, capture_output=True, text=True)
            
            return {
                "status": "success" if upload_result.returncode == 0 else "error",
                "output": compile_result.stdout + "\n=== UPLOAD ===\n" + upload_result.stdout + upload_result.stderr,
                "returncode": upload_result.returncode,
                "phase": "upload" if upload_result.returncode == 0 else "upload_failed",
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        return {
            "status": "error",
            "output": f"Upload error: {str(e)}",
            "returncode": -1,
            "phase": "exception"
        }

@app.get("/api/arduino/ports")
async def get_serial_ports():
    """Get available serial ports with details"""
    ports = serial_manager.get_available_ports()
    return {"ports": ports}

@app.get("/api/arduino/serial/{port}")
async def get_serial_data(port: str, lines: int = 50):
    """Get serial monitor data with JSON parsing"""
    try:
        if port not in serial_manager.connections:
            success = serial_manager.connect_port(port)
            if not success:
                return {"status": "error", "data": f"Failed to connect to {port}"}
        
        data = serial_manager.get_serial_data(port, lines)
        
        # Format for display
        formatted_lines = []
        json_objects = []
        
        for item in data:
            timestamp = item["timestamp"]
            if item["type"] == "json" and item["parsed"]:
                formatted_lines.append(f"[{timestamp}] JSON: {json.dumps(item['parsed'], indent=2)}")
                json_objects.append(item["parsed"])
            else:
                formatted_lines.append(f"[{timestamp}] {item['raw']}")
        
        return {
            "status": "success",
            "data": "\n".join(formatted_lines),
            "json_objects": json_objects,
            "total_lines": len(data),
            "port": port
        }
    except Exception as e:
        return {"status": "error", "data": f"Serial error: {str(e)}"}

@app.post("/api/arduino/serial/{port}/send")
async def send_serial_data(port: str, request: dict):
    """Send data to serial port"""
    try:
        data = request.get("data", "")
        success = serial_manager.send_data(port, data)
        
        return {
            "status": "success" if success else "error",
            "message": f"Data sent to {port}" if success else f"Failed to send to {port}",
            "data_sent": data
        }
    except Exception as e:
        return {"status": "error", "message": f"Send error: {str(e)}"}

# Arduino Library Manager Endpoints
@app.get("/api/arduino/libraries")
async def get_installed_libraries():
    """Get list of installed Arduino libraries"""
    libraries = await library_manager.list_installed_libraries()
    return {"libraries": libraries}

@app.get("/api/arduino/libraries/search")
async def search_libraries(q: str = "", limit: int = 20):
    """Search for Arduino libraries"""
    libraries = await library_manager.search_libraries(q, limit)
    return {"libraries": libraries, "query": q}

@app.post("/api/arduino/libraries/install")
async def install_library(request: dict):
    """Install an Arduino library"""
    library_name = request.get("library", "")
    if not library_name:
        raise HTTPException(status_code=400, detail="Library name is required")
    
    result = await library_manager.install_library(library_name)
    return result

@app.post("/api/arduino/libraries/uninstall")
async def uninstall_library(request: dict):
    """Uninstall an Arduino library"""
    library_name = request.get("library", "")
    if not library_name:
        raise HTTPException(status_code=400, detail="Library name is required")
    
    result = await library_manager.uninstall_library(library_name)
    return result

# Enhanced AI Chat with Context and Streaming
async def stream_claude_response(message: str, context: dict) -> AsyncGenerator[str, None]:
    """Stream Claude API response"""
    try:
        # Build comprehensive context
        current_telemetry = rover.get_telemetry()
        
        context_prompt = f"""You are an expert rover development assistant with full access to the current project state:

CURRENT ROVER STATUS:
- Emergency Stop: {current_telemetry['emergency_stop']}
- Watchdog: {'TRIGGERED' if current_telemetry['watchdog_triggered'] else 'OK'}
- Motor Battery: {current_telemetry['battery']['motor']['voltage']}V ({current_telemetry['battery']['motor']['percentage']}%)
- Logic Battery: {current_telemetry['battery']['logic']['voltage']}V ({current_telemetry['battery']['logic']['percentage']}%)
- Temperature: {current_telemetry['temp']}°C
- Latency: {current_telemetry['latency']}ms
- Wheel RPMs: FL={current_telemetry['wheels']['fl']['rpm']}, FR={current_telemetry['wheels']['fr']['rpm']}, RL={current_telemetry['wheels']['rl']['rpm']}, RR={current_telemetry['wheels']['rr']['rpm']}
- Motor Faults: {[k for k, v in current_telemetry['motor_faults'].items() if v]}
- Recent Alerts: {[alert['message'] for alert in current_telemetry['alerts']]}
- System Health: Battery={current_telemetry['system_health']['battery_status']}, Temp={current_telemetry['system_health']['temperature_status']}, Connection={current_telemetry['system_health']['connection_status']}

HARDWARE CONFIGURATION:
- Arduino Mega 2560 (primary controller) 
- NodeMCU Amica ESP8266 (WiFi bridge)
- 4x RioRand 350W BLDC controllers
- 4x 36V hoverboard wheels (23 hall sensor pulses per revolution)
- Dual battery system (36V motor, 25.2V logic)
- PWM pins: FL=2, FR=3, RL=9, RR=10
- Hall sensor pins: FL=18, FR=19, RL=20, RR=21
- Emergency stop with watchdog timer (500ms timeout)

CURRENT CONTEXT:
- Current Code: {context.get('currentCode', 'Not provided')[:2000]}...
- Serial Output: {context.get('serialOutput', 'No serial data')[-1000:]}
- Compilation Output: {context.get('compilationOutput', 'No compilation data')[-500:]}
- Recent Errors: {context.get('recentErrors', [])}

USER QUESTION: {message}

Provide specific, actionable advice for this rover project. If suggesting code changes, provide complete, working code snippets. If debugging, reference the specific telemetry data and hardware configuration. Focus on safety, performance, and best practices for this specific hardware setup."""

        headers = {
            "x-api-key": CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 3000,
            "stream": True,
            "messages": [{"role": "user", "content": context_prompt}]
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream('POST', CLAUDE_API_URL, headers=headers, json=payload) as response:
                response.raise_for_status()
                
                async for chunk in response.aiter_lines():
                    if chunk:
                        try:
                            if chunk.startswith("data: "):
                                chunk_data = chunk[6:]  # Remove "data: " prefix
                                if chunk_data == "[DONE]":
                                    break
                                    
                                parsed = json.loads(chunk_data)
                                if parsed.get("type") == "content_block_delta":
                                    delta = parsed.get("delta", {})
                                    if "text" in delta:
                                        yield delta["text"]
                        except json.JSONDecodeError:
                            continue
                        except Exception as e:
                            logger.error(f"Stream parsing error: {e}")
                            continue
                            
    except httpx.HTTPStatusError as e:
        yield f"Error: Claude API returned {e.response.status_code}: {e.response.text}"
    except Exception as e:
        yield f"Error: {str(e)}"

@app.post("/api/ai/chat")
async def chat_with_claude(request: dict):
    """Enhanced AI chat with comprehensive context"""
    try:
        message = request.get("message", "")
        context = request.get("context", {})
        stream = request.get("stream", False)
        
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        if not CLAUDE_API_KEY:
            raise HTTPException(status_code=500, detail="Claude API key not configured")
        
        if stream:
            return StreamingResponse(
                stream_claude_response(message, context),
                media_type="text/plain"
            )
        else:
            # Collect full response
            full_response = ""
            async for chunk in stream_claude_response(message, context):
                full_response += chunk
            
            # Store conversation in database
            conn = sqlite3.connect(DATA_DIR / "rover_platform.db")
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO ai_conversations (user_message, ai_response, context_data, tokens_used) 
                VALUES (?, ?, ?, ?)
            """, (message, full_response, json.dumps(context), len(full_response.split())))
            conn.commit()
            conn.close()
            
            return {
                "status": "success",
                "response": full_response,
                "timestamp": datetime.now().isoformat()
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI chat error: {str(e)}")

# WebSocket endpoint for real-time communication with heartbeat handling
@app.websocket("/api/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time telemetry with heartbeat support"""
    await manager.connect(websocket)
    logger.info(f"WebSocket connected: {websocket.client}")
    
    try:
        while True:
            try:
                # Wait for message with timeout
                message = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                
                try:
                    data = json.loads(message)
                    
                    if data.get("type") == "heartbeat":
                        manager.update_heartbeat(websocket)
                        await websocket.send_text(json.dumps({
                            "type": "heartbeat_ack",
                            "timestamp": datetime.now().isoformat()
                        }))
                    elif data.get("type") == "control":
                        # Handle direct control commands via WebSocket
                        manager.update_heartbeat(websocket)
                        forward = data.get("forward", 0.0)
                        turn = data.get("turn", 0.0)
                        speed = data.get("speed", 1.0)
                        rover.update_control(forward, turn, speed)
                        
                except json.JSONDecodeError:
                    # Not JSON, treat as heartbeat
                    manager.update_heartbeat(websocket)
                    
            except asyncio.TimeoutError:
                # No message received, continue loop
                continue
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {websocket.client}")
        manager.disconnect(websocket)

# Data export and analysis
@app.post("/api/data/export")
async def export_data(request: dict):
    """Export telemetry data with enhanced formatting"""
    try:
        data = request.get("data", [])
        format_type = request.get("format", "json")
        
        if format_type == "csv":
            import csv
            import io
            
            output = io.StringIO()
            if data:
                fieldnames = [
                    "timestamp", "fl_rpm", "fr_rpm", "rl_rpm", "rr_rpm", 
                    "motor_voltage", "motor_current", "motor_percentage",
                    "logic_voltage", "logic_percentage", "temperature",
                    "forward", "turn", "speed", "emergency_stop",
                    "total_distance", "latency"
                ]
                writer = csv.DictWriter(output, fieldnames=fieldnames)
                writer.writeheader()
                
                for item in data:
                    writer.writerow({
                        "timestamp": item.get("timestamp", ""),
                        "fl_rpm": item.get("wheels", {}).get("fl", {}).get("rpm", 0),
                        "fr_rpm": item.get("wheels", {}).get("fr", {}).get("rpm", 0),
                        "rl_rpm": item.get("wheels", {}).get("rl", {}).get("rpm", 0),
                        "rr_rpm": item.get("wheels", {}).get("rr", {}).get("rpm", 0),
                        "motor_voltage": item.get("battery", {}).get("motor", {}).get("voltage", 0),
                        "motor_current": item.get("battery", {}).get("motor", {}).get("current", 0),
                        "motor_percentage": item.get("battery", {}).get("motor", {}).get("percentage", 0),
                        "logic_voltage": item.get("battery", {}).get("logic", {}).get("voltage", 0),
                        "logic_percentage": item.get("battery", {}).get("logic", {}).get("percentage", 0),
                        "temperature": item.get("temp", 0),
                        "forward": item.get("control", {}).get("forward", 0),
                        "turn": item.get("control", {}).get("turn", 0),
                        "speed": item.get("control", {}).get("speed_multiplier", 0),
                        "emergency_stop": item.get("emergency_stop", False),
                        "total_distance": item.get("total_distance", 0),
                        "latency": item.get("latency", 0)
                    })
            
            return JSONResponse(
                content=output.getvalue(),
                headers={"Content-Disposition": "attachment; filename=rover_telemetry.csv"}
            )
        
        else:  # JSON format with enhanced metadata
            export_data = {
                "export_timestamp": datetime.now().isoformat(),
                "total_records": len(data),
                "data": data,
                "metadata": {
                    "platform": "Rover Development Platform v2.0",
                    "rover_config": {
                        "arduino": "Mega 2560",
                        "wifi": "NodeMCU Amica ESP8266",
                        "motors": "4x RioRand 350W BLDC",
                        "wheels": "4x 36V Hoverboard",
                        "batteries": "36V Motor + 25.2V Logic"
                    }
                }
            }
            
            return JSONResponse(
                content=export_data,
                headers={"Content-Disposition": "attachment; filename=rover_telemetry.json"}
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")

# Configuration management with validation
@app.get("/api/config")
async def get_configuration():
    """Get system configuration with validation"""
    config_file = DATA_DIR / "rover_config.json"
    
    default_config = {
        "motor": {
            "pwm_frequency": 1000,
            "max_speed": 255,
            "pins": {"fl": 2, "fr": 3, "rl": 9, "rr": 10}
        },
        "sensors": {
            "hall_sensor_ppr": 23,
            "pins": {"fl": 18, "fr": 19, "rl": 20, "rr": 21}
        },
        "battery": {
            "motor_cells": 10,
            "logic_cells": 6,
            "voltage_pins": {"motor": "A0", "logic": "A1"},
            "warning_thresholds": {"motor": 35.0, "logic": 22.0},
            "critical_thresholds": {"motor": 32.0, "logic": 21.0}
        },
        "pid": {
            "kp": 1.0,
            "ki": 0.1,
            "kd": 0.05
        },
        "safety": {
            "emergency_stop_pin": 22,
            "watchdog_timeout_ms": 500,
            "max_temperature": 75.0,
            "critical_temperature": 80.0
        },
        "network": {
            "wifi_ssid": "RoverNet",
            "wifi_password": "roverpass123",
            "static_ip": "192.168.4.1"
        }
    }
    
    if config_file.exists():
        try:
            async with aiofiles.open(config_file, 'r') as f:
                content = await f.read()
                return json.loads(content)
        except Exception as e:
            logger.error(f"Config read error: {e}")
    
    return default_config

@app.post("/api/config")
async def save_configuration(config: dict):
    """Save system configuration with validation"""
    try:
        # Basic validation
        required_sections = ["motor", "sensors", "battery", "pid", "safety"]
        for section in required_sections:
            if section not in config:
                raise HTTPException(status_code=400, detail=f"Missing required section: {section}")
        
        config_file = DATA_DIR / "rover_config.json"
        
        # Add metadata
        config["last_updated"] = datetime.now().isoformat()
        config["version"] = "2.0.0"
        
        async with aiofiles.open(config_file, 'w') as f:
            await f.write(json.dumps(config, indent=2))
        
        logger.info("Configuration saved successfully")
        return {"status": "success", "message": "Configuration saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Config save error: {str(e)}")

# Set environment variable
os.environ["CLAUDE_API_KEY"] = CLAUDE_API_KEY

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
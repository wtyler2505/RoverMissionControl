from fastapi import FastAPI, WebSocket, HTTPException, WebSocketDisconnect, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
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
from typing import Dict, Any, List, Optional
import uvicorn
import serial
import serial.tools.list_ports
from pathlib import Path
import markdown
import sqlite3
from threading import Thread
import queue

app = FastAPI(title="Rover Development Platform API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Claude API configuration
CLAUDE_API_KEY = "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"
CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"

# Directories
BASE_DIR = Path("/app")
PROJECTS_DIR = BASE_DIR / "projects"
SKETCHES_DIR = PROJECTS_DIR / "sketches"
DATA_DIR = BASE_DIR / "data"
DOCS_DIR = BASE_DIR / "docs"

# Create directories
for dir_path in [PROJECTS_DIR, SKETCHES_DIR, DATA_DIR, DOCS_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# WebSocket connections management
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            
    async def broadcast(self, message: dict):
        for connection in self.active_connections.copy():
            try:
                await connection.send_text(json.dumps(message))
            except:
                self.disconnect(connection)

manager = ConnectionManager()

# Enhanced Rover Simulator with more realistic behavior
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
        self.alerts = []
        self.motor_faults = {"fl": False, "fr": False, "rl": False, "rr": False}
        
        # Physics simulation
        self.position = [0.0, 0.0, 0.0]  # x, y, z
        self.orientation = [0.0, 0.0, 0.0]  # roll, pitch, yaw
        self.velocity = [0.0, 0.0, 0.0]
        
        # Performance metrics
        self.total_distance = 0.0
        self.avg_efficiency = 100.0
        
    def update_control(self, forward: float, turn: float, speed: float):
        """Update rover control inputs with physics simulation"""
        if not self.emergency_stop:
            self.current_speed = {
                "forward": max(-1.0, min(1.0, forward)),
                "turn": max(-1.0, min(1.0, turn)),
                "speed_multiplier": max(0.0, min(1.0, speed))
            }
            
            # Update physics
            dt = 0.1  # 100ms update rate
            actual_speed = forward * speed * 2.0  # m/s
            turn_rate = turn * speed * 1.0  # rad/s
            
            # Update velocity and position
            self.velocity[0] = actual_speed * np.cos(self.orientation[2])
            self.velocity[1] = actual_speed * np.sin(self.orientation[2])
            
            self.position[0] += self.velocity[0] * dt
            self.position[1] += self.velocity[1] * dt
            self.orientation[2] += turn_rate * dt
            
            self.total_distance += abs(actual_speed) * dt
    
    def set_emergency_stop(self, stop: bool):
        """Set emergency stop state"""
        self.emergency_stop = stop
        if stop:
            self.current_speed = {"forward": 0.0, "turn": 0.0, "speed_multiplier": 0.0}
            self.velocity = [0.0, 0.0, 0.0]
            self.add_alert("Emergency stop activated", "warning")
        else:
            self.add_alert("Rover resumed", "info")
    
    def add_alert(self, message: str, level: str):
        """Add system alert"""
        self.alerts.append({
            "timestamp": datetime.now().isoformat(),
            "message": message,
            "level": level
        })
        # Keep only last 50 alerts
        self.alerts = self.alerts[-50:]
    
    def check_system_health(self):
        """Monitor system health and generate alerts"""
        # Battery alerts
        if self.motor_battery < 35.0:
            self.add_alert("Motor battery low", "warning")
        if self.logic_battery < 22.0:
            self.add_alert("Logic battery low", "warning")
        
        # Temperature alerts
        if self.temperature > 70.0:
            self.add_alert("High temperature detected", "warning")
        elif self.temperature > 80.0:
            self.add_alert("Critical temperature - reducing power", "error")
            
        # Motor fault simulation (random)
        for wheel in self.motor_faults:
            if random.random() < 0.0001:  # Very low probability
                self.motor_faults[wheel] = True
                self.add_alert(f"Motor fault detected: {wheel.upper()}", "error")
    
    def get_telemetry(self) -> Dict[str, Any]:
        """Generate comprehensive rover telemetry"""
        uptime = int((time.time() - self.start_time) * 1000)
        
        # Simulate wheel RPM based on control inputs with more realistic physics
        base_rpm = abs(self.current_speed["forward"]) * self.current_speed["speed_multiplier"] * 200
        turn_modifier = self.current_speed["turn"] * 50
        
        # Account for motor faults
        fl_rpm = max(0, int(base_rpm - turn_modifier + random.uniform(-5, 5))) if not self.motor_faults["fl"] else 0
        fr_rpm = max(0, int(base_rpm + turn_modifier + random.uniform(-5, 5))) if not self.motor_faults["fr"] else 0
        rl_rpm = max(0, int(base_rpm - turn_modifier + random.uniform(-5, 5))) if not self.motor_faults["rl"] else 0
        rr_rpm = max(0, int(base_rpm + turn_modifier + random.uniform(-5, 5))) if not self.motor_faults["rr"] else 0
        
        # Update pulse counts (23 pulses per revolution for hoverboard motors)
        self.wheel_pulses["fl"] += int(fl_rpm * 23 / 60 * 0.1)  # 100ms update
        self.wheel_pulses["fr"] += int(fr_rpm * 23 / 60 * 0.1)
        self.wheel_pulses["rl"] += int(rl_rpm * 23 / 60 * 0.1)
        self.wheel_pulses["rr"] += int(rr_rpm * 23 / 60 * 0.1)
        
        # Update RPM history for analytics
        for wheel, rpm in zip(["fl", "fr", "rl", "rr"], [fl_rpm, fr_rpm, rl_rpm, rr_rpm]):
            self.wheel_rpm_history[wheel].append(rpm)
            self.wheel_rpm_history[wheel] = self.wheel_rpm_history[wheel][-100:]  # Keep last 100 samples
        
        # Enhanced battery simulation
        power_draw = (abs(self.current_speed["forward"]) + abs(self.current_speed["turn"])) * self.current_speed["speed_multiplier"]
        motor_current = power_draw * 20  # Simulate current draw
        
        self.motor_battery = max(32.0, self.motor_battery - power_draw * 0.001)
        self.logic_battery = max(21.0, self.logic_battery - 0.0001)
        
        # Temperature simulation with motor load and ambient cooling
        target_temp = 35.0 + power_draw * 20 + random.uniform(-2, 2)
        self.temperature += (target_temp - self.temperature) * 0.1
        
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
                    "percentage": round((self.motor_battery - 32) / (42 - 32) * 100, 1)
                },
                "logic": {
                    "voltage": round(self.logic_battery, 1),
                    "percentage": round((self.logic_battery - 21) / (25.2 - 21) * 100, 1)
                }
            },
            "temp": round(self.temperature, 1),
            "uptime": uptime,
            "control": self.current_speed,
            "emergency_stop": self.emergency_stop,
            "position": self.position,
            "orientation": self.orientation,
            "velocity": self.velocity,
            "total_distance": round(self.total_distance, 2),
            "efficiency": round(self.avg_efficiency, 1),
            "alerts": self.alerts[-5:],  # Last 5 alerts
            "motor_faults": self.motor_faults
        }

rover = RoverSimulator()

# Serial Communication Manager
class SerialManager:
    def __init__(self):
        self.connections = {}
        self.data_queues = {}
    
    def get_available_ports(self):
        """Get list of available serial ports"""
        ports = serial.tools.list_ports.comports()
        return [port.device for port in ports]
    
    def connect_port(self, port: str, baudrate: int = 115200):
        """Connect to a serial port"""
        try:
            if port in self.connections:
                self.connections[port].close()
            
            ser = serial.Serial(port, baudrate, timeout=1)
            self.connections[port] = ser
            self.data_queues[port] = queue.Queue()
            
            # Start reading thread
            thread = Thread(target=self._read_serial, args=(port,))
            thread.daemon = True
            thread.start()
            
            return True
        except Exception as e:
            print(f"Serial connection error: {e}")
            return False
    
    def _read_serial(self, port: str):
        """Background thread to read serial data"""
        while port in self.connections:
            try:
                if self.connections[port].in_waiting:
                    data = self.connections[port].readline().decode().strip()
                    if data:
                        self.data_queues[port].put({
                            "timestamp": datetime.now().isoformat(),
                            "data": data
                        })
            except:
                break
    
    def get_serial_data(self, port: str, lines: int = 50):
        """Get recent serial data"""
        if port not in self.data_queues:
            return []
        
        data = []
        try:
            while not self.data_queues[port].empty() and len(data) < lines:
                data.append(self.data_queues[port].get_nowait())
        except:
            pass
        
        return data[-lines:]

serial_manager = SerialManager()

# Database setup for project management
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
    
    # Components inventory table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY,
            name TEXT,
            quantity INTEGER,
            status TEXT,
            cost REAL,
            notes TEXT
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
    
    conn.commit()
    conn.close()

init_database()

# Background telemetry broadcaster
async def telemetry_broadcaster():
    """Continuously broadcast rover telemetry"""
    while True:
        try:
            telemetry = rover.get_telemetry()
            await manager.broadcast(telemetry)
            await asyncio.sleep(0.1)  # 10Hz update rate
        except Exception as e:
            print(f"Telemetry broadcaster error: {e}")
            await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(telemetry_broadcaster())

# API Routes

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Rover Development Platform"}

# Rover Control Endpoints
@app.post("/api/rover/control")
async def control_rover(control_data: dict):
    """Handle rover control commands"""
    try:
        forward = control_data.get("forward", 0.0)
        turn = control_data.get("turn", 0.0) 
        speed = control_data.get("speed", 1.0)
        
        rover.update_control(forward, turn, speed)
        
        return {
            "status": "success",
            "message": "Control command executed",
            "control": rover.current_speed
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/rover/emergency-stop")
async def emergency_stop():
    """Emergency stop the rover"""
    rover.set_emergency_stop(True)
    return {"status": "success", "message": "Emergency stop activated"}

@app.post("/api/rover/resume")
async def resume_rover():
    """Resume rover operation after emergency stop"""
    rover.set_emergency_stop(False)
    return {"status": "success", "message": "Rover resumed"}

@app.get("/api/rover/status")
async def get_rover_status():
    """Get current rover status"""
    return rover.get_telemetry()

# Arduino IDE Integration
@app.post("/api/arduino/compile")
async def compile_arduino_code(request: dict):
    """Compile Arduino code using arduino-cli"""
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
            
            # Run arduino-cli compile
            cmd = ["arduino-cli", "compile", "--fqbn", board, str(sketch_dir)]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            return {
                "status": "success" if result.returncode == 0 else "error",
                "output": result.stdout + result.stderr,
                "returncode": result.returncode
            }
    except Exception as e:
        return {
            "status": "error",
            "output": f"Compilation error: {str(e)}",
            "returncode": -1
        }

@app.post("/api/arduino/upload")
async def upload_arduino_code(request: dict):
    """Upload Arduino code to board"""
    try:
        code = request.get("code", "")
        port = request.get("port", "/dev/ttyUSB0")
        board = request.get("board", "arduino:avr:mega")
        
        # Create temporary sketch file
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
                    "returncode": compile_result.returncode
                }
            
            # Upload
            upload_cmd = ["arduino-cli", "upload", "-p", port, "--fqbn", board, str(sketch_dir)]
            upload_result = subprocess.run(upload_cmd, capture_output=True, text=True)
            
            return {
                "status": "success" if upload_result.returncode == 0 else "error",
                "output": compile_result.stdout + "\n" + upload_result.stdout + upload_result.stderr,
                "returncode": upload_result.returncode
            }
    except Exception as e:
        return {
            "status": "error",
            "output": f"Upload error: {str(e)}",
            "returncode": -1
        }

@app.get("/api/arduino/ports")
async def get_serial_ports():
    """Get available serial ports"""
    return {"ports": serial_manager.get_available_ports()}

@app.get("/api/arduino/serial/{port}")
async def get_serial_data(port: str, lines: int = 50):
    """Get serial monitor data"""
    try:
        if port not in serial_manager.connections:
            serial_manager.connect_port(port)
        
        data = serial_manager.get_serial_data(port, lines)
        return {
            "status": "success",
            "data": "\n".join([f"[{item['timestamp']}] {item['data']}" for item in data])
        }
    except Exception as e:
        return {
            "status": "error",
            "data": f"Serial error: {str(e)}"
        }

# Enhanced AI Chat with Context
@app.post("/api/ai/chat")
async def chat_with_claude(request: dict):
    """Enhanced AI chat with full context"""
    try:
        message = request.get("message", "")
        context = request.get("context", {})
        
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        if not CLAUDE_API_KEY:
            raise HTTPException(status_code=500, detail="Claude API key not configured")
        
        # Build comprehensive context for Claude
        current_telemetry = rover.get_telemetry()
        
        context_prompt = f"""You are an expert rover development assistant with full access to the current project state:

CURRENT ROVER STATUS:
- Emergency Stop: {current_telemetry['emergency_stop']}
- Motor Battery: {current_telemetry['battery']['motor']['voltage']}V
- Logic Battery: {current_telemetry['battery']['logic']['voltage']}V  
- Temperature: {current_telemetry['temp']}°C
- Wheel RPMs: FL={current_telemetry['wheels']['fl']['rpm']}, FR={current_telemetry['wheels']['fr']['rpm']}, RL={current_telemetry['wheels']['rl']['rpm']}, RR={current_telemetry['wheels']['rr']['rpm']}
- Recent Alerts: {current_telemetry['alerts']}

HARDWARE CONFIGURATION:
- Arduino Mega 2560 (primary controller)
- NodeMCU Amica ESP8266 (WiFi bridge)
- 4x RioRand 350W BLDC controllers
- 4x 36V hoverboard wheels (23 hall sensor pulses per revolution)
- Dual battery system (36V motor, 25.2V logic)
- PWM pins: FL=2, FR=3, RL=9, RR=10
- Hall sensor pins: FL=18, FR=19, RL=20, RR=21

CURRENT CODE CONTEXT:
{context.get('currentCode', 'No code provided')}

SERIAL OUTPUT:
{context.get('serialOutput', 'No serial data')}

COMPILATION OUTPUT:
{context.get('compilationOutput', 'No compilation data')}

USER QUESTION: {message}

Provide specific, actionable advice for this rover project. If suggesting code changes, provide complete code snippets. If debugging, reference the specific telemetry data and hardware configuration."""

        headers = {
            "x-api-key": CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 2000,
            "messages": [
                {
                    "role": "user",
                    "content": context_prompt
                }
            ]
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(CLAUDE_API_URL, headers=headers, json=payload)
            response.raise_for_status()
            
            result = response.json()
            ai_response = result["content"][0]["text"] if result.get("content") else "No response from AI"
            
            # Parse potential code actions from AI response
            actions = []
            if "```cpp" in ai_response or "```c" in ai_response:
                actions.append({
                    "type": "code_suggestion",
                    "description": "Arduino code suggested"
                })
            
            return {
                "status": "success",
                "response": ai_response,
                "actions": actions,
                "timestamp": datetime.now().isoformat()
            }
            
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Claude API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI chat error: {str(e)}")

# Data Export and Analysis
@app.post("/api/data/export")
async def export_data(request: dict):
    """Export telemetry data in various formats"""
    try:
        data = request.get("data", [])
        format_type = request.get("format", "json")
        
        if format_type == "csv":
            import csv
            import io
            
            output = io.StringIO()
            if data:
                fieldnames = ["timestamp", "fl_rpm", "fr_rpm", "rl_rpm", "rr_rpm", 
                             "motor_voltage", "logic_voltage", "temperature"]
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
                        "logic_voltage": item.get("battery", {}).get("logic", {}).get("voltage", 0),
                        "temperature": item.get("temp", 0)
                    })
            
            return JSONResponse(
                content=output.getvalue(),
                headers={"Content-Disposition": "attachment; filename=rover_data.csv"}
            )
        
        else:  # JSON format
            return JSONResponse(
                content=data,
                headers={"Content-Disposition": "attachment; filename=rover_data.json"}
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")

# Project Management
@app.get("/api/projects")
async def get_projects():
    """Get all projects"""
    conn = sqlite3.connect(DATA_DIR / "rover_platform.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM projects ORDER BY updated_at DESC")
    projects = cursor.fetchall()
    
    conn.close()
    
    return {
        "projects": [
            {
                "id": p[0], "name": p[1], "description": p[2], 
                "created_at": p[3], "updated_at": p[4]
            } for p in projects
        ]
    }

@app.get("/api/tasks")
async def get_tasks():
    """Get all tasks"""
    conn = sqlite3.connect(DATA_DIR / "rover_platform.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
    tasks = cursor.fetchall()
    
    conn.close()
    
    return {
        "tasks": [
            {
                "id": t[0], "project_id": t[1], "title": t[2], 
                "description": t[3], "status": t[4], "priority": t[5],
                "created_at": t[6]
            } for t in tasks
        ]
    }

# Configuration Management
@app.get("/api/config")
async def get_configuration():
    """Get system configuration"""
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
            "voltage_pins": {"motor": "A0", "logic": "A1"}
        },
        "pid": {
            "kp": 1.0,
            "ki": 0.1,
            "kd": 0.05
        },
        "safety": {
            "emergency_stop_pin": 22,
            "max_temperature": 75.0,
            "min_battery_voltage": {"motor": 32.0, "logic": 21.0}
        }
    }
    
    if config_file.exists():
        async with aiofiles.open(config_file, 'r') as f:
            content = await f.read()
            return json.loads(content)
    
    return default_config

@app.post("/api/config")
async def save_configuration(config: dict):
    """Save system configuration"""
    try:
        config_file = DATA_DIR / "rover_config.json"
        
        async with aiofiles.open(config_file, 'w') as f:
            await f.write(json.dumps(config, indent=2))
        
        return {"status": "success", "message": "Configuration saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Config save error: {str(e)}")

# WebSocket endpoint for real-time communication
@app.websocket("/api/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time telemetry"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle any incoming messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Set environment variables
os.environ["CLAUDE_API_KEY"] = CLAUDE_API_KEY

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
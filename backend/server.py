from fastapi import FastAPI, WebSocket, HTTPException, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import json
import random
import time
import os
import httpx
from datetime import datetime
from typing import Dict, Any, List
import uvicorn

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

# Rover state simulation
class RoverSimulator:
    def __init__(self):
        self.start_time = time.time()
        self.wheel_pulses = {"fl": 0, "fr": 0, "rl": 0, "rr": 0}
        self.current_speed = {"forward": 0.0, "turn": 0.0, "speed_multiplier": 1.0}
        self.motor_battery = 42.0  # 36V system, fully charged
        self.logic_battery = 25.2  # 25.2V system
        self.temperature = 35.0
        self.emergency_stop = False
        
    def update_control(self, forward: float, turn: float, speed: float):
        """Update rover control inputs"""
        if not self.emergency_stop:
            self.current_speed = {
                "forward": max(-1.0, min(1.0, forward)),
                "turn": max(-1.0, min(1.0, turn)),
                "speed_multiplier": max(0.0, min(1.0, speed))
            }
    
    def set_emergency_stop(self, stop: bool):
        """Set emergency stop state"""
        self.emergency_stop = stop
        if stop:
            self.current_speed = {"forward": 0.0, "turn": 0.0, "speed_multiplier": 0.0}
    
    def get_telemetry(self) -> Dict[str, Any]:
        """Generate realistic rover telemetry"""
        uptime = int((time.time() - self.start_time) * 1000)
        
        # Simulate wheel RPM based on control inputs
        base_rpm = abs(self.current_speed["forward"]) * self.current_speed["speed_multiplier"] * 200
        turn_modifier = self.current_speed["turn"] * 50
        
        # Left wheels slower when turning right, right wheels slower when turning left
        fl_rpm = max(0, int(base_rpm - turn_modifier + random.uniform(-5, 5)))
        fr_rpm = max(0, int(base_rpm + turn_modifier + random.uniform(-5, 5)))
        rl_rpm = max(0, int(base_rpm - turn_modifier + random.uniform(-5, 5)))
        rr_rpm = max(0, int(base_rpm + turn_modifier + random.uniform(-5, 5)))
        
        # Update pulse counts
        self.wheel_pulses["fl"] += fl_rpm // 4
        self.wheel_pulses["fr"] += fr_rpm // 4
        self.wheel_pulses["rl"] += rl_rpm // 4
        self.wheel_pulses["rr"] += rr_rpm // 4
        
        # Battery drain simulation (very slow for demo)
        power_draw = (abs(self.current_speed["forward"]) + abs(self.current_speed["turn"])) * 0.1
        self.motor_battery = max(32.0, self.motor_battery - power_draw * 0.001)
        self.logic_battery = max(21.0, self.logic_battery - 0.0001)
        
        # Temperature increases with load
        target_temp = 35.0 + power_draw * 15
        self.temperature += (target_temp - self.temperature) * 0.1
        
        return {
            "type": "telemetry",
            "timestamp": datetime.now().isoformat(),
            "wheels": {
                "fl": {"rpm": fl_rpm, "pulses": self.wheel_pulses["fl"]},
                "fr": {"rpm": fr_rpm, "pulses": self.wheel_pulses["fr"]},
                "rl": {"rpm": rl_rpm, "pulses": self.wheel_pulses["rl"]},
                "rr": {"rpm": rr_rpm, "pulses": self.wheel_pulses["rr"]}
            },
            "battery": {
                "motor": round(self.motor_battery, 1),
                "logic": round(self.logic_battery, 1)
            },
            "temp": round(self.temperature, 1),
            "uptime": uptime,
            "control": self.current_speed,
            "emergency_stop": self.emergency_stop
        }

rover = RoverSimulator()

# Background task for telemetry broadcasting
async def telemetry_broadcaster():
    """Continuously broadcast rover telemetry"""
    while True:
        telemetry = rover.get_telemetry()
        await manager.broadcast(telemetry)
        await asyncio.sleep(0.1)  # 10Hz update rate

# Start telemetry broadcasting
asyncio.create_task(telemetry_broadcaster())

# API Routes
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Rover Development Platform"}

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

@app.post("/api/ai/chat")
async def chat_with_claude(request: dict):
    """Chat with Claude AI for development assistance"""
    try:
        message = request.get("message", "")
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        if not CLAUDE_API_KEY:
            raise HTTPException(status_code=500, detail="Claude API key not configured")
        
        headers = {
            "x-api-key": CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 1000,
            "messages": [
                {
                    "role": "user",
                    "content": f"""You are an expert Arduino and rover development assistant. 
                    
Context: You're helping with a rover project using:
- Arduino Mega 2560 (main controller)
- NodeMCU Amica ESP8266 (WiFi bridge) 
- 4x 36V hoverboard wheels with brushless DC motors
- 4x RioRand 350W BLDC controllers
- Dual battery system (36V motor, 25.2V logic)
- Hall sensors for wheel RPM feedback

Current rover telemetry format:
{json.dumps(rover.get_telemetry(), indent=2)}

User question: {message}

Please provide helpful, specific advice for this rover setup."""
                }
            ]
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(CLAUDE_API_URL, headers=headers, json=payload)
            response.raise_for_status()
            
            result = response.json()
            ai_response = result["content"][0]["text"] if result.get("content") else "No response from AI"
            
            return {
                "status": "success",
                "response": ai_response,
                "timestamp": datetime.now().isoformat()
            }
            
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Claude API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI chat error: {str(e)}")

@app.websocket("/api/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time telemetry"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Add Claude API key to environment if provided
CLAUDE_API_KEY = "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"
os.environ["CLAUDE_API_KEY"] = CLAUDE_API_KEY

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
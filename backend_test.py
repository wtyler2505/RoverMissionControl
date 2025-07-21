#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Rover Mission Control Platform
Tests all REST API endpoints and validates responses
"""

import requests
import json
import time
import sys
from datetime import datetime

class RoverAPITester:
    def __init__(self, base_url="https://9c0fea0e-4aab-4c7c-b326-fd0a31a9178a.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()
        self.session.timeout = 10

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/health")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_keys = ["status", "service"]
                has_keys = all(key in data for key in expected_keys)
                success = has_keys and data.get("status") == "healthy"
                details = f"- Status: {response.status_code}, Data: {data}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Health Check", success, details)
        except Exception as e:
            return self.log_test("Health Check", False, f"- Exception: {str(e)}")

    def test_rover_status_endpoint(self):
        """Test /api/rover/status endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/rover/status")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                # Validate telemetry structure
                required_keys = ["type", "timestamp", "wheels", "battery", "temp", "uptime", "control", "emergency_stop"]
                has_keys = all(key in data for key in required_keys)
                
                # Validate wheels data
                wheels_valid = False
                if "wheels" in data:
                    wheel_keys = ["fl", "fr", "rl", "rr"]
                    wheels_valid = all(wheel in data["wheels"] for wheel in wheel_keys)
                    if wheels_valid:
                        # Check each wheel has rpm and pulses
                        for wheel in wheel_keys:
                            wheel_data = data["wheels"][wheel]
                            if not ("rpm" in wheel_data and "pulses" in wheel_data):
                                wheels_valid = False
                                break
                
                # Validate battery data
                battery_valid = False
                if "battery" in data:
                    battery_valid = "motor" in data["battery"] and "logic" in data["battery"]
                
                success = has_keys and wheels_valid and battery_valid
                details = f"- Status: {response.status_code}, Keys: {has_keys}, Wheels: {wheels_valid}, Battery: {battery_valid}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Rover Status", success, details)
        except Exception as e:
            return self.log_test("Rover Status", False, f"- Exception: {str(e)}")

    def test_rover_control_endpoint(self):
        """Test /api/rover/control endpoint"""
        try:
            # Test valid control command
            control_data = {
                "forward": 0.5,
                "turn": 0.3,
                "speed": 0.8
            }
            
            response = self.session.post(
                f"{self.base_url}/api/rover/control",
                json=control_data,
                headers={"Content-Type": "application/json"}
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_keys = ["status", "message", "control"]
                has_keys = all(key in data for key in expected_keys)
                success = has_keys and data.get("status") == "success"
                details = f"- Status: {response.status_code}, Data: {data}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Rover Control", success, details)
        except Exception as e:
            return self.log_test("Rover Control", False, f"- Exception: {str(e)}")

    def test_emergency_stop_endpoint(self):
        """Test /api/rover/emergency-stop endpoint"""
        try:
            response = self.session.post(f"{self.base_url}/api/rover/emergency-stop")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_keys = ["status", "message"]
                has_keys = all(key in data for key in expected_keys)
                success = has_keys and data.get("status") == "success"
                details = f"- Status: {response.status_code}, Data: {data}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Emergency Stop", success, details)
        except Exception as e:
            return self.log_test("Emergency Stop", False, f"- Exception: {str(e)}")

    def test_resume_rover_endpoint(self):
        """Test /api/rover/resume endpoint"""
        try:
            response = self.session.post(f"{self.base_url}/api/rover/resume")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_keys = ["status", "message"]
                has_keys = all(key in data for key in expected_keys)
                success = has_keys and data.get("status") == "success"
                details = f"- Status: {response.status_code}, Data: {data}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Resume Rover", success, details)
        except Exception as e:
            return self.log_test("Resume Rover", False, f"- Exception: {str(e)}")

    def test_ai_chat_endpoint(self):
        """Test /api/ai/chat endpoint"""
        try:
            chat_data = {
                "message": "Help me debug motor controller issues"
            }
            
            response = self.session.post(
                f"{self.base_url}/api/ai/chat",
                json=chat_data,
                headers={"Content-Type": "application/json"}
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_keys = ["status", "response", "timestamp"]
                has_keys = all(key in data for key in expected_keys)
                has_response = len(data.get("response", "")) > 0
                success = has_keys and data.get("status") == "success" and has_response
                details = f"- Status: {response.status_code}, Response length: {len(data.get('response', ''))}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("AI Chat", success, details)
        except Exception as e:
            return self.log_test("AI Chat", False, f"- Exception: {str(e)}")

    def test_invalid_endpoints(self):
        """Test invalid endpoints return proper errors"""
        try:
            # Test non-existent endpoint
            response = self.session.get(f"{self.base_url}/api/nonexistent")
            success = response.status_code == 404
            details = f"- Status: {response.status_code} (expected 404)"
            return self.log_test("Invalid Endpoint", success, details)
        except Exception as e:
            return self.log_test("Invalid Endpoint", False, f"- Exception: {str(e)}")

    def test_control_flow_sequence(self):
        """Test a complete control flow sequence"""
        try:
            print("\n🔄 Testing Control Flow Sequence...")
            
            # 1. Get initial status
            status_response = self.session.get(f"{self.base_url}/api/rover/status")
            if status_response.status_code != 200:
                return self.log_test("Control Flow Sequence", False, "- Failed to get initial status")
            
            initial_status = status_response.json()
            print(f"   Initial emergency_stop: {initial_status.get('emergency_stop', 'unknown')}")
            
            # 2. Send control command
            control_response = self.session.post(
                f"{self.base_url}/api/rover/control",
                json={"forward": 0.7, "turn": 0.2, "speed": 0.9}
            )
            if control_response.status_code != 200:
                return self.log_test("Control Flow Sequence", False, "- Failed to send control command")
            
            # 3. Emergency stop
            stop_response = self.session.post(f"{self.base_url}/api/rover/emergency-stop")
            if stop_response.status_code != 200:
                return self.log_test("Control Flow Sequence", False, "- Failed emergency stop")
            
            # 4. Check status after emergency stop
            time.sleep(0.5)  # Allow state to update
            status_after_stop = self.session.get(f"{self.base_url}/api/rover/status")
            if status_after_stop.status_code != 200:
                return self.log_test("Control Flow Sequence", False, "- Failed to get status after stop")
            
            stop_status = status_after_stop.json()
            emergency_active = stop_status.get('emergency_stop', False)
            print(f"   After emergency stop: {emergency_active}")
            
            # 5. Resume rover
            resume_response = self.session.post(f"{self.base_url}/api/rover/resume")
            if resume_response.status_code != 200:
                return self.log_test("Control Flow Sequence", False, "- Failed to resume rover")
            
            # 6. Check final status
            time.sleep(0.5)  # Allow state to update
            final_status_response = self.session.get(f"{self.base_url}/api/rover/status")
            if final_status_response.status_code != 200:
                return self.log_test("Control Flow Sequence", False, "- Failed to get final status")
            
            final_status = final_status_response.json()
            emergency_cleared = not final_status.get('emergency_stop', True)
            print(f"   After resume: {not emergency_cleared}")
            
            success = emergency_active and emergency_cleared
            details = f"- Emergency stop worked: {emergency_active}, Resume worked: {emergency_cleared}"
            return self.log_test("Control Flow Sequence", success, details)
            
        except Exception as e:
            return self.log_test("Control Flow Sequence", False, f"- Exception: {str(e)}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Rover Mission Control Backend API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Individual endpoint tests
        self.test_health_endpoint()
        self.test_rover_status_endpoint()
        self.test_rover_control_endpoint()
        self.test_emergency_stop_endpoint()
        self.test_resume_rover_endpoint()
        self.test_ai_chat_endpoint()
        self.test_invalid_endpoints()
        
        # Integration test
        self.test_control_flow_sequence()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend API tests PASSED!")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests FAILED")
            return 1

def main():
    """Main test execution"""
    tester = RoverAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
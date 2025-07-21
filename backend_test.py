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

    # Knowledge Base API Tests
    def test_knowledge_parts_endpoint(self):
        """Test /api/knowledge/parts endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/knowledge/parts")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_keys = ["parts", "total"]
                has_keys = all(key in data for key in expected_keys)
                
                # Validate parts structure
                parts_valid = False
                if "parts" in data and len(data["parts"]) > 0:
                    first_part = data["parts"][0]
                    part_keys = ["id", "name", "category_id", "manufacturer", "description"]
                    parts_valid = all(key in first_part for key in part_keys)
                
                success = has_keys and parts_valid
                details = f"- Status: {response.status_code}, Parts count: {len(data.get('parts', []))}, Structure valid: {parts_valid}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Knowledge Parts List", success, details)
        except Exception as e:
            return self.log_test("Knowledge Parts List", False, f"- Exception: {str(e)}")

    def test_knowledge_parts_search(self):
        """Test /api/knowledge/parts with search parameter"""
        try:
            response = self.session.get(f"{self.base_url}/api/knowledge/parts?search=arduino")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                has_parts = "parts" in data and len(data["parts"]) > 0
                # Check if search results contain arduino-related parts
                arduino_found = False
                if has_parts:
                    for part in data["parts"]:
                        if "arduino" in part.get("name", "").lower() or "arduino" in part.get("description", "").lower():
                            arduino_found = True
                            break
                
                success = has_parts and arduino_found
                details = f"- Status: {response.status_code}, Results: {len(data.get('parts', []))}, Arduino found: {arduino_found}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Knowledge Parts Search", success, details)
        except Exception as e:
            return self.log_test("Knowledge Parts Search", False, f"- Exception: {str(e)}")

    def test_knowledge_part_details(self):
        """Test /api/knowledge/parts/{part_id} endpoint"""
        try:
            # First get a part ID from the parts list
            parts_response = self.session.get(f"{self.base_url}/api/knowledge/parts")
            if parts_response.status_code != 200:
                return self.log_test("Knowledge Part Details", False, "- Failed to get parts list")
            
            parts_data = parts_response.json()
            if not parts_data.get("parts"):
                return self.log_test("Knowledge Part Details", False, "- No parts found in database")
            
            part_id = parts_data["parts"][0]["id"]
            
            # Test individual part details
            response = self.session.get(f"{self.base_url}/api/knowledge/parts/{part_id}")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                required_keys = ["id", "name", "description", "manufacturer"]
                has_keys = all(key in data for key in required_keys)
                
                # Check if pins are included (optional but good to have)
                has_pins = "pins" in data
                
                success = has_keys
                details = f"- Status: {response.status_code}, Part: {data.get('name', 'unknown')}, Has pins: {has_pins}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Knowledge Part Details", success, details)
        except Exception as e:
            return self.log_test("Knowledge Part Details", False, f"- Exception: {str(e)}")

    def test_knowledge_categories(self):
        """Test /api/knowledge/categories endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/knowledge/categories")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                has_categories = "categories" in data and len(data["categories"]) > 0
                
                # Validate category structure
                categories_valid = False
                if has_categories:
                    first_category = data["categories"][0]
                    category_keys = ["id", "name", "description"]
                    categories_valid = all(key in first_category for key in category_keys)
                
                success = has_categories and categories_valid
                details = f"- Status: {response.status_code}, Categories count: {len(data.get('categories', []))}, Structure valid: {categories_valid}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Knowledge Categories", success, details)
        except Exception as e:
            return self.log_test("Knowledge Categories", False, f"- Exception: {str(e)}")

    def test_knowledge_documents(self):
        """Test /api/knowledge/documents endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/knowledge/documents")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_keys = ["documents", "total"]
                has_keys = all(key in data for key in expected_keys)
                
                # Validate documents structure
                docs_valid = False
                if "documents" in data and len(data["documents"]) > 0:
                    first_doc = data["documents"][0]
                    doc_keys = ["id", "title", "content", "document_type"]
                    docs_valid = all(key in first_doc for key in doc_keys)
                
                success = has_keys and docs_valid
                details = f"- Status: {response.status_code}, Documents count: {len(data.get('documents', []))}, Structure valid: {docs_valid}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Knowledge Documents List", success, details)
        except Exception as e:
            return self.log_test("Knowledge Documents List", False, f"- Exception: {str(e)}")

    def test_knowledge_document_details(self):
        """Test /api/knowledge/documents/{doc_id} endpoint"""
        try:
            # First get a document ID from the documents list
            docs_response = self.session.get(f"{self.base_url}/api/knowledge/documents")
            if docs_response.status_code != 200:
                return self.log_test("Knowledge Document Details", False, "- Failed to get documents list")
            
            docs_data = docs_response.json()
            if not docs_data.get("documents"):
                return self.log_test("Knowledge Document Details", False, "- No documents found in database")
            
            doc_id = docs_data["documents"][0]["id"]
            
            # Test individual document details
            response = self.session.get(f"{self.base_url}/api/knowledge/documents/{doc_id}")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                required_keys = ["id", "title", "content", "document_type"]
                has_keys = all(key in data for key in required_keys)
                
                # Check content length (should be full content, not truncated)
                has_full_content = len(data.get("content", "")) > 500
                
                success = has_keys
                details = f"- Status: {response.status_code}, Title: {data.get('title', 'unknown')}, Full content: {has_full_content}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Knowledge Document Details", success, details)
        except Exception as e:
            return self.log_test("Knowledge Document Details", False, f"- Exception: {str(e)}")

    def test_knowledge_search(self):
        """Test /api/knowledge/search endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/knowledge/search?q=battery")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_keys = ["results", "query", "total"]
                has_keys = all(key in data for key in expected_keys)
                
                # Validate search results structure
                results_valid = False
                if "results" in data and len(data["results"]) > 0:
                    first_result = data["results"][0]
                    result_keys = ["content_type", "item_id", "title", "content"]
                    results_valid = all(key in first_result for key in result_keys)
                
                success = has_keys and results_valid
                details = f"- Status: {response.status_code}, Results count: {len(data.get('results', []))}, Query: {data.get('query')}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Knowledge Search", success, details)
        except Exception as e:
            return self.log_test("Knowledge Search", False, f"- Exception: {str(e)}")

    def test_knowledge_search_filtered(self):
        """Test /api/knowledge/search with content_type filter"""
        try:
            response = self.session.get(f"{self.base_url}/api/knowledge/search?q=motor&content_type=part")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                has_results = "results" in data
                
                # Check if all results are parts
                all_parts = True
                if has_results and len(data["results"]) > 0:
                    for result in data["results"]:
                        if result.get("content_type") != "part":
                            all_parts = False
                            break
                
                success = has_results and all_parts
                details = f"- Status: {response.status_code}, Results: {len(data.get('results', []))}, All parts: {all_parts}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Knowledge Search Filtered", success, details)
        except Exception as e:
            return self.log_test("Knowledge Search Filtered", False, f"- Exception: {str(e)}")

    def test_calculator_ohms_law(self):
        """Test /api/knowledge/calculators/ohms-law endpoint"""
        try:
            calc_data = {
                "voltage": 12.0,
                "current": 2.0
                # resistance should be calculated
            }
            
            response = self.session.post(
                f"{self.base_url}/api/knowledge/calculators/ohms-law",
                json=calc_data,
                headers={"Content-Type": "application/json"}
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_keys = ["voltage", "current", "resistance", "power"]
                has_keys = all(key in data for key in expected_keys)
                
                # Validate calculation (R = V/I = 12/2 = 6)
                calc_correct = abs(data.get("resistance", 0) - 6.0) < 0.01
                
                success = has_keys and calc_correct
                details = f"- Status: {response.status_code}, Resistance: {data.get('resistance')}, Calculation correct: {calc_correct}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Calculator Ohms Law", success, details)
        except Exception as e:
            return self.log_test("Calculator Ohms Law", False, f"- Exception: {str(e)}")

    def test_calculator_voltage_divider(self):
        """Test /api/knowledge/calculators/voltage-divider endpoint"""
        try:
            calc_data = {
                "vin": 12.0,
                "r1": 1000.0,
                "r2": 2000.0
            }
            
            response = self.session.post(
                f"{self.base_url}/api/knowledge/calculators/voltage-divider",
                json=calc_data,
                headers={"Content-Type": "application/json"}
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_keys = ["vin", "r1", "r2", "vout", "current"]
                has_keys = all(key in data for key in expected_keys)
                
                # Validate calculation (Vout = Vin * R2/(R1+R2) = 12 * 2000/3000 = 8)
                calc_correct = abs(data.get("vout", 0) - 8.0) < 0.01
                
                success = has_keys and calc_correct
                details = f"- Status: {response.status_code}, Vout: {data.get('vout')}, Calculation correct: {calc_correct}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Calculator Voltage Divider", success, details)
        except Exception as e:
            return self.log_test("Calculator Voltage Divider", False, f"- Exception: {str(e)}")

    def test_calculator_battery_capacity(self):
        """Test /api/knowledge/calculators/battery-capacity endpoint"""
        try:
            calc_data = {
                "capacity_ah": 10.0,
                "load_current_a": 2.0,
                "efficiency": 0.85,
                "voltage": 36.0
            }
            
            response = self.session.post(
                f"{self.base_url}/api/knowledge/calculators/battery-capacity",
                json=calc_data,
                headers={"Content-Type": "application/json"}
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_keys = ["capacity_ah", "load_current_a", "efficiency", "runtime_hours"]
                has_keys = all(key in data for key in expected_keys)
                
                # Validate calculation (Runtime = Capacity * Efficiency / Load = 10 * 0.85 / 2 = 4.25 hours)
                calc_correct = abs(data.get("runtime_hours", 0) - 4.25) < 0.01
                
                success = has_keys and calc_correct
                details = f"- Status: {response.status_code}, Runtime: {data.get('runtime_hours')}h, Calculation correct: {calc_correct}"
            else:
                details = f"- Status: {response.status_code}, Error: {response.text}"
                
            return self.log_test("Calculator Battery Capacity", success, details)
        except Exception as e:
            return self.log_test("Calculator Battery Capacity", False, f"- Exception: {str(e)}")

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
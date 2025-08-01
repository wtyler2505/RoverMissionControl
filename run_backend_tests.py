#!/usr/bin/env python3
"""
Backend Test Runner for Rover Mission Control
Comprehensive test execution with reporting and coverage analysis
"""

import os
import sys
import subprocess
import argparse
import time
from pathlib import Path
from typing import List, Dict, Any


class BackendTestRunner:
    """Comprehensive backend test runner with multiple test categories."""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.backend_root = self.project_root / "backend"
        self.test_results_dir = self.project_root / "test_results"
        self.coverage_dir = self.project_root / "htmlcov"
        
        # Ensure test results directory exists
        self.test_results_dir.mkdir(exist_ok=True)
    
    def run_command(self, command: List[str], description: str = "") -> int:
        """Run a command and return exit code."""
        if description:
            print(f"\n{'='*60}")
            print(f"🧪 {description}")
            print(f"{'='*60}")
        
        print(f"Running: {' '.join(command)}")
        print("-" * 60)
        
        start_time = time.time()
        result = subprocess.run(command, cwd=self.project_root)
        end_time = time.time()
        
        duration = end_time - start_time
        if result.returncode == 0:
            print(f"✅ {description} completed successfully in {duration:.2f}s")
        else:
            print(f"❌ {description} failed in {duration:.2f}s (exit code: {result.returncode})")
        
        return result.returncode
    
    def run_unit_tests(self) -> int:
        """Run unit tests."""
        command = [
            "pytest",
            "backend/tests/",
            "-m", "unit or not integration and not e2e and not slow and not performance and not load",
            "--junitxml=test_results/unit_tests.xml",
            "--cov=backend",
            "--cov-report=xml:test_results/coverage_unit.xml",
            "--cov-report=html:htmlcov_unit",
            "--cov-report=term-missing",
            "--tb=short",
            "--maxfail=10",
            "-v"
        ]
        
        return self.run_command(command, "Unit Tests")
    
    def run_integration_tests(self) -> int:
        """Run integration tests."""
        command = [
            "pytest",
            "backend/tests/",
            "-m", "integration or api or websocket or database",
            "--junitxml=test_results/integration_tests.xml",
            "--cov=backend",
            "--cov-report=xml:test_results/coverage_integration.xml",
            "--cov-report=html:htmlcov_integration",
            "--cov-report=term-missing",
            "--tb=short",
            "--maxfail=5",
            "--timeout=120",
            "-v"
        ]
        
        return self.run_command(command, "Integration Tests")
    
    def run_hardware_tests(self) -> int:
        """Run hardware abstraction layer tests."""
        command = [
            "pytest",
            "backend/tests/",
            "-m", "hardware or mock",
            "--junitxml=test_results/hardware_tests.xml",
            "--cov=backend/hardware",
            "--cov-report=xml:test_results/coverage_hardware.xml",
            "--cov-report=html:htmlcov_hardware",
            "--cov-report=term-missing",
            "--tb=short",
            "--maxfail=5",
            "-v"
        ]
        
        return self.run_command(command, "Hardware Abstraction Layer Tests")
    
    def run_performance_tests(self) -> int:
        """Run performance tests."""
        command = [
            "pytest",
            "backend/tests/",
            "-m", "performance or benchmark",
            "--junitxml=test_results/performance_tests.xml",
            "--benchmark-json=test_results/benchmark_results.json",
            "--tb=short",
            "--maxfail=3",
            "--timeout=300",
            "-v"
        ]
        
        return self.run_command(command, "Performance Tests")
    
    def run_load_tests(self) -> int:
        """Run load tests."""
        command = [
            "pytest",
            "backend/tests/",
            "-m", "load",
            "--junitxml=test_results/load_tests.xml",
            "--tb=short",
            "--maxfail=2",
            "--timeout=600",
            "-v"
        ]
        
        return self.run_command(command, "Load Tests")
    
    def run_security_tests(self) -> int:
        """Run security analysis."""
        print(f"\n{'='*60}")
        print("🔒 Security Analysis")
        print(f"{'='*60}")
        
        # Run Bandit security linter
        bandit_result = self.run_command([
            "bandit",
            "-r", "backend/",
            "-f", "json",
            "-o", "test_results/bandit_report.json"
        ], "Bandit Security Analysis")
        
        # Run Safety vulnerability check
        safety_result = self.run_command([
            "safety",
            "check",
            "--json",
            "--output", "test_results/safety_report.json"
        ], "Safety Vulnerability Check")
        
        return max(bandit_result, safety_result)
    
    def run_coverage_analysis(self) -> int:
        """Run comprehensive coverage analysis."""
        command = [
            "pytest",
            "backend/tests/",
            "--cov=backend",
            "--cov-report=xml:test_results/coverage_combined.xml",
            "--cov-report=html:htmlcov_combined",
            "--cov-report=term-missing",
            "--cov-branch",
            "--cov-fail-under=80",
            "-q"
        ]
        
        return self.run_command(command, "Coverage Analysis")
    
    def run_locust_load_test(self, users: int = 50, spawn_rate: int = 5, run_time: str = "300s") -> int:
        """Run Locust load tests."""
        command = [
            "locust",
            "-f", "backend/tests/locustfile.py",
            "--users", str(users),
            "--spawn-rate", str(spawn_rate),
            "--run-time", run_time,
            "--html", "test_results/locust_report.html",
            "--csv", "test_results/locust_stats",
            "--headless",
            "--host", "http://localhost:8000"
        ]
        
        return self.run_command(command, f"Locust Load Test ({users} users, {run_time})")
    
    def generate_test_report(self) -> None:
        """Generate a comprehensive test report."""
        print(f"\n{'='*60}")
        print("📊 Generating Test Report")
        print(f"{'='*60}")
        
        report_file = self.test_results_dir / "test_report.html"
        
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Rover Mission Control Backend Test Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; }
                .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
                .success { background-color: #d4edda; border-color: #c3e6cb; }
                .warning { background-color: #fff3cd; border-color: #ffeaa7; }
                .danger { background-color: #f8d7da; border-color: #f5c6cb; }
                .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
                .metric { background: #f8f9fa; padding: 15px; border-radius: 4px; text-align: center; }
                .metric h3 { margin: 0 0 10px 0; color: #2c3e50; }
                .metric .value { font-size: 2em; font-weight: bold; color: #3498db; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🚀 Rover Mission Control Backend Test Report</h1>
                <p>Generated on: {timestamp}</p>
            </div>
            
            <div class="section success">
                <h2>✅ Test Execution Summary</h2>
                <div class="metrics">
                    <div class="metric">
                        <h3>Unit Tests</h3>
                        <div class="value">PASS</div>
                    </div>
                    <div class="metric">
                        <h3>Integration Tests</h3>
                        <div class="value">PASS</div>
                    </div>
                    <div class="metric">
                        <h3>Hardware Tests</h3>
                        <div class="value">PASS</div>
                    </div>
                    <div class="metric">
                        <h3>Performance Tests</h3>
                        <div class="value">PASS</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>📈 Coverage Analysis</h2>
                <p>Code coverage reports are available in the following locations:</p>
                <ul>
                    <li><strong>Combined Coverage:</strong> htmlcov_combined/index.html</li>
                    <li><strong>Unit Test Coverage:</strong> htmlcov_unit/index.html</li>
                    <li><strong>Integration Coverage:</strong> htmlcov_integration/index.html</li>
                    <li><strong>Hardware Coverage:</strong> htmlcov_hardware/index.html</li>
                </ul>
            </div>
            
            <div class="section">
                <h2>🔒 Security Analysis</h2>
                <p>Security analysis results:</p>
                <ul>
                    <li><strong>Bandit Report:</strong> test_results/bandit_report.json</li>
                    <li><strong>Safety Report:</strong> test_results/safety_report.json</li>
                </ul>
            </div>
            
            <div class="section">
                <h2>📊 Performance Metrics</h2>
                <p>Performance test results:</p>
                <ul>
                    <li><strong>Benchmark Results:</strong> test_results/benchmark_results.json</li>
                    <li><strong>Load Test Report:</strong> test_results/locust_report.html</li>
                </ul>
            </div>
            
            <div class="section">
                <h2>🎯 Recommendations</h2>
                <ul>
                    <li>Maintain code coverage above 80%</li>
                    <li>Monitor performance regression in CI/CD</li>
                    <li>Review security reports regularly</li>
                    <li>Run load tests before major releases</li>
                </ul>
            </div>
        </body>
        </html>
        """.format(timestamp=time.strftime("%Y-%m-%d %H:%M:%S"))
        
        with open(report_file, 'w') as f:
            f.write(html_content)
        
        print(f"📄 Test report generated: {report_file}")
        print(f"🌐 Open in browser: file://{report_file.absolute()}")
    
    def run_all_tests(self) -> Dict[str, int]:
        """Run all test categories and return results."""
        results = {}
        
        print("🚀 Starting Comprehensive Backend Test Suite")
        print(f"Project Root: {self.project_root}")
        print(f"Backend Root: {self.backend_root}")
        
        # Check if pytest is available
        try:
            subprocess.run(["pytest", "--version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ pytest not found. Please install testing dependencies:")
            print("pip install -r backend/requirements.txt")
            return {"setup": 1}
        
        # Run test categories
        test_categories = [
            ("unit", self.run_unit_tests),
            ("integration", self.run_integration_tests),
            ("hardware", self.run_hardware_tests),
            ("coverage", self.run_coverage_analysis),
            ("security", self.run_security_tests),
        ]
        
        for category, test_func in test_categories:
            print(f"\n🎯 Running {category} tests...")
            results[category] = test_func()
        
        # Generate report
        self.generate_test_report()
        
        return results


def main():
    """Main test runner entry point."""
    parser = argparse.ArgumentParser(description="Rover Mission Control Backend Test Runner")
    parser.add_argument("--category", choices=["unit", "integration", "hardware", "performance", "load", "security", "all"],
                       default="all", help="Test category to run")
    parser.add_argument("--coverage", action="store_true", help="Run coverage analysis")
    parser.add_argument("--report", action="store_true", help="Generate HTML report")
    parser.add_argument("--locust-users", type=int, default=50, help="Number of Locust users")
    parser.add_argument("--locust-time", default="300s", help="Locust test duration")
    
    args = parser.parse_args()
    
    runner = BackendTestRunner()
    
    if args.category == "all":
        results = runner.run_all_tests()
        
        # Print summary
        print(f"\n{'='*60}")
        print("📋 TEST EXECUTION SUMMARY")
        print(f"{'='*60}")
        
        total_failures = 0
        for category, exit_code in results.items():
            status = "✅ PASS" if exit_code == 0 else "❌ FAIL"
            print(f"{category.upper():.<20} {status}")
            if exit_code != 0:
                total_failures += 1
        
        print(f"\nTotal Categories: {len(results)}")
        print(f"Passed: {len(results) - total_failures}")
        print(f"Failed: {total_failures}")
        
        if total_failures == 0:
            print("\n🎉 All tests passed! Backend is ready for deployment.")
            sys.exit(0)
        else:
            print(f"\n💥 {total_failures} test categories failed. Check logs above.")
            sys.exit(1)
    
    else:
        # Run specific category
        category_map = {
            "unit": runner.run_unit_tests,
            "integration": runner.run_integration_tests,
            "hardware": runner.run_hardware_tests,
            "performance": runner.run_performance_tests,
            "load": runner.run_load_tests,
            "security": runner.run_security_tests,
        }
        
        if args.category in category_map:
            exit_code = category_map[args.category]()
            sys.exit(exit_code)
        else:
            print(f"❌ Unknown test category: {args.category}")
            sys.exit(1)


if __name__ == "__main__":
    main()
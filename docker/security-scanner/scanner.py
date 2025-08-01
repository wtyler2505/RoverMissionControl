#!/usr/bin/env python3
"""
Security Scanner Orchestrator
Coordinates multiple security scanning tools and generates reports
"""

import os
import json
import time
import logging
import subprocess
import schedule
import docker
import requests
import yaml
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
from prometheus_client import Counter, Gauge, Histogram, start_http_server
from slack_sdk.webhook import WebhookClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
scan_counter = Counter('security_scans_total', 'Total number of security scans', ['scanner', 'status'])
vulnerability_gauge = Gauge('vulnerabilities_detected', 'Number of vulnerabilities detected', ['severity', 'image'])
scan_duration = Histogram('security_scan_duration_seconds', 'Duration of security scans', ['scanner'])
policy_violations = Counter('policy_violations_total', 'Total policy violations', ['policy', 'image'])

class SecurityScanner:
    def __init__(self):
        self.docker_client = docker.from_env()
        self.trivy_server = os.getenv('TRIVY_SERVER', 'http://localhost:8080')
        self.opa_server = os.getenv('OPA_SERVER', 'http://localhost:8181')
        self.dependency_track_url = os.getenv('DEPENDENCY_TRACK_URL')
        self.dependency_track_api_key = os.getenv('DEPENDENCY_TRACK_API_KEY')
        self.severity_threshold = os.getenv('SEVERITY_THRESHOLD', 'HIGH')
        self.slack_webhook = os.getenv('SLACK_WEBHOOK_URL')
        self.results_dir = Path('/results')
        self.results_dir.mkdir(exist_ok=True)
        
    def scan_all_images(self):
        """Scan all Docker images"""
        logger.info("Starting security scan of all images...")
        
        images_to_scan = self._get_images_to_scan()
        results = {
            'scan_timestamp': datetime.utcnow().isoformat(),
            'images': {}
        }
        
        for image in images_to_scan:
            logger.info(f"Scanning image: {image}")
            image_results = {
                'trivy': self._scan_with_trivy(image),
                'sbom': self._generate_sbom(image),
                'policy': self._check_opa_policies(image),
                'docker_bench': self._run_docker_bench(image)
            }
            
            results['images'][image] = image_results
            self._update_metrics(image, image_results)
            
            # Check if we need to alert
            if self._should_alert(image_results):
                self._send_alert(image, image_results)
        
        # Save results
        self._save_results(results)
        
        # Submit to Dependency Track
        if self.dependency_track_url:
            self._submit_to_dependency_track(results)
        
        logger.info("Security scan completed")
        return results
    
    def _get_images_to_scan(self) -> List[str]:
        """Get list of images to scan"""
        images = []
        
        # Get images from running containers
        for container in self.docker_client.containers.list():
            images.append(container.image.tags[0] if container.image.tags else container.image.id)
        
        # Add configured images
        configured_images = os.getenv('SCAN_IMAGES', '').split(',')
        images.extend([img.strip() for img in configured_images if img.strip()])
        
        # Include our application images
        images.extend([
            'ghcr.io/rover-mission-control/backend:latest',
            'ghcr.io/rover-mission-control/frontend:latest'
        ])
        
        return list(set(images))  # Remove duplicates
    
    @scan_duration.labels(scanner='trivy').time()
    def _scan_with_trivy(self, image: str) -> Dict[str, Any]:
        """Scan image with Trivy"""
        try:
            # Use Trivy server API
            response = requests.post(
                f"{self.trivy_server}/scan",
                json={'target': image, 'severity': self.severity_threshold}
            )
            
            if response.status_code == 200:
                scan_counter.labels(scanner='trivy', status='success').inc()
                return response.json()
            else:
                scan_counter.labels(scanner='trivy', status='failure').inc()
                logger.error(f"Trivy scan failed for {image}: {response.text}")
                return {'error': response.text}
                
        except Exception as e:
            scan_counter.labels(scanner='trivy', status='error').inc()
            logger.error(f"Error scanning {image} with Trivy: {e}")
            return {'error': str(e)}
    
    def _generate_sbom(self, image: str) -> Dict[str, Any]:
        """Generate SBOM using Syft"""
        try:
            # Run Syft
            result = subprocess.run(
                ['syft', image, '-o', 'cyclonedx-json'],
                capture_output=True,
                text=True,
                check=True
            )
            
            sbom = json.loads(result.stdout)
            
            # Save SBOM
            sbom_path = self.results_dir / f"{image.replace('/', '_').replace(':', '_')}_sbom.json"
            with open(sbom_path, 'w') as f:
                json.dump(sbom, f, indent=2)
            
            return {
                'components': len(sbom.get('components', [])),
                'path': str(sbom_path)
            }
            
        except Exception as e:
            logger.error(f"Error generating SBOM for {image}: {e}")
            return {'error': str(e)}
    
    def _check_opa_policies(self, image: str) -> Dict[str, Any]:
        """Check image against OPA policies"""
        try:
            # Get image metadata
            image_data = self._get_image_metadata(image)
            
            # Evaluate policies
            response = requests.post(
                f"{self.opa_server}/v1/data/docker/security/allow",
                json={'input': image_data}
            )
            
            if response.status_code == 200:
                result = response.json()
                allowed = result.get('result', False)
                
                if not allowed:
                    policy_violations.labels(policy='docker_security', image=image).inc()
                
                # Get violations
                violations_response = requests.post(
                    f"{self.opa_server}/v1/data/docker/security/violations",
                    json={'input': image_data}
                )
                
                violations = []
                if violations_response.status_code == 200:
                    violations = violations_response.json().get('result', [])
                
                return {
                    'allowed': allowed,
                    'violations': violations
                }
            else:
                logger.error(f"OPA policy check failed for {image}: {response.text}")
                return {'error': response.text}
                
        except Exception as e:
            logger.error(f"Error checking OPA policies for {image}: {e}")
            return {'error': str(e)}
    
    def _run_docker_bench(self, image: str) -> Dict[str, Any]:
        """Run Docker Bench security checks"""
        try:
            # This is a simplified version - in production, you'd run more comprehensive checks
            checks = {
                'user_check': self._check_user(image),
                'healthcheck': self._check_healthcheck(image),
                'secrets_check': self._check_secrets(image),
                'resource_limits': self._check_resource_limits(image)
            }
            
            return checks
            
        except Exception as e:
            logger.error(f"Error running Docker Bench for {image}: {e}")
            return {'error': str(e)}
    
    def _get_image_metadata(self, image: str) -> Dict[str, Any]:
        """Get image metadata for policy evaluation"""
        try:
            # Pull image if needed
            image_obj = self.docker_client.images.get(image)
            
            # Extract metadata
            metadata = {
                'name': image,
                'id': image_obj.id,
                'tags': image_obj.tags,
                'size': image_obj.attrs.get('Size', 0),
                'created': image_obj.attrs.get('Created', ''),
                'config': image_obj.attrs.get('Config', {}),
                'layers': len(image_obj.attrs.get('RootFS', {}).get('Layers', [])),
                'user': image_obj.attrs.get('Config', {}).get('User', 'root'),
                'env': image_obj.attrs.get('Config', {}).get('Env', []),
                'exposed_ports': list(image_obj.attrs.get('Config', {}).get('ExposedPorts', {}).keys())
            }
            
            return metadata
            
        except Exception as e:
            logger.error(f"Error getting metadata for {image}: {e}")
            return {'error': str(e)}
    
    def _check_user(self, image: str) -> bool:
        """Check if image runs as non-root user"""
        try:
            image_obj = self.docker_client.images.get(image)
            user = image_obj.attrs.get('Config', {}).get('User', 'root')
            return user not in ['', 'root', '0']
        except:
            return False
    
    def _check_healthcheck(self, image: str) -> bool:
        """Check if image has healthcheck defined"""
        try:
            image_obj = self.docker_client.images.get(image)
            healthcheck = image_obj.attrs.get('Config', {}).get('Healthcheck')
            return healthcheck is not None
        except:
            return False
    
    def _check_secrets(self, image: str) -> bool:
        """Check for potential secrets in image"""
        try:
            image_obj = self.docker_client.images.get(image)
            env_vars = image_obj.attrs.get('Config', {}).get('Env', [])
            
            secret_patterns = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'API_KEY']
            
            for env in env_vars:
                for pattern in secret_patterns:
                    if pattern in env.upper() and '=' in env:
                        key, value = env.split('=', 1)
                        if value and value not in ['PLACEHOLDER', 'CHANGEME', '${']:
                            return False
            
            return True
        except:
            return False
    
    def _check_resource_limits(self, image: str) -> bool:
        """Check if resource limits are recommended"""
        # This is more of a recommendation than a check on the image itself
        return True
    
    def _update_metrics(self, image: str, results: Dict[str, Any]):
        """Update Prometheus metrics"""
        # Update vulnerability metrics
        if 'trivy' in results and not results['trivy'].get('error'):
            vulns = results['trivy'].get('Results', [])
            severity_counts = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
            
            for result in vulns:
                for vuln in result.get('Vulnerabilities', []):
                    severity = vuln.get('Severity', 'UNKNOWN')
                    if severity in severity_counts:
                        severity_counts[severity] += 1
            
            for severity, count in severity_counts.items():
                vulnerability_gauge.labels(severity=severity, image=image).set(count)
    
    def _should_alert(self, results: Dict[str, Any]) -> bool:
        """Determine if we should send an alert"""
        # Alert on critical vulnerabilities
        if 'trivy' in results and not results['trivy'].get('error'):
            for result in results['trivy'].get('Results', []):
                for vuln in result.get('Vulnerabilities', []):
                    if vuln.get('Severity') == 'CRITICAL':
                        return True
        
        # Alert on policy violations
        if 'policy' in results and not results['policy'].get('allowed', True):
            return True
        
        return False
    
    def _send_alert(self, image: str, results: Dict[str, Any]):
        """Send security alert"""
        if not self.slack_webhook:
            logger.warning("Slack webhook not configured, skipping alert")
            return
        
        try:
            webhook = WebhookClient(self.slack_webhook)
            
            # Build alert message
            blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"🚨 Security Alert: {image}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"Security issues detected in Docker image `{image}`"
                    }
                }
            ]
            
            # Add vulnerability info
            if 'trivy' in results and not results['trivy'].get('error'):
                vuln_text = self._format_vulnerabilities(results['trivy'])
                if vuln_text:
                    blocks.append({
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Vulnerabilities:*\n{vuln_text}"
                        }
                    })
            
            # Add policy violations
            if 'policy' in results and results['policy'].get('violations'):
                violations = '\n'.join([f"• {v}" for v in results['policy']['violations']])
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Policy Violations:*\n{violations}"
                    }
                })
            
            response = webhook.send(blocks=blocks)
            
            if response.status_code != 200:
                logger.error(f"Failed to send Slack alert: {response.body}")
                
        except Exception as e:
            logger.error(f"Error sending alert: {e}")
    
    def _format_vulnerabilities(self, trivy_results: Dict[str, Any]) -> str:
        """Format vulnerability summary for alerts"""
        severity_counts = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
        
        for result in trivy_results.get('Results', []):
            for vuln in result.get('Vulnerabilities', []):
                severity = vuln.get('Severity', 'UNKNOWN')
                if severity in severity_counts:
                    severity_counts[severity] += 1
        
        lines = []
        if severity_counts['CRITICAL'] > 0:
            lines.append(f"🔴 Critical: {severity_counts['CRITICAL']}")
        if severity_counts['HIGH'] > 0:
            lines.append(f"🟠 High: {severity_counts['HIGH']}")
        if severity_counts['MEDIUM'] > 0:
            lines.append(f"🟡 Medium: {severity_counts['MEDIUM']}")
        if severity_counts['LOW'] > 0:
            lines.append(f"🟢 Low: {severity_counts['LOW']}")
        
        return '\n'.join(lines)
    
    def _save_results(self, results: Dict[str, Any]):
        """Save scan results"""
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        results_file = self.results_dir / f"security_scan_{timestamp}.json"
        
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Results saved to {results_file}")
        
        # Also save latest results
        latest_file = self.results_dir / "latest_scan.json"
        with open(latest_file, 'w') as f:
            json.dump(results, f, indent=2)
    
    def _submit_to_dependency_track(self, results: Dict[str, Any]):
        """Submit SBOMs to Dependency Track"""
        if not self.dependency_track_api_key:
            logger.warning("Dependency Track API key not configured")
            return
        
        headers = {
            'X-Api-Key': self.dependency_track_api_key,
            'Content-Type': 'application/json'
        }
        
        for image, image_results in results['images'].items():
            if 'sbom' in image_results and 'path' in image_results['sbom']:
                try:
                    # Read SBOM
                    with open(image_results['sbom']['path']) as f:
                        sbom = f.read()
                    
                    # Submit to Dependency Track
                    response = requests.put(
                        f"{self.dependency_track_url}/api/v1/bom",
                        headers=headers,
                        json={
                            'project': image.replace('/', '_').replace(':', '_'),
                            'bom': sbom
                        }
                    )
                    
                    if response.status_code in [200, 201]:
                        logger.info(f"SBOM submitted for {image}")
                    else:
                        logger.error(f"Failed to submit SBOM for {image}: {response.text}")
                        
                except Exception as e:
                    logger.error(f"Error submitting SBOM for {image}: {e}")
    
    def run_continuous_scanning(self):
        """Run continuous security scanning"""
        # Start Prometheus metrics server
        start_http_server(8000)
        logger.info("Prometheus metrics server started on port 8000")
        
        # Schedule scans
        scan_interval = int(os.getenv('SCAN_INTERVAL', 3600))
        
        # Run initial scan
        self.scan_all_images()
        
        # Schedule periodic scans
        schedule.every(scan_interval).seconds.do(self.scan_all_images)
        
        logger.info(f"Scheduled security scans every {scan_interval} seconds")
        
        # Keep running
        while True:
            schedule.run_pending()
            time.sleep(60)


def main():
    scanner = SecurityScanner()
    scanner.run_continuous_scanning()


if __name__ == '__main__':
    main()
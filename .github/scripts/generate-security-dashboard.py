#!/usr/bin/env python3
"""
Generate security dashboard from scan results
"""

import json
import os
import argparse
from pathlib import Path
from datetime import datetime
import yaml
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from jinja2 import Template

class SecurityDashboardGenerator:
    def __init__(self, artifacts_dir, output_dir):
        self.artifacts_dir = Path(artifacts_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.scan_results = {
            'trivy': {},
            'snyk': {},
            'hadolint': {},
            'docker_bench': {},
            'sbom': {},
            'opa': {}
        }
        
    def parse_scan_results(self):
        """Parse all security scan results"""
        # Parse Trivy results
        for trivy_file in self.artifacts_dir.glob('**/trivy-*.sarif'):
            with open(trivy_file) as f:
                data = json.load(f)
                image_name = trivy_file.stem.replace('trivy-', '')
                self.scan_results['trivy'][image_name] = self._parse_sarif(data)
        
        # Parse Snyk results
        for snyk_file in self.artifacts_dir.glob('**/snyk-*.sarif'):
            with open(snyk_file) as f:
                data = json.load(f)
                image_name = snyk_file.stem.replace('snyk-', '')
                self.scan_results['snyk'][image_name] = self._parse_sarif(data)
        
        # Parse OPA results
        for opa_file in self.artifacts_dir.glob('**/*-policy-result.json'):
            with open(opa_file) as f:
                data = json.load(f)
                image_name = opa_file.stem.replace('-policy-result', '')
                self.scan_results['opa'][image_name] = data
        
        # Parse SBOMs
        for sbom_file in self.artifacts_dir.glob('**/*-sbom.cyclonedx.json'):
            with open(sbom_file) as f:
                data = json.load(f)
                image_name = sbom_file.stem.replace('-sbom.cyclonedx', '')
                self.scan_results['sbom'][image_name] = self._parse_sbom(data)
    
    def _parse_sarif(self, sarif_data):
        """Parse SARIF format security results"""
        vulnerabilities = {
            'CRITICAL': [],
            'HIGH': [],
            'MEDIUM': [],
            'LOW': []
        }
        
        for run in sarif_data.get('runs', []):
            for result in run.get('results', []):
                severity = result.get('level', 'warning').upper()
                if severity == 'ERROR':
                    severity = 'CRITICAL'
                elif severity == 'WARNING':
                    severity = 'HIGH'
                
                vuln = {
                    'id': result.get('ruleId'),
                    'message': result.get('message', {}).get('text', ''),
                    'locations': []
                }
                
                for location in result.get('locations', []):
                    physical = location.get('physicalLocation', {})
                    vuln['locations'].append({
                        'file': physical.get('artifactLocation', {}).get('uri', ''),
                        'line': physical.get('region', {}).get('startLine', 0)
                    })
                
                if severity in vulnerabilities:
                    vulnerabilities[severity].append(vuln)
        
        return vulnerabilities
    
    def _parse_sbom(self, sbom_data):
        """Parse SBOM for component information"""
        components = []
        
        for component in sbom_data.get('components', []):
            comp_info = {
                'name': component.get('name'),
                'version': component.get('version'),
                'type': component.get('type'),
                'licenses': [lic.get('license', {}).get('id', 'Unknown') 
                            for lic in component.get('licenses', [])]
            }
            components.append(comp_info)
        
        return {
            'total_components': len(components),
            'components': components,
            'metadata': sbom_data.get('metadata', {})
        }
    
    def generate_charts(self):
        """Generate security visualization charts"""
        charts = {}
        
        # Vulnerability severity distribution
        severity_data = []
        for scanner in ['trivy', 'snyk']:
            for image, vulns in self.scan_results[scanner].items():
                for severity, vuln_list in vulns.items():
                    severity_data.append({
                        'Scanner': scanner.title(),
                        'Image': image,
                        'Severity': severity,
                        'Count': len(vuln_list)
                    })
        
        if severity_data:
            df = pd.DataFrame(severity_data)
            
            # Stacked bar chart
            fig1 = px.bar(df, x='Image', y='Count', color='Severity',
                         facet_col='Scanner', title='Vulnerability Distribution by Scanner',
                         color_discrete_map={
                             'CRITICAL': '#d32f2f',
                             'HIGH': '#f57c00',
                             'MEDIUM': '#fbc02d',
                             'LOW': '#388e3c'
                         })
            charts['vuln_distribution'] = fig1.to_html(include_plotlyjs='cdn')
            
            # Pie chart of total vulnerabilities
            total_by_severity = df.groupby('Severity')['Count'].sum().reset_index()
            fig2 = px.pie(total_by_severity, values='Count', names='Severity',
                         title='Total Vulnerabilities by Severity',
                         color_discrete_map={
                             'CRITICAL': '#d32f2f',
                             'HIGH': '#f57c00',
                             'MEDIUM': '#fbc02d',
                             'LOW': '#388e3c'
                         })
            charts['vuln_pie'] = fig2.to_html(include_plotlyjs='cdn')
        
        # Component count from SBOM
        component_data = []
        for image, sbom in self.scan_results['sbom'].items():
            component_data.append({
                'Image': image,
                'Components': sbom.get('total_components', 0)
            })
        
        if component_data:
            df_comp = pd.DataFrame(component_data)
            fig3 = px.bar(df_comp, x='Image', y='Components',
                         title='Number of Components per Image')
            charts['component_count'] = fig3.to_html(include_plotlyjs='cdn')
        
        return charts
    
    def generate_summary(self):
        """Generate markdown summary for PR comments"""
        summary_lines = [
            "## 🔒 Security Scan Summary\n",
            f"**Scan Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}\n",
            "### Vulnerability Summary\n",
            "| Image | Scanner | Critical | High | Medium | Low | Total |",
            "|-------|---------|----------|------|--------|-----|-------|"
        ]
        
        total_critical = 0
        total_high = 0
        
        for scanner in ['trivy', 'snyk']:
            for image, vulns in self.scan_results[scanner].items():
                critical = len(vulns.get('CRITICAL', []))
                high = len(vulns.get('HIGH', []))
                medium = len(vulns.get('MEDIUM', []))
                low = len(vulns.get('LOW', []))
                total = critical + high + medium + low
                
                total_critical += critical
                total_high += high
                
                status = "🔴" if critical > 0 else "🟡" if high > 0 else "🟢"
                summary_lines.append(
                    f"| {image} | {scanner.title()} | {critical} | {high} | "
                    f"{medium} | {low} | {total} {status} |"
                )
        
        summary_lines.extend([
            "\n### Policy Compliance\n",
            "| Image | OPA Policy | Status |",
            "|-------|------------|--------|"
        ])
        
        for image, result in self.scan_results['opa'].items():
            passed = result.get('result', [{}])[0].get('expressions', [{}])[0].get('value', False)
            status = "✅ Passed" if passed else "❌ Failed"
            summary_lines.append(f"| {image} | Security Policy | {status} |")
        
        summary_lines.extend([
            "\n### Software Bill of Materials (SBOM)\n",
            "| Image | Total Components | Generated |",
            "|-------|------------------|-----------|"
        ])
        
        for image, sbom in self.scan_results['sbom'].items():
            count = sbom.get('total_components', 0)
            summary_lines.append(f"| {image} | {count} | ✅ |")
        
        # Add action items if vulnerabilities found
        if total_critical > 0 or total_high > 0:
            summary_lines.extend([
                "\n### ⚠️ Action Required\n",
                f"- **{total_critical} CRITICAL** vulnerabilities require immediate attention",
                f"- **{total_high} HIGH** vulnerabilities should be addressed",
                "\nPlease review the detailed security report and update dependencies."
            ])
        else:
            summary_lines.extend([
                "\n### ✅ Security Status\n",
                "No critical or high vulnerabilities detected. Good job! 🎉"
            ])
        
        summary_lines.append(
            f"\n[View Full Security Report](${{{{ github.server_url }}}}/"
            f"${{{{ github.repository }}}}/actions/runs/${{{{ github.run_id }}}})"
        )
        
        return '\n'.join(summary_lines)
    
    def generate_html_dashboard(self, charts):
        """Generate HTML dashboard"""
        template = Template('''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rover Mission Control - Security Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #1976d2;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .card {
            background-color: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric {
            display: inline-block;
            margin: 10px 20px;
            text-align: center;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        .critical { color: #d32f2f; }
        .high { color: #f57c00; }
        .medium { color: #fbc02d; }
        .low { color: #388e3c; }
        .passed { color: #4caf50; }
        .failed { color: #f44336; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f5f5f5;
            font-weight: 600;
        }
        .chart-container {
            margin: 20px 0;
        }
        .timestamp {
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Security Scan Dashboard</h1>
            <p class="timestamp">Generated: {{ timestamp }}</p>
        </div>
        
        <div class="card">
            <h2>Summary Metrics</h2>
            <div class="metrics">
                <div class="metric">
                    <div class="metric-value critical">{{ total_critical }}</div>
                    <div class="metric-label">Critical</div>
                </div>
                <div class="metric">
                    <div class="metric-value high">{{ total_high }}</div>
                    <div class="metric-label">High</div>
                </div>
                <div class="metric">
                    <div class="metric-value medium">{{ total_medium }}</div>
                    <div class="metric-label">Medium</div>
                </div>
                <div class="metric">
                    <div class="metric-value low">{{ total_low }}</div>
                    <div class="metric-label">Low</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>Vulnerability Distribution</h2>
            <div class="chart-container">
                {{ vuln_distribution_chart | safe }}
            </div>
        </div>
        
        <div class="card">
            <h2>Severity Breakdown</h2>
            <div class="chart-container">
                {{ vuln_pie_chart | safe }}
            </div>
        </div>
        
        <div class="card">
            <h2>Component Analysis</h2>
            <div class="chart-container">
                {{ component_chart | safe }}
            </div>
        </div>
        
        <div class="card">
            <h2>Detailed Results</h2>
            {{ detailed_table | safe }}
        </div>
        
        <div class="card">
            <h2>Policy Compliance</h2>
            {{ policy_table | safe }}
        </div>
        
        <div class="card">
            <h2>Recommendations</h2>
            <ul>
                {{ recommendations | safe }}
            </ul>
        </div>
    </div>
</body>
</html>
        ''')
        
        # Calculate totals
        totals = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
        for scanner in ['trivy', 'snyk']:
            for image, vulns in self.scan_results[scanner].items():
                for severity, vuln_list in vulns.items():
                    totals[severity] += len(vuln_list)
        
        # Generate detailed table
        detailed_rows = []
        for scanner in ['trivy', 'snyk']:
            for image, vulns in self.scan_results[scanner].items():
                row = f"<tr><td>{image}</td><td>{scanner.title()}</td>"
                for sev in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
                    count = len(vulns.get(sev, []))
                    css_class = sev.lower()
                    row += f'<td class="{css_class}">{count}</td>'
                row += "</tr>"
                detailed_rows.append(row)
        
        detailed_table = f"""
        <table>
            <thead>
                <tr>
                    <th>Image</th>
                    <th>Scanner</th>
                    <th>Critical</th>
                    <th>High</th>
                    <th>Medium</th>
                    <th>Low</th>
                </tr>
            </thead>
            <tbody>
                {''.join(detailed_rows)}
            </tbody>
        </table>
        """
        
        # Generate policy table
        policy_rows = []
        for image, result in self.scan_results['opa'].items():
            passed = result.get('result', [{}])[0].get('expressions', [{}])[0].get('value', False)
            status_class = 'passed' if passed else 'failed'
            status_text = 'Passed ✅' if passed else 'Failed ❌'
            policy_rows.append(
                f'<tr><td>{image}</td><td>Security Policy</td>'
                f'<td class="{status_class}">{status_text}</td></tr>'
            )
        
        policy_table = f"""
        <table>
            <thead>
                <tr>
                    <th>Image</th>
                    <th>Policy</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {''.join(policy_rows)}
            </tbody>
        </table>
        """
        
        # Generate recommendations
        recommendations = []
        if totals['CRITICAL'] > 0:
            recommendations.append(
                '<li class="critical"><strong>CRITICAL:</strong> '
                'Address critical vulnerabilities immediately before deployment</li>'
            )
        if totals['HIGH'] > 0:
            recommendations.append(
                '<li class="high"><strong>HIGH:</strong> '
                'Update dependencies with high vulnerabilities within 7 days</li>'
            )
        recommendations.extend([
            '<li>Enable automated dependency updates with Dependabot</li>',
            '<li>Implement regular security scanning in CI/CD pipeline</li>',
            '<li>Review and update base images to latest secure versions</li>',
            '<li>Consider using distroless or minimal base images</li>'
        ])
        
        # Render template
        html = template.render(
            timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC'),
            total_critical=totals['CRITICAL'],
            total_high=totals['HIGH'],
            total_medium=totals['MEDIUM'],
            total_low=totals['LOW'],
            vuln_distribution_chart=charts.get('vuln_distribution', ''),
            vuln_pie_chart=charts.get('vuln_pie', ''),
            component_chart=charts.get('component_count', ''),
            detailed_table=detailed_table,
            policy_table=policy_table,
            recommendations=''.join(recommendations)
        )
        
        return html
    
    def generate(self):
        """Main generation method"""
        print("Parsing scan results...")
        self.parse_scan_results()
        
        print("Generating charts...")
        charts = self.generate_charts()
        
        print("Generating summary...")
        summary = self.generate_summary()
        summary_path = self.output_dir / 'summary.md'
        summary_path.write_text(summary)
        
        print("Generating HTML dashboard...")
        html = self.generate_html_dashboard(charts)
        dashboard_path = self.output_dir / 'index.html'
        dashboard_path.write_text(html)
        
        # Generate JSON report for API consumption
        json_report = {
            'timestamp': datetime.now().isoformat(),
            'scan_results': self.scan_results,
            'summary': {
                'total_vulnerabilities': sum(
                    len(vulns.get(sev, []))
                    for scanner in ['trivy', 'snyk']
                    for image, vulns in self.scan_results[scanner].items()
                    for sev in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
                ),
                'images_scanned': len(set(
                    image 
                    for scanner in ['trivy', 'snyk']
                    for image in self.scan_results[scanner].keys()
                ))
            }
        }
        
        json_path = self.output_dir / 'security-report.json'
        json_path.write_text(json.dumps(json_report, indent=2))
        
        print(f"Dashboard generated at: {self.output_dir}")
        return summary


def main():
    parser = argparse.ArgumentParser(description='Generate security dashboard')
    parser.add_argument('--artifacts-dir', required=True, help='Directory with scan artifacts')
    parser.add_argument('--output-dir', required=True, help='Output directory for dashboard')
    
    args = parser.parse_args()
    
    generator = SecurityDashboardGenerator(args.artifacts_dir, args.output_dir)
    generator.generate()


if __name__ == '__main__':
    main()
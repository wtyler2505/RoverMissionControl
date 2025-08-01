"""
Compliance reporting for ISO 27001, SOC 2, and other standards
"""
import os
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, asdict
import sqlite3
from jinja2 import Template
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import base64


@dataclass
class ComplianceFramework:
    """Compliance framework definition"""
    id: str
    name: str
    version: str
    controls: List[Dict[str, Any]]
    reporting_requirements: Dict[str, Any]


@dataclass
class ComplianceControl:
    """Individual compliance control"""
    id: str
    framework_id: str
    control_number: str
    title: str
    description: str
    category: str
    implementation_status: str  # 'implemented', 'partial', 'not_implemented', 'not_applicable'
    evidence_types: List[str]
    test_procedures: List[str]
    responsible_party: Optional[str] = None
    last_tested: Optional[str] = None
    next_test_due: Optional[str] = None
    findings: List[Dict[str, Any]] = None


@dataclass
class ComplianceEvidence:
    """Evidence for compliance control"""
    id: str
    control_id: str
    evidence_type: str
    description: str
    collected_at: str
    collector: str
    file_paths: List[str]
    metadata: Dict[str, Any]
    expiry_date: Optional[str] = None


class ComplianceReporter:
    """
    Generates compliance reports for various frameworks:
    - ISO 27001 (Information Security Management)
    - SOC 2 (Service Organization Control)
    - GDPR (General Data Protection Regulation)
    - HIPAA (Health Insurance Portability and Accountability)
    - PCI DSS (Payment Card Industry Data Security Standard)
    """
    
    def __init__(self,
                 db_path: str = "/var/log/rover/compliance.db",
                 evidence_path: str = "/var/log/rover/compliance/evidence"):
        """
        Initialize compliance reporter
        
        Args:
            db_path: Path to compliance database
            evidence_path: Path to evidence storage
        """
        self.db_path = db_path
        self.evidence_path = evidence_path
        
        # Create directories
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        os.makedirs(evidence_path, exist_ok=True)
        
        # Initialize database
        self._init_database()
        
        # Load frameworks
        self.frameworks = {}
        self._load_frameworks()
        
    def _init_database(self):
        """Initialize compliance database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Frameworks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS compliance_frameworks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                config TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        # Controls table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS compliance_controls (
                id TEXT PRIMARY KEY,
                framework_id TEXT NOT NULL,
                control_number TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT,
                implementation_status TEXT,
                responsible_party TEXT,
                last_tested TEXT,
                next_test_due TEXT,
                config TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (framework_id) REFERENCES compliance_frameworks(id)
            )
        """)
        
        # Evidence table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS compliance_evidence (
                id TEXT PRIMARY KEY,
                control_id TEXT NOT NULL,
                evidence_type TEXT NOT NULL,
                description TEXT,
                collected_at TEXT NOT NULL,
                collector TEXT NOT NULL,
                file_paths TEXT,
                metadata TEXT,
                expiry_date TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (control_id) REFERENCES compliance_controls(id)
            )
        """)
        
        # Audit findings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_findings (
                id TEXT PRIMARY KEY,
                control_id TEXT NOT NULL,
                finding_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                description TEXT NOT NULL,
                remediation_plan TEXT,
                due_date TEXT,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (control_id) REFERENCES compliance_controls(id)
            )
        """)
        
        # Indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_controls_framework 
            ON compliance_controls(framework_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_evidence_control 
            ON compliance_evidence(control_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_findings_control 
            ON audit_findings(control_id)
        """)
        
        conn.commit()
        conn.close()
        
    def _load_frameworks(self):
        """Load compliance frameworks"""
        # ISO 27001:2022
        self.frameworks['ISO27001'] = ComplianceFramework(
            id='ISO27001',
            name='ISO/IEC 27001:2022',
            version='2022',
            controls=self._get_iso27001_controls(),
            reporting_requirements={
                'audit_frequency': 'annual',
                'review_frequency': 'quarterly',
                'evidence_retention': '3 years',
                'report_sections': [
                    'Executive Summary',
                    'Scope and Methodology',
                    'Control Assessment',
                    'Risk Assessment',
                    'Findings and Recommendations',
                    'Evidence Summary'
                ]
            }
        )
        
        # SOC 2 Type II
        self.frameworks['SOC2'] = ComplianceFramework(
            id='SOC2',
            name='SOC 2 Type II',
            version='2017',
            controls=self._get_soc2_controls(),
            reporting_requirements={
                'audit_frequency': 'annual',
                'testing_period': '6-12 months',
                'evidence_retention': '7 years',
                'trust_service_criteria': [
                    'Security',
                    'Availability',
                    'Processing Integrity',
                    'Confidentiality',
                    'Privacy'
                ]
            }
        )
        
    def _get_iso27001_controls(self) -> List[Dict[str, Any]]:
        """Get ISO 27001 control list"""
        # Simplified subset of ISO 27001 controls
        return [
            {
                'control_number': 'A.5.1',
                'title': 'Information security policies',
                'category': 'Organizational controls',
                'evidence_types': ['policy_documents', 'approval_records']
            },
            {
                'control_number': 'A.6.2',
                'title': 'Mobile devices and teleworking',
                'category': 'Organizational controls',
                'evidence_types': ['mobile_device_policy', 'vpn_logs']
            },
            {
                'control_number': 'A.8.1',
                'title': 'User access management',
                'category': 'People controls',
                'evidence_types': ['access_reviews', 'provisioning_logs']
            },
            {
                'control_number': 'A.12.3',
                'title': 'Information backup',
                'category': 'Technological controls',
                'evidence_types': ['backup_logs', 'restoration_tests']
            },
            {
                'control_number': 'A.12.4',
                'title': 'Logging and monitoring',
                'category': 'Technological controls',
                'evidence_types': ['audit_logs', 'monitoring_reports']
            },
            {
                'control_number': 'A.16.1',
                'title': 'Management of information security incidents',
                'category': 'Technological controls',
                'evidence_types': ['incident_reports', 'response_procedures']
            }
        ]
        
    def _get_soc2_controls(self) -> List[Dict[str, Any]]:
        """Get SOC 2 control list"""
        # Simplified subset of SOC 2 controls
        return [
            {
                'control_number': 'CC1.1',
                'title': 'Control Environment',
                'category': 'Common Criteria',
                'evidence_types': ['org_chart', 'code_of_conduct']
            },
            {
                'control_number': 'CC2.1',
                'title': 'Information and Communication',
                'category': 'Common Criteria',
                'evidence_types': ['communication_policies', 'training_records']
            },
            {
                'control_number': 'CC6.1',
                'title': 'Logical and Physical Access Controls',
                'category': 'Common Criteria',
                'evidence_types': ['access_logs', 'badge_records']
            },
            {
                'control_number': 'CC7.1',
                'title': 'System Operations',
                'category': 'Common Criteria',
                'evidence_types': ['change_logs', 'monitoring_alerts']
            },
            {
                'control_number': 'CC8.1',
                'title': 'Change Management',
                'category': 'Common Criteria',
                'evidence_types': ['change_requests', 'approval_records']
            }
        ]
        
    def add_control_evidence(self,
                           control_id: str,
                           evidence_type: str,
                           description: str,
                           collector: str,
                           file_data: Optional[bytes] = None,
                           metadata: Optional[Dict[str, Any]] = None,
                           expiry_days: Optional[int] = None) -> str:
        """
        Add evidence for a control
        
        Args:
            control_id: Control ID
            evidence_type: Type of evidence
            description: Evidence description
            collector: Person collecting evidence
            file_data: Optional file data
            metadata: Additional metadata
            expiry_days: Days until evidence expires
            
        Returns:
            Evidence ID
        """
        evidence_id = f"EVD-{datetime.now().timestamp()}"
        collected_at = datetime.now(timezone.utc).isoformat()
        
        # Save file if provided
        file_paths = []
        if file_data:
            file_name = f"{evidence_id}_{evidence_type}.dat"
            file_path = os.path.join(self.evidence_path, file_name)
            with open(file_path, 'wb') as f:
                f.write(file_data)
            file_paths.append(file_path)
            
        # Calculate expiry
        expiry_date = None
        if expiry_days:
            expiry_date = (datetime.now(timezone.utc) + 
                          timedelta(days=expiry_days)).isoformat()
            
        # Save to database
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO compliance_evidence
            (id, control_id, evidence_type, description, collected_at,
             collector, file_paths, metadata, expiry_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            evidence_id,
            control_id,
            evidence_type,
            description,
            collected_at,
            collector,
            json.dumps(file_paths),
            json.dumps(metadata or {}),
            expiry_date,
            datetime.now(timezone.utc).isoformat()
        ))
        
        conn.commit()
        conn.close()
        
        return evidence_id
        
    def generate_compliance_report(self,
                                 framework_id: str,
                                 start_date: datetime,
                                 end_date: datetime,
                                 output_format: str = 'pdf') -> bytes:
        """
        Generate compliance report
        
        Args:
            framework_id: Framework to report on
            start_date: Report start date
            end_date: Report end date
            output_format: Output format ('pdf', 'html', 'json')
            
        Returns:
            Report data
        """
        framework = self.frameworks.get(framework_id)
        if not framework:
            raise ValueError(f"Framework {framework_id} not found")
            
        # Gather report data
        report_data = {
            'framework': framework,
            'period': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            },
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'controls': self._get_control_status(framework_id, start_date, end_date),
            'findings': self._get_findings(framework_id, start_date, end_date),
            'evidence_summary': self._get_evidence_summary(framework_id, start_date, end_date),
            'metrics': self._calculate_compliance_metrics(framework_id)
        }
        
        if output_format == 'json':
            return json.dumps(report_data, indent=2).encode()
        elif output_format == 'html':
            return self._generate_html_report(report_data)
        else:  # pdf
            return self._generate_pdf_report(report_data)
            
    def _get_control_status(self, framework_id: str, 
                          start_date: datetime, 
                          end_date: datetime) -> List[Dict[str, Any]]:
        """Get control status for period"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT c.*, 
                   COUNT(DISTINCT e.id) as evidence_count,
                   COUNT(DISTINCT f.id) as finding_count
            FROM compliance_controls c
            LEFT JOIN compliance_evidence e ON c.id = e.control_id
                AND e.collected_at >= ? AND e.collected_at <= ?
            LEFT JOIN audit_findings f ON c.id = f.control_id
                AND f.created_at >= ? AND f.created_at <= ?
            WHERE c.framework_id = ?
            GROUP BY c.id
        """, (
            start_date.isoformat(),
            end_date.isoformat(),
            start_date.isoformat(),
            end_date.isoformat(),
            framework_id
        ))
        
        controls = []
        for row in cursor.fetchall():
            controls.append({
                'id': row[0],
                'control_number': row[2],
                'title': row[3],
                'description': row[4],
                'category': row[5],
                'implementation_status': row[6],
                'responsible_party': row[7],
                'last_tested': row[8],
                'evidence_count': row[-2],
                'finding_count': row[-1]
            })
            
        conn.close()
        return controls
        
    def _get_findings(self, framework_id: str,
                     start_date: datetime,
                     end_date: datetime) -> List[Dict[str, Any]]:
        """Get findings for period"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT f.*, c.control_number, c.title
            FROM audit_findings f
            JOIN compliance_controls c ON f.control_id = c.id
            WHERE c.framework_id = ?
                AND f.created_at >= ? AND f.created_at <= ?
            ORDER BY f.severity DESC, f.created_at DESC
        """, (framework_id, start_date.isoformat(), end_date.isoformat()))
        
        findings = []
        for row in cursor.fetchall():
            findings.append({
                'id': row[0],
                'control_id': row[1],
                'control_number': row[-2],
                'control_title': row[-1],
                'finding_type': row[2],
                'severity': row[3],
                'description': row[4],
                'remediation_plan': row[5],
                'due_date': row[6],
                'status': row[7]
            })
            
        conn.close()
        return findings
        
    def _get_evidence_summary(self, framework_id: str,
                            start_date: datetime,
                            end_date: datetime) -> Dict[str, Any]:
        """Get evidence summary"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Total evidence collected
        cursor.execute("""
            SELECT COUNT(DISTINCT e.id), COUNT(DISTINCT e.control_id)
            FROM compliance_evidence e
            JOIN compliance_controls c ON e.control_id = c.id
            WHERE c.framework_id = ?
                AND e.collected_at >= ? AND e.collected_at <= ?
        """, (framework_id, start_date.isoformat(), end_date.isoformat()))
        
        total_evidence, controls_with_evidence = cursor.fetchone()
        
        # Evidence by type
        cursor.execute("""
            SELECT e.evidence_type, COUNT(*)
            FROM compliance_evidence e
            JOIN compliance_controls c ON e.control_id = c.id
            WHERE c.framework_id = ?
                AND e.collected_at >= ? AND e.collected_at <= ?
            GROUP BY e.evidence_type
        """, (framework_id, start_date.isoformat(), end_date.isoformat()))
        
        evidence_by_type = dict(cursor.fetchall())
        
        conn.close()
        
        return {
            'total_evidence': total_evidence,
            'controls_with_evidence': controls_with_evidence,
            'evidence_by_type': evidence_by_type
        }
        
    def _calculate_compliance_metrics(self, framework_id: str) -> Dict[str, Any]:
        """Calculate compliance metrics"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Implementation status
        cursor.execute("""
            SELECT implementation_status, COUNT(*)
            FROM compliance_controls
            WHERE framework_id = ?
            GROUP BY implementation_status
        """, (framework_id,))
        
        status_counts = dict(cursor.fetchall())
        
        # Calculate percentage
        total_controls = sum(status_counts.values())
        implemented = status_counts.get('implemented', 0)
        partial = status_counts.get('partial', 0)
        
        compliance_score = 0
        if total_controls > 0:
            compliance_score = ((implemented + (partial * 0.5)) / total_controls) * 100
            
        conn.close()
        
        return {
            'total_controls': total_controls,
            'status_breakdown': status_counts,
            'compliance_score': round(compliance_score, 1)
        }
        
    def _generate_pdf_report(self, report_data: Dict[str, Any]) -> bytes:
        """Generate PDF compliance report"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Title'],
            fontSize=24,
            textColor=colors.HexColor('#1f4788')
        )
        
        story.append(Paragraph(
            f"{report_data['framework'].name} Compliance Report",
            title_style
        ))
        story.append(Spacer(1, 0.2*inch))
        
        # Report period
        story.append(Paragraph(
            f"Period: {report_data['period']['start']} to {report_data['period']['end']}",
            styles['Normal']
        ))
        story.append(Spacer(1, 0.3*inch))
        
        # Executive Summary
        story.append(Paragraph("Executive Summary", styles['Heading1']))
        
        metrics = report_data['metrics']
        summary_data = [
            ['Metric', 'Value'],
            ['Total Controls', str(metrics['total_controls'])],
            ['Compliance Score', f"{metrics['compliance_score']}%"],
            ['Controls Tested', str(report_data['evidence_summary']['controls_with_evidence'])],
            ['Total Evidence Collected', str(report_data['evidence_summary']['total_evidence'])],
            ['Open Findings', str(len([f for f in report_data['findings'] if f['status'] != 'closed']))]
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(summary_table)
        story.append(PageBreak())
        
        # Control Assessment
        story.append(Paragraph("Control Assessment", styles['Heading1']))
        
        control_data = [['Control', 'Title', 'Status', 'Evidence', 'Findings']]
        for control in report_data['controls']:
            control_data.append([
                control['control_number'],
                control['title'][:40] + '...' if len(control['title']) > 40 else control['title'],
                control['implementation_status'],
                str(control['evidence_count']),
                str(control['finding_count'])
            ])
            
        control_table = Table(control_data, colWidths=[1*inch, 2.5*inch, 1.2*inch, 0.8*inch, 0.8*inch])
        control_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(control_table)
        story.append(PageBreak())
        
        # Findings
        if report_data['findings']:
            story.append(Paragraph("Audit Findings", styles['Heading1']))
            
            for finding in report_data['findings'][:10]:  # Limit to 10 findings
                story.append(Paragraph(
                    f"<b>{finding['control_number']} - {finding['severity'].upper()}</b>",
                    styles['Normal']
                ))
                story.append(Paragraph(finding['description'], styles['Normal']))
                if finding['remediation_plan']:
                    story.append(Paragraph(
                        f"<i>Remediation: {finding['remediation_plan']}</i>",
                        styles['Normal']
                    ))
                story.append(Spacer(1, 0.2*inch))
                
        # Build PDF
        doc.build(story)
        
        buffer.seek(0)
        return buffer.read()
        
    def _generate_html_report(self, report_data: Dict[str, Any]) -> bytes:
        """Generate HTML compliance report"""
        template = Template("""
        <!DOCTYPE html>
        <html>
        <head>
            <title>{{ framework.name }} Compliance Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #1f4788; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #4CAF50; color: white; }
                .metric { background-color: #f0f0f0; padding: 10px; margin: 10px 0; }
                .finding { border-left: 4px solid #ff5252; padding-left: 10px; margin: 10px 0; }
                .severity-critical { color: #d32f2f; }
                .severity-high { color: #f57c00; }
                .severity-medium { color: #fbc02d; }
                .severity-low { color: #388e3c; }
            </style>
        </head>
        <body>
            <h1>{{ framework.name }} Compliance Report</h1>
            <p>Period: {{ period.start }} to {{ period.end }}</p>
            
            <h2>Executive Summary</h2>
            <div class="metric">
                <h3>Compliance Score: {{ metrics.compliance_score }}%</h3>
                <p>Total Controls: {{ metrics.total_controls }}</p>
                <p>Controls with Evidence: {{ evidence_summary.controls_with_evidence }}</p>
                <p>Total Evidence Collected: {{ evidence_summary.total_evidence }}</p>
            </div>
            
            <h2>Control Assessment</h2>
            <table>
                <thead>
                    <tr>
                        <th>Control</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Evidence</th>
                        <th>Findings</th>
                    </tr>
                </thead>
                <tbody>
                    {% for control in controls %}
                    <tr>
                        <td>{{ control.control_number }}</td>
                        <td>{{ control.title }}</td>
                        <td>{{ control.implementation_status }}</td>
                        <td>{{ control.evidence_count }}</td>
                        <td>{{ control.finding_count }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
            
            {% if findings %}
            <h2>Audit Findings</h2>
            {% for finding in findings %}
            <div class="finding">
                <h3 class="severity-{{ finding.severity }}">
                    {{ finding.control_number }} - {{ finding.severity|upper }}
                </h3>
                <p>{{ finding.description }}</p>
                {% if finding.remediation_plan %}
                <p><i>Remediation: {{ finding.remediation_plan }}</i></p>
                {% endif %}
            </div>
            {% endfor %}
            {% endif %}
            
            <p><small>Generated at: {{ generated_at }}</small></p>
        </body>
        </html>
        """)
        
        html = template.render(**report_data)
        return html.encode()
        
    def schedule_compliance_check(self, framework_id: str, check_type: str = 'monthly'):
        """Schedule automated compliance checks"""
        # This would integrate with a task scheduler
        # Implementation depends on deployment environment
        pass
        
    def export_evidence(self, framework_id: str, output_path: str):
        """Export all evidence for a framework"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT e.*
            FROM compliance_evidence e
            JOIN compliance_controls c ON e.control_id = c.id
            WHERE c.framework_id = ?
        """, (framework_id,))
        
        evidence_list = []
        for row in cursor.fetchall():
            evidence_list.append({
                'id': row[0],
                'control_id': row[1],
                'evidence_type': row[2],
                'description': row[3],
                'collected_at': row[4],
                'collector': row[5],
                'file_paths': json.loads(row[6]),
                'metadata': json.loads(row[7]),
                'expiry_date': row[8]
            })
            
        conn.close()
        
        # Export to JSON
        with open(output_path, 'w') as f:
            json.dump({
                'framework_id': framework_id,
                'export_date': datetime.now(timezone.utc).isoformat(),
                'evidence_count': len(evidence_list),
                'evidence': evidence_list
            }, f, indent=2)
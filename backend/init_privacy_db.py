#!/usr/bin/env python3
"""
Privacy Policy Database Initialization Script
Creates and initializes database tables for privacy policy management
"""

import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.privacy_policy import (
    Base,
    PrivacyPolicy,
    PolicySection,
    PolicyChange,
    PolicyAcknowledgment,
    ComplianceMetric,
    ContextualHelp,
    DPIATemplate,
    PolicyLanguage,
    ChangeType,
    ComplianceStatus
)


def get_database_url():
    """Get database URL from environment or use default SQLite"""
    db_url = os.getenv('DATABASE_URL')
    if db_url:
        return db_url
    
    # Default to SQLite in shared data directory
    db_path = backend_dir.parent / 'shared' / 'data' / 'rover_platform.db'
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return f'sqlite:///{db_path}'


def create_tables(engine):
    """Create all privacy policy tables"""
    print("Creating privacy policy tables...")
    Base.metadata.create_all(engine)
    print("Tables created successfully.")


def create_default_policy(session):
    """Create a default privacy policy"""
    print("Creating default privacy policy...")
    
    policy_id = str(uuid.uuid4())
    effective_date = datetime.now(timezone.utc)
    
    # Main policy
    policy = PrivacyPolicy(
        id=policy_id,
        version="1.0.0",
        language=PolicyLanguage.ENGLISH.value,
        title="Rover Mission Control Privacy Policy",
        content="""# Rover Mission Control Privacy Policy

## 1. Information We Collect

We collect information you provide directly to us when you:
- Create an account and use our rover mission control system
- Configure rover operations and telemetry settings
- Contact us for support or feedback
- Participate in surveys or research

### Types of Information
- **Account Information**: Username, email address, profile settings
- **Operational Data**: Rover commands, telemetry data, mission logs
- **Usage Information**: How you interact with our system, feature usage
- **Technical Data**: IP address, browser type, device information

## 2. How We Use Your Information

We use your information to:
- **Provide Services**: Enable rover control and monitoring functionality
- **Improve Performance**: Analyze system usage to enhance features
- **Ensure Security**: Monitor for unauthorized access and protect data
- **Communication**: Send important updates and support responses
- **Compliance**: Meet legal and regulatory requirements

## 3. Information Sharing and Disclosure

We do not sell your personal information. We may share information in these situations:
- **With Your Consent**: When you explicitly authorize sharing
- **Service Providers**: Third parties who help us operate our services
- **Legal Requirements**: When required by law or to protect rights
- **Business Transfers**: In connection with mergers or acquisitions
- **Safety**: To protect the safety of users or the public

## 4. Data Security

We implement comprehensive security measures:
- **Encryption**: Data encrypted in transit and at rest
- **Access Controls**: Role-based access with authentication
- **Monitoring**: Continuous security monitoring and logging
- **Updates**: Regular security patches and assessments
- **Incident Response**: Procedures for handling security events

## 5. Your Privacy Rights

You have the right to:
- **Access**: Request a copy of your personal information
- **Correction**: Update inaccurate or incomplete information
- **Deletion**: Request deletion of your personal information
- **Portability**: Receive your data in a machine-readable format
- **Restrict Processing**: Limit how we use your information
- **Object**: Opt out of certain types of processing
- **Withdraw Consent**: Revoke consent for data processing

To exercise these rights, contact us at privacy@rovermissioncontrol.com.

## 6. Data Retention

We retain your information for as long as necessary to:
- Provide our services and support your account
- Comply with legal obligations and resolve disputes
- Meet operational and business requirements

**Specific Retention Periods:**
- Account data: Retained while account is active, deleted 30 days after account closure
- Operational logs: Retained for 90 days for troubleshooting and analysis
- Security logs: Retained for 1 year for security monitoring
- Communication records: Retained for 3 years for support purposes

## 7. International Data Transfers

If you are located outside the country where our servers are located, your information may be transferred across international borders. We ensure appropriate safeguards are in place.

## 8. Children's Privacy

Our services are not intended for individuals under 16 years of age. We do not knowingly collect personal information from children under 16.

## 9. Changes to This Policy

We may update this privacy policy periodically. We will notify you of material changes through:
- Email notifications to registered users
- Prominent notices in our application
- Updates to this page with revision date

## 10. Contact Information

For privacy-related questions or concerns:
- **Email**: privacy@rovermissioncontrol.com
- **Mail**: Rover Mission Control Privacy Team, [Address]
- **Data Protection Officer**: dpo@rovermissioncontrol.com

## 11. Effective Date and Version

- **Effective Date**: {effective_date}
- **Version**: 1.0.0
- **Last Updated**: {last_updated}

This policy is governed by applicable data protection laws including GDPR and CCPA.
""".format(
            effective_date=effective_date.strftime("%B %d, %Y"),
            last_updated=effective_date.strftime("%B %d, %Y")
        ),
        plain_language_summary="This privacy policy explains how Rover Mission Control collects, uses, and protects your personal information when you use our rover control system. We only collect necessary information, keep it secure, and give you control over your data.",
        effective_date=effective_date,
        created_by="system_init",
        is_active=True,
        requires_acknowledgment=True,
        change_type=ChangeType.MAJOR.value
    )
    
    session.add(policy)
    
    # Policy sections
    sections = [
        {
            "section_key": "data_collection",
            "title": "Information We Collect",
            "content": "Account information, operational data, usage information, and technical data necessary for system functionality.",
            "plain_language_summary": "We collect information you give us and information about how you use our rover control system.",
            "gdpr_article": "Article 13",
            "legal_basis": "legitimate_interest",
            "order_index": 1
        },
        {
            "section_key": "data_usage",
            "title": "How We Use Your Information",
            "content": "We use information to provide services, improve performance, ensure security, communicate with users, and meet compliance requirements.",
            "plain_language_summary": "We use your information to make our rover control system work for you and keep it secure.",
            "gdpr_article": "Article 6",
            "legal_basis": "legitimate_interest",
            "order_index": 2
        },
        {
            "section_key": "data_sharing",
            "title": "Information Sharing",
            "content": "We don't sell your information. We only share it with your consent, with service providers, for legal requirements, or for safety reasons.",
            "plain_language_summary": "We don't sell your information and only share it when necessary or with your permission.",
            "gdpr_article": "Article 14",
            "legal_basis": "legitimate_interest",
            "order_index": 3
        },
        {
            "section_key": "data_security",
            "title": "Data Security",
            "content": "Comprehensive security measures including encryption, access controls, monitoring, and incident response procedures.",
            "plain_language_summary": "We protect your information with strong security measures.",
            "gdpr_article": "Article 32",
            "legal_basis": "legal_obligation",
            "order_index": 4
        },
        {
            "section_key": "user_rights",
            "title": "Your Privacy Rights",
            "content": "Rights to access, correct, delete, port, restrict, object, and withdraw consent for your personal information.",
            "plain_language_summary": "You have control over your personal information and can ask us to access, change, or delete it.",
            "gdpr_article": "Articles 15-22",
            "legal_basis": "user_rights",
            "order_index": 5
        },
        {
            "section_key": "data_retention",
            "title": "Data Retention",
            "content": "We keep information only as long as necessary, with specific retention periods for different types of data.",
            "plain_language_summary": "We only keep your information as long as we need it, then we delete it.",
            "gdpr_article": "Article 5",
            "legal_basis": "legitimate_interest",
            "order_index": 6
        }
    ]
    
    for section_data in sections:
        section = PolicySection(
            id=str(uuid.uuid4()),
            policy_id=policy_id,
            **section_data
        )
        session.add(section)
    
    print(f"Created default policy version {policy.version}")
    return policy_id


def create_contextual_help(session):
    """Create default contextual help content"""
    print("Creating contextual help content...")
    
    help_items = [
        {
            "context_key": "data_collection_banner",
            "title": "Why do we collect this data?",
            "content": "We collect this information to provide you with rover control functionality, ensure system security, and improve our services. All data collection follows privacy-by-design principles.",
            "plain_language_content": "We need this information to make the rover system work properly and keep it secure for everyone.",
            "related_policy_sections": ["data_collection", "data_usage"]
        },
        {
            "context_key": "consent_modal",
            "title": "Understanding Your Consent",
            "content": "Your consent allows us to process your personal data for specific purposes outlined in our privacy policy. You can withdraw consent at any time without affecting the lawfulness of processing based on consent before its withdrawal.",
            "plain_language_content": "By agreeing, you let us use your information as described. You can change your mind later and it won't affect anything we did before you changed your mind."
        },
        {
            "context_key": "privacy_settings",
            "title": "Managing Your Privacy",
            "content": "Use these settings to control how your personal data is collected and used. Required permissions ensure basic system functionality, while optional permissions enhance your experience.",
            "plain_language_content": "These controls let you decide what information we collect. Some are required for the system to work, others are optional but make the experience better."
        },
        {
            "context_key": "telemetry_data",
            "title": "Telemetry Data Collection",
            "content": "Telemetry data includes rover sensor readings, operational status, and performance metrics. This data is essential for safe rover operation and mission success.",
            "plain_language_content": "We collect data from the rover's sensors to make sure it's working safely and completing missions successfully."
        },
        {
            "context_key": "user_commands",
            "title": "Command Logging",
            "content": "User commands are logged for audit purposes, troubleshooting, and security monitoring. Logs are retained according to our data retention policy.",
            "plain_language_content": "We keep track of the commands you send to help fix problems and keep the system secure."
        }
    ]
    
    for help_data in help_items:
        help_item = ContextualHelp(
            id=str(uuid.uuid4()),
            **help_data
        )
        session.add(help_item)
    
    print(f"Created {len(help_items)} contextual help items")


def create_compliance_metrics(session):
    """Create default compliance metrics"""
    print("Creating compliance metrics...")
    
    metrics = [
        {
            "metric_name": "Data Retention Compliance",
            "metric_category": "gdpr",
            "current_value": "30 days",
            "target_value": "30 days",
            "status": ComplianceStatus.COMPLIANT.value,
            "metadata": {
                "description": "User data retained for maximum 30 days after account deletion",
                "policy_reference": "data_retention",
                "measurement_method": "automated_cleanup_job"
            }
        },
        {
            "metric_name": "Consent Acknowledgment Rate",
            "metric_category": "gdpr",
            "current_value": "100%",
            "target_value": "95%",
            "status": ComplianceStatus.COMPLIANT.value,
            "metadata": {
                "description": "Percentage of active users who have acknowledged current privacy policy",
                "measurement_frequency": "daily",
                "alert_threshold": "90%"
            }
        },
        {
            "metric_name": "Data Export Response Time",
            "metric_category": "gdpr",
            "current_value": "24 hours",
            "target_value": "72 hours",
            "status": ComplianceStatus.COMPLIANT.value,
            "metadata": {
                "description": "Average time to fulfill user data export requests",
                "sla_requirement": "30 days maximum",
                "automation_level": "fully_automated"
            }
        },
        {
            "metric_name": "Security Incident Response",
            "metric_category": "security",
            "current_value": "2 hours",
            "target_value": "4 hours",
            "status": ComplianceStatus.COMPLIANT.value,
            "metadata": {
                "description": "Average time to initial response for security incidents",
                "escalation_threshold": "1 hour",
                "notification_requirements": "72 hours for data breaches"
            }
        },
        {
            "metric_name": "Data Minimization Score",
            "metric_category": "privacy",
            "current_value": "85%",
            "target_value": "80%",
            "status": ComplianceStatus.COMPLIANT.value,
            "metadata": {
                "description": "Percentage of collected data that is necessary for stated purposes",
                "review_frequency": "quarterly",
                "improvement_target": "90%"
            }
        },
        {
            "metric_name": "Encryption Coverage",
            "metric_category": "security",
            "current_value": "100%",
            "target_value": "100%",
            "status": ComplianceStatus.COMPLIANT.value,
            "metadata": {
                "description": "Percentage of personal data encrypted at rest and in transit",
                "encryption_standards": ["AES-256", "TLS 1.3"],
                "monitoring": "continuous"
            }
        }
    ]
    
    for metric_data in metrics:
        metric = ComplianceMetric(
            id=str(uuid.uuid4()),
            **metric_data
        )
        session.add(metric)
    
    print(f"Created {len(metrics)} compliance metrics")


def create_dpia_template(session):
    """Create default DPIA template"""
    print("Creating DPIA template...")
    
    template_content = {
        "metadata": {
            "template_version": "1.0.0",
            "created_date": datetime.now(timezone.utc).isoformat(),
            "compliance_frameworks": ["GDPR", "ISO 27001", "NIST Privacy Framework"]
        },
        "sections": [
            {
                "id": "system_overview",
                "title": "System Overview and Context",
                "description": "Describe the data processing system and its business context",
                "questions": [
                    {
                        "id": "purpose",
                        "question": "What is the primary purpose of this data processing activity?",
                        "guidance": "Describe the business objective, legal requirement, or service provision goal",
                        "required": True,
                        "type": "long_text"
                    },
                    {
                        "id": "data_types",
                        "question": "What types of personal data will be processed?",
                        "guidance": "List all categories of personal data, including special categories if applicable",
                        "required": True,
                        "type": "checklist",
                        "options": [
                            "Basic identity information (name, ID numbers)",
                            "Contact information (email, phone, address)",
                            "Technical data (IP addresses, device IDs)",
                            "Usage data (logs, analytics, preferences)",
                            "Location data",
                            "Biometric data",
                            "Health data",
                            "Financial data",
                            "Criminal records",
                            "Other sensitive data"
                        ]
                    },
                    {
                        "id": "data_subjects",
                        "question": "Who are the data subjects?",
                        "guidance": "Identify the categories of individuals whose data will be processed",
                        "required": True,
                        "type": "checklist",
                        "options": [
                            "Customers/Users",
                            "Employees",
                            "Contractors",
                            "Website visitors",
                            "Children (under 16)",
                            "Vulnerable individuals",
                            "Third parties"
                        ]
                    },
                    {
                        "id": "legal_basis",
                        "question": "What is the legal basis for processing?",
                        "guidance": "Identify the lawful basis under Article 6 GDPR and Article 9 if applicable",
                        "required": True,
                        "type": "multiple_choice",
                        "options": [
                            "Consent (Article 6(1)(a))",
                            "Contract (Article 6(1)(b))",
                            "Legal obligation (Article 6(1)(c))",
                            "Vital interests (Article 6(1)(d))",
                            "Public task (Article 6(1)(e))",
                            "Legitimate interests (Article 6(1)(f))"
                        ]
                    },
                    {
                        "id": "data_volume",
                        "question": "What is the expected volume of data and number of data subjects?",
                        "guidance": "Provide estimates to assess the scale of processing",
                        "required": True,
                        "type": "short_text"
                    }
                ]
            },
            {
                "id": "risk_assessment",
                "title": "Privacy Risk Assessment",
                "description": "Identify and evaluate potential privacy risks to individuals",
                "questions": [
                    {
                        "id": "risk_identification",
                        "question": "What are the potential privacy risks to individuals?",
                        "guidance": "Consider risks like unauthorized access, data breach, profiling, discrimination, etc.",
                        "required": True,
                        "type": "long_text"
                    },
                    {
                        "id": "likelihood",
                        "question": "How likely are these risks to occur?",
                        "guidance": "Assess probability considering current safeguards and threat landscape",
                        "required": True,
                        "type": "multiple_choice",
                        "options": [
                            "Very Low (1-5%)",
                            "Low (6-25%)",
                            "Medium (26-50%)",
                            "High (51-75%)",
                            "Very High (76-100%)"
                        ]
                    },
                    {
                        "id": "impact_severity",
                        "question": "What would be the severity of impact on individuals?",
                        "guidance": "Consider physical, material, or non-material damage to data subjects",
                        "required": True,
                        "type": "multiple_choice",
                        "options": [
                            "Minimal - No significant impact",
                            "Low - Minor inconvenience or distress",
                            "Medium - Moderate financial loss or reputational damage",
                            "High - Significant harm or discrimination",
                            "Very High - Severe harm, danger, or irreversible damage"
                        ]
                    },
                    {
                        "id": "special_categories",
                        "question": "Are special categories of personal data involved?",
                        "guidance": "Article 9 GDPR special categories require additional consideration",
                        "required": True,
                        "type": "yes_no"
                    },
                    {
                        "id": "automated_decisions",
                        "question": "Does the processing involve automated decision-making or profiling?",
                        "guidance": "Consider algorithmic decisions that affect individuals",
                        "required": True,
                        "type": "yes_no"
                    },
                    {
                        "id": "vulnerable_groups",
                        "question": "Does the processing involve vulnerable data subjects?",
                        "guidance": "Children, elderly, mentally incapacitated, or other vulnerable groups",
                        "required": True,
                        "type": "yes_no"
                    }
                ]
            },
            {
                "id": "mitigation_measures",
                "title": "Risk Mitigation and Safeguards",
                "description": "Document measures to reduce identified risks",
                "questions": [
                    {
                        "id": "technical_safeguards",
                        "question": "What technical safeguards are implemented?",
                        "guidance": "Encryption, access controls, anonymization, etc.",
                        "required": True,
                        "type": "checklist",
                        "options": [
                            "Encryption at rest",
                            "Encryption in transit",
                            "Access controls and authentication",
                            "Regular security updates",
                            "Data anonymization/pseudonymization",
                            "Secure data deletion",
                            "Network security measures",
                            "Regular security testing"
                        ]
                    },
                    {
                        "id": "organizational_measures",
                        "question": "What organizational measures are in place?",
                        "guidance": "Policies, training, governance, etc.",
                        "required": True,
                        "type": "checklist",
                        "options": [
                            "Privacy policy and procedures",
                            "Staff training and awareness",
                            "Data protection governance",
                            "Privacy by design processes",
                            "Incident response procedures",
                            "Regular compliance audits",
                            "Third-party contracts and agreements",
                            "Data retention and deletion policies"
                        ]
                    },
                    {
                        "id": "data_minimization",
                        "question": "How is data minimization ensured?",
                        "guidance": "Measures to collect and process only necessary data",
                        "required": True,
                        "type": "long_text"
                    },
                    {
                        "id": "consent_management",
                        "question": "If consent is the legal basis, how is it managed?",
                        "guidance": "Consent collection, recording, and withdrawal mechanisms",
                        "required": False,
                        "type": "long_text"
                    },
                    {
                        "id": "data_subject_rights",
                        "question": "How are data subject rights facilitated?",
                        "guidance": "Procedures for access, rectification, erasure, portability, etc.",
                        "required": True,
                        "type": "long_text"
                    }
                ]
            },
            {
                "id": "monitoring_review",
                "title": "Monitoring and Review",
                "description": "Ongoing monitoring and review procedures",
                "questions": [
                    {
                        "id": "effectiveness_monitoring",
                        "question": "How will the effectiveness of safeguards be monitored?",
                        "guidance": "KPIs, audits, reviews, and monitoring procedures",
                        "required": True,
                        "type": "long_text"
                    },
                    {
                        "id": "review_schedule",
                        "question": "What is the schedule for regular review of this DPIA?",
                        "guidance": "Frequency and triggers for DPIA updates",
                        "required": True,
                        "type": "multiple_choice",
                        "options": [
                            "Quarterly",
                            "Annually",
                            "When processing changes significantly",
                            "When new risks are identified",
                            "When safeguards prove ineffective"
                        ]
                    },
                    {
                        "id": "incident_procedures",
                        "question": "What procedures are in place for incident detection and response?",
                        "guidance": "How privacy incidents will be identified and handled",
                        "required": True,
                        "type": "long_text"
                    },
                    {
                        "id": "compliance_metrics",
                        "question": "What metrics will be used to measure ongoing compliance?",
                        "guidance": "Specific KPIs and measurement methods",
                        "required": True,
                        "type": "long_text"
                    }
                ]
            }
        ]
    }
    
    template = DPIATemplate(
        id=str(uuid.uuid4()),
        name="Rover Mission Control DPIA Template",
        description="Comprehensive Data Protection Impact Assessment template for rover mission control systems and related data processing activities",
        template_content=template_content,
        applicable_regulations=["GDPR", "CCPA", "ISO 27001", "NIST Privacy Framework"],
        language=PolicyLanguage.ENGLISH.value,
        version="1.0.0"
    )
    
    session.add(template)
    print("Created DPIA template")


def main():
    """Main initialization function"""
    print("Initializing Privacy Policy Database...")
    print("=" * 50)
    
    # Create database connection
    database_url = get_database_url()
    print(f"Database URL: {database_url}")
    
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    try:
        # Create tables
        create_tables(engine)
        
        # Create session and populate with default data
        session = SessionLocal()
        
        try:
            # Create default content
            policy_id = create_default_policy(session)
            create_contextual_help(session)
            create_compliance_metrics(session)
            create_dpia_template(session)
            
            # Commit all changes
            session.commit()
            
            print("=" * 50)
            print("Privacy Policy Database Initialization Complete!")
            print(f"Created default policy ID: {policy_id}")
            print()
            print("Next steps:")
            print("1. Start the backend server: python server.py")
            print("2. Access privacy endpoints at: http://localhost:8000/api/privacy/")
            print("3. Initialize default content: POST /api/privacy/admin/initialize-default-content")
            print("4. View compliance dashboard: GET /api/privacy/compliance/dashboard")
            
        except Exception as e:
            session.rollback()
            print(f"Error during data creation: {e}")
            raise
        finally:
            session.close()
            
    except Exception as e:
        print(f"Error during database initialization: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
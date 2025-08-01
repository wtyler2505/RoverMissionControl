# Secure Logging System

Enterprise-grade secure logging infrastructure for the Rover Mission Control system, providing tamper-proof audit trails, real-time notifications, and comprehensive compliance support.

## Features

### Core Security
- 🔐 **Tamper-Proof Logging**: Blockchain-style hash chains with proof-of-work
- 🔒 **AES-256 Encryption**: Military-grade encryption with key rotation
- 📝 **Digital Signatures**: RSA-2048 signing for authenticity
- 🔄 **Redundant Storage**: Multi-location storage with automatic failover

### Compliance & Audit
- 📊 **Compliance Reporting**: ISO 27001, SOC 2, GDPR, HIPAA, PCI DSS
- 🔍 **Forensic Analysis**: ML-based anomaly detection and timeline reconstruction
- 📈 **Audit Trails**: Immutable, searchable, exportable audit logs
- ⚖️ **Evidence Collection**: Automated compliance evidence gathering

### Operations
- 🚨 **Real-Time Notifications**: Multi-channel alerts (Email, SMS, Slack, Webhook)
- 🔗 **SIEM Integration**: Splunk, Elasticsearch, Syslog, ArcSight
- 🛡️ **Emergency Response**: Integrated with emergency stop system
- 📱 **Web Interface**: React components for log viewing and configuration

## Quick Start

### Installation

```bash
# Install Python dependencies
pip install -r requirements.txt

# Create required directories
sudo mkdir -p /var/log/rover/{hashchain,encrypted,keys,redundant,compliance,forensics}
sudo chown -R $USER:$USER /var/log/rover

# Generate encryption keys
python scripts/generate_keys.py

# Initialize databases
python scripts/init_databases.py
```

### Basic Usage

```python
from secure_logging.secure_logging_service import SecureLoggingService, EXAMPLE_CONFIG

# Initialize service
service = SecureLoggingService(EXAMPLE_CONFIG)
await service.start()

# Log an event
event_id = await service.log_event(
    event_type="user_login",
    severity="info",
    data={
        "user": "john.doe",
        "ip": "192.168.1.100",
        "success": True
    },
    actor="john.doe",
    notify=True
)

# Verify integrity
integrity = service.verify_integrity()
print(f"Hash chain valid: {integrity['hash_chain'][0]}")
```

### API Usage

```bash
# Log a security event
curl -X POST http://localhost:8000/api/v1/secure-logging/log-event \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "emergency_stop",
    "severity": "critical",
    "data": {"reason": "Manual activation"},
    "notify": true,
    "compliance_evidence": true
  }'

# Verify system integrity
curl http://localhost:8000/api/v1/secure-logging/verify-integrity \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Applications                      │
├─────────────────────────────────────────────────────────────┤
│                    FastAPI REST Interface                     │
├─────────────────────────────────────────────────────────────┤
│                  Secure Logging Service                       │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Hash Chain  │  Encryption  │ Notification │   Compliance   │
│   Logger     │    Store     │   Manager    │   Reporter     │
├──────────────┼──────────────┼──────────────┼────────────────┤
│  Redundant   │   Forensic   │     SIEM     │   Database     │
│   Storage    │   Analyzer   │ Integration  │    Layer       │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

## Components

### Backend Modules
- `hash_chain.py` - Blockchain-style tamper-proof logging
- `encryption.py` - AES-256-GCM encryption with key management
- `redundant_storage.py` - Multi-location redundant storage
- `notification_manager.py` - Multi-channel alert system
- `compliance_reporter.py` - Automated compliance reporting
- `forensic_analyzer.py` - Security incident analysis
- `siem_integration.py` - Enterprise SIEM connectors
- `secure_logging_service.py` - Main service orchestrator
- `secure_logging_routes.py` - FastAPI endpoints

### Frontend Components
- `SecureLogViewer.tsx` - Log viewing and analysis interface
- `NotificationConfiguration.tsx` - Alert configuration UI

## Configuration

Create a configuration file with your settings:

```json
{
  "hash_chain": {
    "chain_id": "rover_security",
    "difficulty": 4
  },
  "encryption": {
    "rotation_interval_days": 30
  },
  "notifications": {
    "channels": {
      "email": {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587
      },
      "slack": {
        "webhook_url": "https://hooks.slack.com/..."
      }
    }
  }
}
```

## Security Considerations

1. **Key Management**
   - Store encryption keys securely
   - Rotate keys regularly (automated)
   - Use hardware security modules (HSM) in production

2. **Access Control**
   - Implement strict RBAC policies
   - Audit all access attempts
   - Use principle of least privilege

3. **Network Security**
   - Use TLS for all communications
   - Implement API rate limiting
   - Deploy behind a firewall

## Compliance

The system supports multiple compliance frameworks:
- **ISO 27001:2022** - Information security management
- **SOC 2 Type II** - Trust service criteria
- **GDPR** - Data protection and privacy
- **HIPAA** - Healthcare information security
- **PCI DSS v4.0** - Payment card data security
- **CCPA** - California privacy requirements

## Testing

```bash
# Run unit tests
pytest tests/test_secure_logging/

# Run integration tests
pytest tests/integration/test_secure_logging_integration.py

# Test emergency stop integration
python tests/test_emergency_logging.py

# Performance testing
python tests/performance/test_logging_throughput.py
```

## Monitoring

### Health Checks
- System status: `/api/v1/secure-logging/status`
- Integrity verification: Run hourly
- Storage monitoring: Check capacity daily
- Notification testing: Weekly test alerts

### Metrics
- Events logged per second
- Hash chain verification time
- Storage redundancy status
- Notification delivery rate
- SIEM forwarding latency

## Documentation

- [Technical Documentation](./SECURE_LOGGING_DOCUMENTATION.md) - Detailed technical guide
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Production deployment instructions
- [Compliance Mapping](./COMPLIANCE_MAPPING.md) - Regulatory compliance details
- [API Reference](./docs/api_reference.md) - Complete API documentation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure compliance checks pass
5. Submit a pull request

## License

This secure logging system is part of the Rover Mission Control project.
See the main project LICENSE file for details.

## Support

- Documentation: See `/docs` directory
- Issues: GitHub issue tracker
- Security: security@rovermissioncontrol.com
- Compliance: compliance@rovermissioncontrol.com

---

Version: 1.0.0  
Last Updated: 2025-07-29
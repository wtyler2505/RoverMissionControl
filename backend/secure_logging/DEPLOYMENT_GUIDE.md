# Secure Logging System Deployment Guide

## Prerequisites

### System Requirements
- Python 3.8+
- PostgreSQL 12+ or SQLite 3.35+
- Redis 6.0+ (for caching and queues)
- 10GB+ available storage for logs
- Network access for SIEM integration

### Required Python Packages
```bash
pip install cryptography>=41.0.0
pip install aiofiles>=23.0.0
pip install httpx>=0.24.0
pip install scikit-learn>=1.3.0
pip install reportlab>=4.0.0
pip install twilio>=8.0.0
pip install boto3>=1.28.0
pip install azure-storage-blob>=12.19.0
pip install paramiko>=3.3.0
pip install asyncpg>=0.28.0
```

## Installation Steps

### 1. Directory Structure Setup

Create the required directories:

```bash
# Create base directories
sudo mkdir -p /var/log/rover/{hashchain,encrypted,keys,redundant/{primary,secondary},compliance/evidence,forensics/artifacts,notifications,reports,exports}

# Set appropriate permissions
sudo chown -R rover:rover /var/log/rover
sudo chmod -R 750 /var/log/rover
sudo chmod 700 /var/log/rover/keys
```

### 2. Generate Encryption Keys

```python
# generate_keys.py
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
import os

# Generate RSA key pair for digital signatures
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend()
)

# Save private key
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

with open('/var/log/rover/keys/signing_key.pem', 'wb') as f:
    f.write(private_pem)

# Save public key
public_key = private_key.public_key()
public_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

with open('/var/log/rover/keys/signing_key.pub', 'wb') as f:
    f.write(public_pem)

# Generate master encryption key
master_key = os.urandom(32)  # 256-bit key
with open('/var/log/rover/keys/master.key', 'wb') as f:
    f.write(master_key)

print("Keys generated successfully!")
```

### 3. Database Setup

#### PostgreSQL Setup
```sql
-- Create database and user
CREATE DATABASE rover_logging;
CREATE USER rover_logger WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE rover_logging TO rover_logger;

-- Connect to rover_logging database
\c rover_logging

-- Create schema
CREATE SCHEMA secure_logging AUTHORIZATION rover_logger;

-- Grant permissions
GRANT ALL ON SCHEMA secure_logging TO rover_logger;
```

#### SQLite Setup (Alternative)
```bash
# Create SQLite databases
sqlite3 /var/log/rover/compliance.db < compliance_schema.sql
sqlite3 /var/log/rover/forensics.db < forensics_schema.sql
sqlite3 /var/log/rover/notifications.db < notifications_schema.sql

# Set permissions
chmod 640 /var/log/rover/*.db
```

### 4. Environment Configuration

Create `.env` file:
```bash
# Security
SECURE_LOGGING_MASTER_KEY_PATH=/var/log/rover/keys/master.key
SECURE_LOGGING_SIGNING_KEY_PATH=/var/log/rover/keys/signing_key.pem

# Database
SECURE_LOGGING_DB_TYPE=postgresql
SECURE_LOGGING_DB_HOST=localhost
SECURE_LOGGING_DB_PORT=5432
SECURE_LOGGING_DB_NAME=rover_logging
SECURE_LOGGING_DB_USER=rover_logger
SECURE_LOGGING_DB_PASSWORD=secure_password

# Storage
SECURE_LOGGING_LOCAL_PATH=/var/log/rover
SECURE_LOGGING_S3_BUCKET=rover-logs-backup
SECURE_LOGGING_S3_REGION=us-east-1
SECURE_LOGGING_AZURE_CONTAINER=rover-logs
SECURE_LOGGING_SFTP_HOST=backup.rover.com

# Notifications
SECURE_LOGGING_SMTP_HOST=smtp.gmail.com
SECURE_LOGGING_SMTP_PORT=587
SECURE_LOGGING_SMTP_USER=alerts@rover.com
SECURE_LOGGING_SMTP_PASSWORD=app_specific_password
SECURE_LOGGING_TWILIO_ACCOUNT_SID=your_account_sid
SECURE_LOGGING_TWILIO_AUTH_TOKEN=your_auth_token
SECURE_LOGGING_TWILIO_FROM_NUMBER=+1234567890
SECURE_LOGGING_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# SIEM
SECURE_LOGGING_SYSLOG_HOST=siem.rover.com
SECURE_LOGGING_SYSLOG_PORT=514
SECURE_LOGGING_SPLUNK_HEC_URL=https://splunk.rover.com:8088/services/collector
SECURE_LOGGING_SPLUNK_HEC_TOKEN=your-hec-token
SECURE_LOGGING_ELASTIC_HOST=elastic.rover.com
SECURE_LOGGING_ELASTIC_PORT=9200
```

### 5. Service Configuration

Create the configuration file `/etc/rover/secure_logging_config.json`:

```json
{
  "hash_chain": {
    "chain_id": "rover_production",
    "storage_path": "/var/log/rover/hashchain",
    "private_key_path": "/var/log/rover/keys/signing_key.pem",
    "difficulty": 4
  },
  "encryption": {
    "store_id": "rover_encrypted_prod",
    "storage_path": "/var/log/rover/encrypted",
    "key_store_path": "/var/log/rover/keys/master.key",
    "rotation_interval_days": 30
  },
  "redundant_storage": {
    "locations": [
      {
        "id": "local_primary",
        "type": "local",
        "config": {
          "path": "/var/log/rover/redundant/primary"
        },
        "priority": 1
      },
      {
        "id": "local_secondary",
        "type": "local",
        "config": {
          "path": "/mnt/backup/rover/redundant/secondary"
        },
        "priority": 2
      },
      {
        "id": "s3_backup",
        "type": "s3",
        "config": {
          "bucket": "rover-logs-backup",
          "prefix": "secure-logs/prod",
          "region": "us-east-1"
        },
        "priority": 3
      }
    ],
    "replication_factor": 3,
    "consistency_check_interval": 3600
  },
  "notifications": {
    "db_path": "/var/log/rover/notifications.db",
    "max_workers": 10,
    "channels": {
      "email": {
        "smtp_host": "${SECURE_LOGGING_SMTP_HOST}",
        "smtp_port": "${SECURE_LOGGING_SMTP_PORT}",
        "smtp_user": "${SECURE_LOGGING_SMTP_USER}",
        "smtp_password": "${SECURE_LOGGING_SMTP_PASSWORD}",
        "from_address": "alerts@rover.com",
        "use_tls": true
      },
      "sms": {
        "account_sid": "${SECURE_LOGGING_TWILIO_ACCOUNT_SID}",
        "auth_token": "${SECURE_LOGGING_TWILIO_AUTH_TOKEN}",
        "from_number": "${SECURE_LOGGING_TWILIO_FROM_NUMBER}"
      },
      "slack": {
        "webhook_url": "${SECURE_LOGGING_SLACK_WEBHOOK_URL}"
      }
    },
    "rules": [
      {
        "id": "critical_production",
        "name": "Critical Production Events",
        "event_types": ["emergency_stop", "system_breach", "auth_failure"],
        "severity_levels": ["critical"],
        "channels": ["email", "sms", "slack"],
        "recipients": {
          "email": ["security@rover.com", "oncall@rover.com"],
          "sms": ["+1234567890", "+0987654321"],
          "slack": ["#security-critical", "@oncall-engineer"]
        },
        "template_id": "critical_alert",
        "cooldown_minutes": 0,
        "max_notifications_per_hour": 100,
        "escalation_delay_minutes": 5,
        "escalation_channels": ["sms"]
      },
      {
        "id": "high_severity",
        "name": "High Severity Events",
        "event_types": ["permission_change", "data_export", "config_change"],
        "severity_levels": ["high"],
        "channels": ["email", "slack"],
        "recipients": {
          "email": ["security@rover.com"],
          "slack": ["#security-alerts"]
        },
        "template_id": "high_alert",
        "cooldown_minutes": 5,
        "max_notifications_per_hour": 20
      }
    ]
  },
  "compliance": {
    "db_path": "/var/log/rover/compliance.db",
    "evidence_path": "/var/log/rover/compliance/evidence",
    "retention_days": 2555
  },
  "forensics": {
    "db_path": "/var/log/rover/forensics.db",
    "artifacts_path": "/var/log/rover/forensics/artifacts",
    "ml_model_path": "/var/log/rover/forensics/models"
  },
  "siem": {
    "connectors": {
      "syslog": {
        "host": "${SECURE_LOGGING_SYSLOG_HOST}",
        "port": "${SECURE_LOGGING_SYSLOG_PORT}",
        "transport": "tcp",
        "use_tls": true,
        "facility": 16,
        "app_name": "rover_security"
      },
      "splunk": {
        "hec_url": "${SECURE_LOGGING_SPLUNK_HEC_URL}",
        "hec_token": "${SECURE_LOGGING_SPLUNK_HEC_TOKEN}",
        "index": "rover_security",
        "source": "rover_secure_logging",
        "sourcetype": "rover:security:json"
      }
    }
  },
  "num_workers": 5,
  "debug": false,
  "log_level": "INFO"
}
```

### 6. Service Integration

#### Update FastAPI Application

In `backend/main.py`, add:

```python
from secure_logging.secure_logging_routes import router as secure_logging_router
from secure_logging.secure_logging_service import SecureLoggingService

# Load configuration
import json
import os

config_path = os.getenv('SECURE_LOGGING_CONFIG_PATH', '/etc/rover/secure_logging_config.json')
with open(config_path, 'r') as f:
    secure_logging_config = json.load(f)

# Initialize service
secure_logging_service = SecureLoggingService(secure_logging_config)

# Add to FastAPI app
app.include_router(secure_logging_router)

# Startup/shutdown events
@app.on_event("startup")
async def startup_secure_logging():
    await secure_logging_service.start()

@app.on_event("shutdown")
async def shutdown_secure_logging():
    await secure_logging_service.stop()
```

### 7. Systemd Service

Create `/etc/systemd/system/rover-secure-logging.service`:

```ini
[Unit]
Description=Rover Secure Logging Service
After=network.target postgresql.service redis.service

[Service]
Type=notify
User=rover
Group=rover
WorkingDirectory=/opt/rover
Environment="PATH=/opt/rover/venv/bin"
Environment="PYTHONPATH=/opt/rover"
EnvironmentFile=/opt/rover/.env
ExecStart=/opt/rover/venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/rover

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable rover-secure-logging
sudo systemctl start rover-secure-logging
```

### 8. Nginx Configuration

Add to `/etc/nginx/sites-available/rover`:

```nginx
location /api/v1/secure-logging {
    proxy_pass http://localhost:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    
    # Rate limiting for API endpoints
    limit_req zone=api_limit burst=20 nodelay;
}
```

### 9. Monitoring Setup

#### Prometheus Metrics

Add to your Prometheus configuration:

```yaml
scrape_configs:
  - job_name: 'rover_secure_logging'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/api/v1/secure-logging/metrics'
```

#### Grafana Dashboard

Import the dashboard from `monitoring/secure_logging_dashboard.json`.

### 10. Backup Configuration

Create `/etc/cron.d/rover-secure-logging-backup`:

```bash
# Backup hash chain daily
0 2 * * * rover /usr/bin/rsync -av /var/log/rover/hashchain/ /mnt/backup/rover/hashchain/

# Backup encrypted logs
0 3 * * * rover /usr/bin/rsync -av /var/log/rover/encrypted/ /mnt/backup/rover/encrypted/

# Verify integrity weekly
0 4 * * 0 rover /opt/rover/scripts/verify_integrity.sh

# Archive old logs monthly
0 5 1 * * rover /opt/rover/scripts/archive_logs.sh
```

## Post-Installation Verification

### 1. Test Logging

```python
# test_logging.py
import httpx
import asyncio

async def test_secure_logging():
    async with httpx.AsyncClient() as client:
        # Test event logging
        response = await client.post(
            "http://localhost:8000/api/v1/secure-logging/log-event",
            json={
                "event_type": "test_event",
                "severity": "info",
                "data": {"message": "Installation test"},
                "notify": False
            },
            headers={"Authorization": "Bearer YOUR_TOKEN"}
        )
        print(f"Log event response: {response.json()}")
        
        # Test integrity verification
        response = await client.get(
            "http://localhost:8000/api/v1/secure-logging/verify-integrity",
            headers={"Authorization": "Bearer YOUR_TOKEN"}
        )
        print(f"Integrity check: {response.json()}")

asyncio.run(test_secure_logging())
```

### 2. Verify Storage

```bash
# Check local storage
ls -la /var/log/rover/hashchain/
ls -la /var/log/rover/encrypted/

# Check S3 backup (if configured)
aws s3 ls s3://rover-logs-backup/secure-logs/prod/

# Check permissions
namei -l /var/log/rover/
```

### 3. Test Notifications

```bash
# Send test notification
curl -X POST http://localhost:8000/api/v1/secure-logging/log-event \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "test_notification",
    "severity": "critical",
    "data": {"message": "Test critical alert"},
    "notify": true
  }'
```

### 4. Verify SIEM Integration

Check your SIEM platform for incoming events:
- Splunk: Search `index=rover_security`
- Elasticsearch: Query `GET /rover-security-*/_search`
- Syslog: Check `/var/log/syslog` or remote syslog server

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   ```bash
   # Fix permissions
   sudo chown -R rover:rover /var/log/rover
   sudo chmod -R 750 /var/log/rover
   sudo chmod 700 /var/log/rover/keys
   ```

2. **Database Connection Errors**
   ```bash
   # Check PostgreSQL
   sudo -u postgres psql -c "SELECT 1;"
   
   # Check user permissions
   sudo -u postgres psql -d rover_logging -c "\dp"
   ```

3. **Key Loading Errors**
   ```bash
   # Verify key files exist
   ls -la /var/log/rover/keys/
   
   # Check key permissions
   stat /var/log/rover/keys/master.key
   ```

4. **Storage Write Failures**
   ```bash
   # Check disk space
   df -h /var/log/rover
   
   # Test write permissions
   sudo -u rover touch /var/log/rover/test.txt
   ```

### Debug Mode

Enable debug logging:
```bash
# Set in .env
SECURE_LOGGING_DEBUG=true
SECURE_LOGGING_LOG_LEVEL=DEBUG

# Restart service
sudo systemctl restart rover-secure-logging

# Check logs
journalctl -u rover-secure-logging -f
```

## Security Hardening

### 1. Firewall Rules

```bash
# Allow only necessary ports
sudo ufw allow from 10.0.0.0/8 to any port 8000 comment 'Rover API'
sudo ufw allow out 514/tcp comment 'Syslog'
sudo ufw allow out 8088/tcp comment 'Splunk HEC'
sudo ufw allow out 443/tcp comment 'HTTPS for webhooks'
```

### 2. SELinux/AppArmor

For SELinux:
```bash
# Create policy module
sudo semanage fcontext -a -t httpd_sys_rw_content_t '/var/log/rover(/.*)?'
sudo restorecon -Rv /var/log/rover
```

For AppArmor:
```bash
# Add to /etc/apparmor.d/local/usr.bin.python3
/var/log/rover/** rw,
/etc/rover/secure_logging_config.json r,
```

### 3. Key Rotation

Schedule automatic key rotation:
```bash
# Add to crontab
0 0 1 * * /opt/rover/scripts/rotate_keys.sh
```

## Performance Tuning

### 1. Database Optimization

PostgreSQL tuning:
```sql
-- Increase shared buffers
ALTER SYSTEM SET shared_buffers = '256MB';

-- Enable query parallelization
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;

-- Optimize for SSD
ALTER SYSTEM SET random_page_cost = 1.1;

-- Reload configuration
SELECT pg_reload_conf();
```

### 2. Event Processing

Adjust worker pool:
```json
{
  "num_workers": 10,  // Increase for high-volume environments
  "event_queue_size": 10000,  // Buffer size for event spikes
  "batch_size": 100  // SIEM batch size
}
```

### 3. Storage Optimization

Enable compression:
```json
{
  "encryption": {
    "compression": "zstd",
    "compression_level": 3
  }
}
```

## Maintenance Schedule

### Daily
- Verify hash chain integrity
- Check storage usage
- Review critical event logs

### Weekly
- Full integrity verification
- Notification test
- SIEM connectivity check

### Monthly
- Key rotation
- Archive old logs
- Performance analysis
- Security audit

### Quarterly
- Compliance report generation
- Disaster recovery test
- Capacity planning review

## Disaster Recovery

### Backup Procedures

1. **Hash Chain Backup**
   ```bash
   # Full backup
   tar -czf /backup/hashchain_$(date +%Y%m%d).tar.gz /var/log/rover/hashchain/
   
   # Incremental backup
   rsync -av --link-dest=/backup/hashchain_latest /var/log/rover/hashchain/ /backup/hashchain_$(date +%Y%m%d)/
   ```

2. **Key Backup**
   ```bash
   # Encrypt keys before backup
   tar -czf - /var/log/rover/keys/ | openssl enc -aes-256-cbc -salt -out /secure/keys_backup.tar.gz.enc
   ```

### Recovery Procedures

1. **Restore Hash Chain**
   ```bash
   # Stop service
   sudo systemctl stop rover-secure-logging
   
   # Restore files
   tar -xzf /backup/hashchain_YYYYMMDD.tar.gz -C /
   
   # Verify integrity
   /opt/rover/scripts/verify_integrity.sh
   
   # Start service
   sudo systemctl start rover-secure-logging
   ```

2. **Key Recovery**
   ```bash
   # Decrypt backup
   openssl enc -d -aes-256-cbc -in /secure/keys_backup.tar.gz.enc | tar -xzf - -C /
   
   # Verify permissions
   chmod 700 /var/log/rover/keys
   chmod 600 /var/log/rover/keys/*
   ```

## Support and Monitoring

### Health Checks

```bash
# Service status
systemctl status rover-secure-logging

# API health
curl http://localhost:8000/api/v1/secure-logging/status

# Storage health
/opt/rover/scripts/check_storage.sh

# Notification test
/opt/rover/scripts/test_notifications.sh
```

### Log Analysis

```bash
# Recent errors
journalctl -u rover-secure-logging -p err -since "1 hour ago"

# Performance metrics
grep "event_processed" /var/log/rover/metrics.log | tail -100

# Failed notifications
sqlite3 /var/log/rover/notifications.db "SELECT * FROM notification_history WHERE status='failed' ORDER BY timestamp DESC LIMIT 10;"
```

---

Last Updated: 2025-07-29
Version: 1.0.0
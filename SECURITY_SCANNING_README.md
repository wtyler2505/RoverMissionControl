# 🔒 Rover Mission Control - Security Scanning Pipeline

## Overview

This comprehensive security scanning pipeline provides defense-in-depth protection for the Rover Mission Control system through multiple layers of vulnerability detection, policy enforcement, and compliance monitoring.

## 🚀 Quick Start

### Local Development

```bash
# Start security scanning infrastructure
docker-compose -f docker-compose.security.yml up -d

# Run a manual security scan
docker-compose -f docker-compose.security.yml exec security-scanner python scanner.py

# View security dashboard
open http://localhost:3001  # Grafana (admin/admin)
open http://localhost:8082  # Dependency Track
```

### CI/CD Integration

The security pipeline automatically runs on:
- Every push to `main` or `develop`
- Every pull request
- Daily scheduled scans (2 AM UTC)
- Manual workflow dispatch

## 🛡️ Security Components

### 1. **Vulnerability Scanning**

#### Trivy
- Container vulnerability scanning
- OS package vulnerabilities
- Application dependencies
- Secrets detection
- License scanning

#### Snyk
- Deep dependency analysis
- Fix recommendations
- Developer-friendly reporting
- Integration with IDE plugins

### 2. **Software Bill of Materials (SBOM)**

- **Syft**: Generates comprehensive SBOMs
- **Formats**: SPDX, CycloneDX
- **Dependency Track**: SBOM management and monitoring

### 3. **Policy Enforcement (OPA)**

Enforces security policies including:
- No critical/high vulnerabilities
- Non-root user enforcement
- Approved base images only
- No embedded secrets
- Resource limits configured
- Image signing verification
- License compliance

### 4. **Container Security**

- **Hadolint**: Dockerfile best practices
- **Docker Bench**: Runtime security checks
- **Image signing**: Cosign integration

### 5. **Monitoring & Alerting**

- **Prometheus**: Metrics collection
- **Grafana**: Security dashboards
- **AlertManager**: Multi-channel alerting
- **Slack/Email/PagerDuty**: Notifications

## 📊 Security Metrics

### Key Performance Indicators (KPIs)

1. **Mean Time to Detect (MTTD)**: < 5 minutes
2. **Mean Time to Remediate (MTTR)**: < 24 hours
3. **Vulnerability Coverage**: 100% of containers
4. **Policy Compliance Rate**: > 95%
5. **False Positive Rate**: < 5%

### Dashboards

Access Grafana at http://localhost:3001

- **Security Overview**: Overall security posture
- **Vulnerability Trends**: Historical vulnerability data
- **Compliance Status**: Policy compliance metrics
- **Scan Performance**: Scanner health and performance

## 🚨 Alert Thresholds

### Critical (Immediate Action)
- Any CRITICAL vulnerability
- Unsigned images in production
- Security scanner failures
- Policy engine down

### High (Within 24 hours)
- HIGH vulnerabilities > 5
- License violations
- Outdated vulnerability database
- Failed security scans

### Medium (Within 7 days)
- MEDIUM vulnerabilities > 20
- Performance degradation
- Non-compliant Dockerfiles

## 🔧 Configuration

### Environment Variables

```bash
# Severity threshold for blocking deployments
SEVERITY_THRESHOLD=HIGH

# Slack webhook for alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Dependency Track API
DEPENDENCY_TRACK_URL=http://dependency-track:8080
DEPENDENCY_TRACK_API_KEY=your-api-key

# Snyk authentication
SNYK_TOKEN=your-snyk-token

# Grafana admin password
GRAFANA_ADMIN_PASSWORD=secure-password
```

### Policy Customization

Edit policies in `.github/security-policies/docker_security.rego`:

```rego
# Maximum allowed high vulnerabilities
max_high_vulns := 5

# Approved base images
approved_bases := {
    "python:3.11-slim",
    "node:18-alpine",
    "nginx:alpine"
}
```

## 📋 Pre-commit Hooks

Install pre-commit hooks for local scanning:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

## 🚀 Deployment Security

### Production Deployment Gates

1. **Build Stage**
   - Dockerfile linting must pass
   - No hardcoded secrets detected

2. **Scan Stage**
   - Zero CRITICAL vulnerabilities
   - HIGH vulnerabilities under threshold
   - All policies pass

3. **Deploy Stage**
   - Image signing verified
   - SBOM submitted to Dependency Track
   - Security scan results archived

### Emergency Response

For critical vulnerabilities in production:

1. **Immediate Actions**
   ```bash
   # Block deployment
   gh workflow run security-block.yml
   
   # Rollback to last known good
   kubectl rollout undo deployment/rover-backend
   ```

2. **Investigation**
   - Review security dashboard
   - Check Dependency Track for affected components
   - Analyze exploit potential

3. **Remediation**
   - Update affected dependencies
   - Rebuild and rescan images
   - Deploy patched version

## 📊 Compliance Reporting

### Monthly Security Report

Generated automatically on the 1st of each month:

```bash
# Generate compliance report
python .github/scripts/generate-compliance-report.py \
  --start-date 2024-01-01 \
  --end-date 2024-01-31 \
  --output compliance-report.pdf
```

### Audit Trail

All security events are logged with:
- Timestamp
- Scanner used
- Vulnerabilities found
- Actions taken
- User responsible

## 🔍 Troubleshooting

### Common Issues

1. **Scanner Timeout**
   ```bash
   # Increase scan timeout
   docker-compose -f docker-compose.security.yml \
     exec security-scanner \
     python scanner.py --timeout 600
   ```

2. **Database Connection Issues**
   ```bash
   # Reset Dependency Track database
   docker-compose -f docker-compose.security.yml \
     down dependency-track dependency-track-db
   docker volume rm rovermissioncontrol_dependency-track-db
   docker-compose -f docker-compose.security.yml up -d
   ```

3. **OPA Policy Failures**
   ```bash
   # Test policies locally
   opa test .github/security-policies/*.rego -v
   ```

## 🔐 Security Best Practices

### For Developers

1. **Use Approved Base Images**
   - Alpine Linux for minimal attack surface
   - Official images from Docker Hub
   - Specific version tags (no `latest`)

2. **Minimize Image Layers**
   ```dockerfile
   # Good - Single RUN command
   RUN apt-get update && \
       apt-get install -y package && \
       rm -rf /var/lib/apt/lists/*
   
   # Bad - Multiple RUN commands
   RUN apt-get update
   RUN apt-get install -y package
   ```

3. **Run as Non-Root**
   ```dockerfile
   RUN useradd -m -u 1000 appuser
   USER appuser
   ```

4. **No Secrets in Images**
   - Use Docker secrets
   - Environment variables at runtime
   - External secret management

### For DevOps

1. **Regular Updates**
   - Weekly vulnerability database updates
   - Monthly scanner version updates
   - Quarterly policy reviews

2. **Monitoring**
   - Watch scan duration trends
   - Track vulnerability counts over time
   - Monitor policy compliance rates

3. **Automation**
   - Automated remediation for known fixes
   - Auto-create tickets for vulnerabilities
   - Scheduled compliance reports

## 📞 Support

### Security Team Contacts

- **Security Lead**: security@example.com
- **On-Call**: +1-555-SECURITY
- **Slack**: #rover-security

### Escalation Path

1. Developer on-call
2. Security team lead
3. Platform engineering
4. CISO

## 🔄 Continuous Improvement

### Quarterly Reviews

- Vulnerability trends analysis
- Policy effectiveness assessment
- Tool performance evaluation
- Process improvement recommendations

### Metrics Collection

```sql
-- Vulnerability trends
SELECT 
  DATE_TRUNC('week', scan_date) as week,
  severity,
  COUNT(*) as vuln_count
FROM vulnerabilities
GROUP BY week, severity
ORDER BY week DESC;
```

## 📚 Additional Resources

- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [OWASP Container Security](https://owasp.org/www-project-container-security/)
- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/)

---

**Remember**: Security is everyone's responsibility. When in doubt, ask the security team!
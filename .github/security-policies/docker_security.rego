package docker.security

import future.keywords.contains
import future.keywords.if
import future.keywords.in

# Default deny
default allow := false

# Security policy rules for Docker images
allow if {
    # All critical checks must pass
    no_critical_vulnerabilities
    no_high_vulnerabilities
    approved_base_images
    no_root_user
    no_sudo_installed
    no_sensitive_data
    signed_images
    resource_limits_set
}

# Check for critical vulnerabilities
no_critical_vulnerabilities if {
    count(critical_vulns) == 0
}

critical_vulns[vuln] if {
    some component in input.components
    some vulnerability in component.vulnerabilities
    vulnerability.severity == "CRITICAL"
    vuln := vulnerability
}

# Check for high vulnerabilities (configurable threshold)
no_high_vulnerabilities if {
    count(high_vulns) <= max_high_vulns
}

high_vulns[vuln] if {
    some component in input.components
    some vulnerability in component.vulnerabilities
    vulnerability.severity == "HIGH"
    vuln := vulnerability
}

# Maximum allowed high vulnerabilities
max_high_vulns := 5

# Approved base images for safety
approved_base_images if {
    some component in input.components
    component.type == "container"
    component.name in approved_bases
}

approved_bases := {
    "python:3.11-slim",
    "node:18-alpine",
    "nginx:alpine",
    "alpine:3.18",
    "ubuntu:22.04",
    "debian:12-slim"
}

# Ensure no root user execution
no_root_user if {
    some component in input.components
    component.type == "container"
    component.properties.user != "root"
    component.properties.user != "0"
}

# Check that sudo is not installed
no_sudo_installed if {
    not package_installed("sudo")
}

# Check for sensitive data in image
no_sensitive_data if {
    no_private_keys
    no_aws_credentials
    no_api_tokens
}

no_private_keys if {
    not contains_pattern("-----BEGIN.*PRIVATE KEY-----")
}

no_aws_credentials if {
    not contains_pattern("AKIA[0-9A-Z]{16}")
}

no_api_tokens if {
    not contains_pattern("(api_key|apikey|api-key)\\s*=\\s*[\"'][0-9a-zA-Z]{32,}")
}

# Ensure images are signed
signed_images if {
    some component in input.components
    component.type == "container"
    component.properties.signed == true
}

# Resource limits must be set
resource_limits_set if {
    some component in input.components
    component.type == "container"
    component.properties.resources.limits.memory
    component.properties.resources.limits.cpu
}

# Helper functions
package_installed(pkg) if {
    some component in input.components
    some package in component.packages
    package.name == pkg
}

contains_pattern(pattern) if {
    some component in input.components
    regex.match(pattern, component.content)
}

# Vulnerability severity counts for reporting
vulnerability_summary := {
    "critical": count(critical_vulns),
    "high": count(high_vulns),
    "medium": count(medium_vulns),
    "low": count(low_vulns),
}

medium_vulns[vuln] if {
    some component in input.components
    some vulnerability in component.vulnerabilities
    vulnerability.severity == "MEDIUM"
    vuln := vulnerability
}

low_vulns[vuln] if {
    some component in input.components
    some vulnerability in component.vulnerabilities
    vulnerability.severity == "LOW"
    vuln := vulnerability
}

# License compliance
license_compliance if {
    allowed_licenses := {
        "MIT", "Apache-2.0", "BSD-3-Clause", "BSD-2-Clause",
        "ISC", "PostgreSQL", "Python-2.0", "Unlicense"
    }
    
    disallowed_licenses := {
        "GPL-3.0", "AGPL-3.0", "CC-BY-NC", "PROPRIETARY"
    }
    
    all_licenses_allowed
    no_disallowed_licenses
}

all_licenses_allowed if {
    licenses := {lic | 
        some component in input.components
        some license in component.licenses
        lic := license.name
    }
    
    count(licenses - allowed_licenses) == 0
}

no_disallowed_licenses if {
    licenses := {lic | 
        some component in input.components
        some license in component.licenses
        lic := license.name
    }
    
    count(licenses & disallowed_licenses) == 0
}

# Generate violation report
violations[msg] if {
    count(critical_vulns) > 0
    msg := sprintf("Found %d critical vulnerabilities", [count(critical_vulns)])
}

violations[msg] if {
    count(high_vulns) > max_high_vulns
    msg := sprintf("Found %d high vulnerabilities (max allowed: %d)", [count(high_vulns), max_high_vulns])
}

violations[msg] if {
    not approved_base_images
    msg := "Using non-approved base image"
}

violations[msg] if {
    not no_root_user
    msg := "Container runs as root user"
}

violations[msg] if {
    not no_sensitive_data
    msg := "Sensitive data detected in image"
}

violations[msg] if {
    not signed_images
    msg := "Image is not signed"
}

violations[msg] if {
    not resource_limits_set
    msg := "Resource limits not configured"
}

violations[msg] if {
    not license_compliance
    msg := "License compliance issues detected"
}
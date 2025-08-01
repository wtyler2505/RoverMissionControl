#!/bin/bash
# Dockerfile security best practices checker

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Exit codes
EXIT_SUCCESS=0
EXIT_FAILURE=1

# Track violations
VIOLATIONS=0

echo "🔍 Checking Dockerfile security best practices..."

# Function to check a Dockerfile
check_dockerfile() {
    local dockerfile="$1"
    local errors=()
    
    echo "Checking: $dockerfile"
    
    # Check for USER instruction (non-root)
    if ! grep -q "^USER " "$dockerfile"; then
        errors+=("❌ No USER instruction found - container will run as root")
        ((VIOLATIONS++))
    else
        user=$(grep "^USER " "$dockerfile" | tail -1 | awk '{print $2}')
        if [[ "$user" == "root" || "$user" == "0" ]]; then
            errors+=("❌ Container runs as root user")
            ((VIOLATIONS++))
        else
            echo -e "${GREEN}✓ Container runs as non-root user: $user${NC}"
        fi
    fi
    
    # Check for HEALTHCHECK
    if ! grep -q "^HEALTHCHECK" "$dockerfile"; then
        errors+=("⚠️ No HEALTHCHECK instruction found")
        ((VIOLATIONS++))
    else
        echo -e "${GREEN}✓ HEALTHCHECK is defined${NC}"
    fi
    
    # Check for secrets in ENV
    if grep -E "^ENV.*(PASSWORD|SECRET|KEY|TOKEN)" "$dockerfile" | grep -v "PLACEHOLDER\|EXAMPLE"; then
        errors+=("❌ Potential secrets found in ENV instructions")
        ((VIOLATIONS++))
    fi
    
    # Check for apt-get/apk without cleanup
    if grep -E "(apt-get install|apk add)" "$dockerfile" | grep -v "rm -rf /var/lib/apt/lists\|--no-cache"; then
        errors+=("⚠️ Package installation without cache cleanup")
        ((VIOLATIONS++))
    fi
    
    # Check for COPY with proper ownership
    if grep "^COPY " "$dockerfile" | grep -v "\-\-chown"; then
        echo -e "${YELLOW}⚠️ Some COPY instructions don't specify ownership${NC}"
    fi
    
    # Check for latest tag
    if grep -E "^FROM.*:latest" "$dockerfile"; then
        errors+=("❌ Using 'latest' tag in FROM instruction - use specific versions")
        ((VIOLATIONS++))
    fi
    
    # Check for LABEL metadata
    required_labels=("maintainer" "version" "description")
    for label in "${required_labels[@]}"; do
        if ! grep -q "^LABEL.*$label" "$dockerfile"; then
            echo -e "${YELLOW}⚠️ Missing recommended LABEL: $label${NC}"
        fi
    done
    
    # Check for ENTRYPOINT or CMD
    if ! grep -E "^(ENTRYPOINT|CMD)" "$dockerfile"; then
        errors+=("❌ No ENTRYPOINT or CMD instruction found")
        ((VIOLATIONS++))
    fi
    
    # Check for EXPOSE
    if ! grep -q "^EXPOSE" "$dockerfile"; then
        echo -e "${YELLOW}⚠️ No EXPOSE instruction found${NC}"
    fi
    
    # Check for multi-stage builds (for compiled languages)
    if grep -q "^FROM.*AS.*build" "$dockerfile"; then
        echo -e "${GREEN}✓ Multi-stage build detected${NC}"
    fi
    
    # Check for WORKDIR
    if ! grep -q "^WORKDIR" "$dockerfile"; then
        errors+=("⚠️ No WORKDIR instruction found")
        ((VIOLATIONS++))
    fi
    
    # Check for ADD vs COPY (prefer COPY)
    if grep -q "^ADD " "$dockerfile"; then
        echo -e "${YELLOW}⚠️ ADD instruction used - consider using COPY instead${NC}"
    fi
    
    # Report errors for this file
    if [ ${#errors[@]} -gt 0 ]; then
        echo -e "${RED}Security issues found:${NC}"
        for error in "${errors[@]}"; do
            echo "  $error"
        done
    fi
    
    echo ""
}

# Find and check all Dockerfiles
for dockerfile in $(git diff --cached --name-only --diff-filter=ACM | grep -E "(Dockerfile|\.dockerfile)$"); do
    if [ -f "$dockerfile" ]; then
        check_dockerfile "$dockerfile"
    fi
done

# Summary
if [ $VIOLATIONS -eq 0 ]; then
    echo -e "${GREEN}✅ All Dockerfile security checks passed!${NC}"
    exit $EXIT_SUCCESS
else
    echo -e "${RED}❌ Found $VIOLATIONS security violations in Dockerfiles${NC}"
    echo "Please fix the issues before committing."
    exit $EXIT_FAILURE
fi
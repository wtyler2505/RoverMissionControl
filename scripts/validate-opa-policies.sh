#!/bin/bash
# Validate OPA security policies

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Validating OPA security policies..."

# Check if OPA is installed
if ! command -v opa &> /dev/null; then
    echo -e "${YELLOW}⚠️ OPA not installed, downloading...${NC}"
    
    # Download OPA
    OPA_VERSION="v0.60.0"
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -L -o /tmp/opa https://openpolicyagent.org/downloads/${OPA_VERSION}/opa_linux_amd64_static
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        curl -L -o /tmp/opa https://openpolicyagent.org/downloads/${OPA_VERSION}/opa_darwin_arm64_static
    else
        echo -e "${RED}❌ Unsupported OS for OPA download${NC}"
        exit 1
    fi
    
    chmod +x /tmp/opa
    OPA_CMD="/tmp/opa"
else
    OPA_CMD="opa"
fi

ERRORS=0

# Find all .rego files
for policy in $(git diff --cached --name-only --diff-filter=ACM | grep "\.rego$"); do
    if [ -f "$policy" ]; then
        echo "Validating: $policy"
        
        # Check syntax
        if $OPA_CMD fmt --list "$policy" | grep -q "$policy"; then
            echo -e "${YELLOW}⚠️ Policy needs formatting${NC}"
            $OPA_CMD fmt -w "$policy"
            git add "$policy"
        fi
        
        # Validate policy
        if ! $OPA_CMD test "$policy" 2>/dev/null; then
            echo -e "${RED}❌ Policy validation failed${NC}"
            ((ERRORS++))
        else
            echo -e "${GREEN}✓ Policy is valid${NC}"
        fi
        
        # Check for common issues
        if grep -q "default allow := true" "$policy"; then
            echo -e "${RED}❌ Dangerous default allow policy detected${NC}"
            ((ERRORS++))
        fi
        
        if ! grep -q "package" "$policy"; then
            echo -e "${RED}❌ Missing package declaration${NC}"
            ((ERRORS++))
        fi
    fi
done

# Test policies with sample data if available
if [ -d ".github/security-policies/test-data" ]; then
    echo "Running policy tests..."
    
    for test_file in .github/security-policies/test-data/*.json; do
        if [ -f "$test_file" ]; then
            policy_file="${test_file%.json}.rego"
            if [ -f "$policy_file" ]; then
                echo "Testing $(basename "$policy_file") with $(basename "$test_file")"
                
                result=$($OPA_CMD eval -d "$policy_file" -i "$test_file" "data.docker.security.allow" 2>&1)
                
                if echo "$result" | grep -q '"result".*true'; then
                    echo -e "${GREEN}✓ Test passed${NC}"
                else
                    echo -e "${RED}❌ Test failed${NC}"
                    echo "$result"
                    ((ERRORS++))
                fi
            fi
        fi
    done
fi

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All OPA policies validated successfully!${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS policy validation errors${NC}"
    exit 1
fi
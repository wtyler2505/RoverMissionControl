#!/bin/bash
# Quick dependency security scan for pre-commit

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Running quick dependency security scan..."

VULNERABILITIES=0

# Check Python dependencies
if [ -f "backend/requirements.txt" ]; then
    echo "Checking Python dependencies..."
    
    # Use pip-audit if available
    if command -v pip-audit &> /dev/null; then
        if ! pip-audit -r backend/requirements.txt --desc; then
            echo -e "${RED}❌ Vulnerabilities found in Python dependencies${NC}"
            ((VULNERABILITIES++))
        else
            echo -e "${GREEN}✓ Python dependencies are secure${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ pip-audit not installed, using safety check${NC}"
        
        # Fallback to safety
        if command -v safety &> /dev/null; then
            if ! safety check -r backend/requirements.txt --json; then
                echo -e "${RED}❌ Vulnerabilities found in Python dependencies${NC}"
                ((VULNERABILITIES++))
            fi
        else
            echo -e "${YELLOW}⚠️ No Python vulnerability scanner available${NC}"
            echo "Install with: pip install pip-audit safety"
        fi
    fi
fi

# Check Node.js dependencies
check_node_deps() {
    local dir=$1
    local pkg_file="$dir/package.json"
    
    if [ -f "$pkg_file" ]; then
        echo "Checking Node.js dependencies in $dir..."
        
        cd "$dir"
        
        # Use npm audit
        if command -v npm &> /dev/null; then
            audit_result=$(npm audit --json 2>/dev/null || true)
            
            if [ -n "$audit_result" ]; then
                vulns=$(echo "$audit_result" | jq -r '.metadata.vulnerabilities // {}')
                critical=$(echo "$vulns" | jq -r '.critical // 0')
                high=$(echo "$vulns" | jq -r '.high // 0')
                
                if [ "$critical" -gt 0 ] || [ "$high" -gt 0 ]; then
                    echo -e "${RED}❌ Found $critical critical and $high high vulnerabilities${NC}"
                    ((VULNERABILITIES++))
                    
                    # Try to fix automatically
                    echo "Attempting automatic fix..."
                    npm audit fix --force 2>/dev/null || true
                else
                    echo -e "${GREEN}✓ No critical/high vulnerabilities found${NC}"
                fi
            fi
        fi
        
        cd - > /dev/null
    fi
}

# Check frontend and other Node.js projects
for node_project in frontend apps/frontend apps/rover-control-frontend; do
    if [ -d "$node_project" ]; then
        check_node_deps "$node_project"
    fi
done

# Check for known vulnerable versions
echo "Checking for known vulnerable package versions..."

# Critical vulnerabilities database (simplified)
declare -A vulnerable_packages=(
    ["log4j"]="< 2.17.0"
    ["commons-text"]="< 1.10.0"
    ["jackson-databind"]="< 2.13.4.2"
    ["spring-core"]="< 5.3.20"
    ["lodash"]="< 4.17.21"
    ["minimist"]="< 1.2.6"
    ["axios"]="< 0.21.2"
)

# Check for vulnerable packages
for pkg in "${!vulnerable_packages[@]}"; do
    if grep -r "$pkg" --include="*.txt" --include="*.json" --include="*.lock" . 2>/dev/null | grep -v node_modules; then
        echo -e "${YELLOW}⚠️ Found $pkg - ensure version is ${vulnerable_packages[$pkg]}${NC}"
    fi
done

# Check for outdated packages
echo "Checking for severely outdated packages..."

# Python
if [ -f "backend/requirements.txt" ] && command -v pip &> /dev/null; then
    outdated=$(pip list --outdated --format=json 2>/dev/null || echo "[]")
    outdated_count=$(echo "$outdated" | jq '. | length')
    
    if [ "$outdated_count" -gt 10 ]; then
        echo -e "${YELLOW}⚠️ Found $outdated_count outdated Python packages${NC}"
    fi
fi

# Summary
if [ $VULNERABILITIES -eq 0 ]; then
    echo -e "${GREEN}✅ Quick security scan passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $VULNERABILITIES security issues${NC}"
    echo "Run full security scan with: npm audit / pip-audit"
    exit 1
fi
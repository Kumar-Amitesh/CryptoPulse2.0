#!/bin/bash

:> ci-pre-commit.log
exec > >(tee -a ci-pre-commit.log) 2>&1

GREEN="\e[32m"
RED="\e[31m"
YELLOW="\e[33m"
CYAN="\e[36m"
NC="\e[0m"

echo -e "${YELLOW}🔍 Auto-detecting staged services...${NC}"

STAGED_SERVICES=($(git diff --cached --name-only | cut -d/ -f1 | sort -u))

VALID_SERVICES=()

for service in "${STAGED_SERVICES[@]}"; do
    if [ -d "$service" ] && [ -f "$service/package.json" ]; then
        VALID_SERVICES+=("$service")
    fi
done

echo -e "${CYAN}👉 Staged Services: ${VALID_SERVICES[*]}${NC}"

if [ ${#VALID_SERVICES[@]} -eq 0 ]; then
    echo -e "${GREEN}✨ No service changes staged.${NC}"
    exit 0
fi

for service in "${VALID_SERVICES[@]}"; do
    echo -e "\n${CYAN}→ Quick lint: $service${NC}"
    (cd "$service" && npm test) || exit 1
done

echo -e "${GREEN}✅ [PRE-COMMIT] All checks passed.${NC}"
exit 0

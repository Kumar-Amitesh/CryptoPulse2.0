#!/bin/bash
# looks at STAGED files (pre-commit) instead of committed ones.

# Redirect ALL output to file (and show on terminal)

:> ci-deploy.log
exec > >(tee -a ci-deploy.log) 2>&1

GREEN="\e[32m"
RED="\e[31m"
YELLOW="\e[33m"
NC="\e[0m"

SERVICES=("auth-service" "api-gateway" "data-service" "worker-service" "scheduler-service" "websocket-service" "graphql-service")

CHANGED_SERVICES=()

echo -e "${YELLOW}🔍 CHECKING FOR CHANGES (Git Diff)...${NC}"
    for service in "${SERVICES[@]}"; do
        # Check if the folder has changed in the last commit
        # if git diff --name-only HEAD~1 | grep "^$service/" > /dev/null; then
        # Check staged changes for pre-commit hook
        if git diff --cached --name-only --diff-filter=ACMR | grep "^$service/" > /dev/null; then
            CHANGED_SERVICES+=("$service")
        fi
    done

if [ ${#CHANGED_SERVICES[@]} -eq 0 ]; then
    echo -e "${GREEN}✨ No changes detected. System is up to date.${NC}"
    exit 0
fi

# echo -e "${YELLOW}\n[2/7] 🧪 RUNNING LOCAL TESTS...${NC}"

# for service in "${SERVICES[@]}"; do
#     echo -e "\n${CYAN}→ Testing: $service${NC}"

#     docker compose run --rm --no-deps \
#       -e MONGO_URI="mongodb://localhost:27017/non_existent_db" \
#       $service npm test

#     if [ $? -ne 0 ]; then
#         echo -e "${RED}❌ TESTS FAILED for $service. STOPPING PIPELINE.${NC}"
#         exit 1
#     fi
# done


echo -e "${CYAN}👉 Target Services: ${CHANGED_SERVICES[*]}${NC}"

# RUN LOCAL / UNIT TESTS

echo -e "${YELLOW}\n[2/7] 🧪 RUNNING LOCAL TESTS...${NC}"

for service in "${CHANGED_SERVICES[@]}"; do
    echo -e "\n${CYAN}→ Testing: $service${NC}"

    docker compose run --rm --no-deps \
      -e MONGO_URI="mongodb://localhost:27017/non_existent_db" \
      $service npm test

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ TESTS FAILED for $service. STOPPING PIPELINE.${NC}"
        exit 1
    fi
done


echo -e "${GREEN}✅ [PRE-COMMIT] Tests Passed. Proceeding to commit.${NC}"
exit 0
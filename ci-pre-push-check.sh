#!/bin/bash

:> ci-pre-push.log
exec > >(tee -a ci-pre-push.log) 2>&1

GREEN="\e[32m"
RED="\e[31m"
YELLOW="\e[33m"
CYAN="\e[36m"
NC="\e[0m"

echo -e "${YELLOW}🔍 Auto-detecting changed services (Git Diff)...${NC}"

# Auto detect changed top-level folders
CHANGED_SERVICES=($(git diff --name-only origin/main..HEAD | cut -d/ -f1 | sort -u))

# Filter only folders that contain package.json (actual services)
VALID_SERVICES=()
for service in "${CHANGED_SERVICES[@]}"; do
    if [ -d "$service" ] && [ -f "$service/package.json" ]; then
        VALID_SERVICES+=("$service")
    fi
done

echo -e "${CYAN}👉 Changed Services: ${VALID_SERVICES[*]}${NC}"

if [ ${#VALID_SERVICES[@]} -eq 0 ]; then
    echo -e "${GREEN}✨ No service-level changes detected.${NC}"
    exit 0
fi

echo -e "${YELLOW}\n[2/7] 🧪 RUNNING TESTS IN PARALLEL...${NC}"

PIDS=()

for service in "${VALID_SERVICES[@]}"; do
(
    echo -e "\n${CYAN}→ Testing: $service${NC}"

    docker compose run --rm --no-deps \
      -e MONGO_URI="mongodb://localhost:27017/non_existent_db" \
      $service npm test

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ FAILED: $service${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ PASSED: $service${NC}"
        exit 0
    fi
) &
    PIDS+=($!)
done

FAIL=0
for pid in "${PIDS[@]}"; do
    wait $pid || FAIL=1
done

if [ $FAIL -ne 0 ]; then
    echo -e "${RED}\n❌ One or more services failed. Blocking push.${NC}"
    exit 1
fi

echo -e "${GREEN}\n✅ [PRE-PUSH] All services passed in parallel.${NC}"
exit 0


































# #!/bin/bash
# # looks at STAGED files (pre-commit) instead of committed ones.

# # Redirect ALL output to file (and show on terminal)

# :> ci-pre-push.log
# exec > >(tee -a ci-pre-push.log) 2>&1

# GREEN="\e[32m"
# RED="\e[31m"
# YELLOW="\e[33m"
# NC="\e[0m"

# SERVICES=("auth-service" "api-gateway" "data-service" "worker-service" "scheduler-service" "websocket-service" "graphql-service")

# CHANGED_SERVICES=()

# # echo -e "${YELLOW}🔍 CHECKING FOR CHANGES (Git Diff)...${NC}"
# #     for service in "${SERVICES[@]}"; do
# #         # Check if the folder has changed in the last commit
# #         if git diff --name-only HEAD~1 -- "$service"  > /dev/null; then
# #         # Check staged changes for pre-commit hook
# #         # if git diff --cached --name-only --diff-filter=ACMR | grep "^$service/" > /dev/null; then
# #             CHANGED_SERVICES+=("$service")
# #         fi
# #     done

# echo -e "${YELLOW}🔍 CHECKING FOR CHANGES (Git Diff)...${NC}"

# CHANGED_SERVICES=()

# for file in $(git diff --name-only HEAD~1 HEAD); do
#     service=$(echo "$file" | cut -d/ -f1)

#     for s in "${SERVICES[@]}"; do
#         if [[ "$service" == "$s" && ! " ${CHANGED_SERVICES[*]} " =~ " $s " ]]; then
#             CHANGED_SERVICES+=("$s")
#         fi
#     done
# done

# echo -e "${CYAN}👉 Changed Services: ${CHANGED_SERVICES[*]}${NC}"

# if [ ${#CHANGED_SERVICES[@]} -eq 0 ]; then
#     echo -e "${GREEN}✨ No changes detected. System is up to date.${NC}"
#     exit 0
# fi

# # echo -e "${YELLOW}\n[2/7] 🧪 RUNNING LOCAL TESTS...${NC}"

# # for service in "${SERVICES[@]}"; do
# #     echo -e "\n${CYAN}→ Testing: $service${NC}"

# #     docker compose run --rm --no-deps \
# #       -e MONGO_URI="mongodb://localhost:27017/non_existent_db" \
# #       $service npm test

# #     if [ $? -ne 0 ]; then
# #         echo -e "${RED}❌ TESTS FAILED for $service. STOPPING PIPELINE.${NC}"
# #         exit 1
# #     fi
# # done


# # RUN LOCAL / UNIT TESTS

# echo -e "${YELLOW}\n[2/7] 🧪 RUNNING LOCAL TESTS...${NC}"

# for service in "${CHANGED_SERVICES[@]}"; do
#     echo -e "\n${CYAN}→ Testing: $service${NC}"

#     docker compose run --rm --no-deps \
#       -e MONGO_URI="mongodb://localhost:27017/non_existent_db" \
#       $service npm test

#     if [ $? -ne 0 ]; then
#         echo -e "${RED}❌ TESTS FAILED for $service. STOPPING PIPELINE.${NC}"
#         exit 1
#     fi
# done


# echo -e "${GREEN}✅ [PRE-PUSH] Tests Passed. Proceeding to commit.${NC}"
# exit 0
#!/bin/bash

# Configuration
# List of services that have tests to run
SERVICES=("auth-service" "api-gateway" "data-service" "worker-service" "scheduler-service" "websocket-service" "graphql-service")

# Step 1: CI (Continuous Integration)
echo "🔄 [CI] Starting Local Build & Test Pipeline..."

# 1. Build the images first so we test the exact code we plan to deploy
echo "🛠️  [CI] Building Docker images..."
docker compose build

# 2. Loop through each service and run its tests
for service in "${SERVICES[@]}"; do
    echo "🧪 [CI] Running tests for: $service"
    
    # 'run --rm' creates a temporary container, runs the command, and deletes it.
    # '--no-deps' ensures we don't start the whole database stack just for a unit test.
    # Inject a fake Mongo URI so if a test accidentally tries to connect, it fails harmlessly
    docker compose run --rm --no-deps -e MONGO_URI="mongodb://localhost:27017/non_existent_db" $service npm test
    
    # Check the exit code of the last command
    if [ $? -ne 0 ]; then
        echo "❌ [CI] Tests FAILED for $service. Deployment cancelled."
        exit 1
    fi
    echo "✅ [CI] Tests PASSED for $service."
done

echo "🎉 [CI] All tests passed!"

# CD (Continuous Deployment)
echo "🚀 [CD] Starting Application..."

# 3. Start the application

echo "🌐 [CD] Application is going live!"
docker compose up




# #!/bin/bash

# # ===================================================
# #  🔁 Local CI/CD Pipeline (Build → Test → Deploy)
# # ===================================================

# # Colors for logs
# GREEN="\e[32m"
# RED="\e[31m"
# YELLOW="\e[33m"
# CYAN="\e[36m"
# NC="\e[0m" # No color

# SERVICES=("auth-service" "api-gateway" "data-service" "worker-service" "scheduler-service" "websocket-service" "graphql-service")

# echo -e "${CYAN}\n=============================="
# echo -e " 🔄 [CI] Starting Local CI/CD"
# echo -e "==============================${NC}"

# # ===================================================
# # 1️⃣ BUILD STAGE
# # ===================================================
# echo -e "${YELLOW}\n[1/3] 🛠 BUILDING DOCKER IMAGES...${NC}"
# if ! docker compose build; then
#     echo -e "${RED}❌ Build failed. Stopping pipeline.${NC}"
#     exit 1
# fi
# echo -e "${GREEN}✅ Build completed!${NC}"


# # ===================================================
# # 2️⃣ TEST STAGE (CI)
# # ===================================================
# echo -e "${YELLOW}\n[2/3] 🧪 RUNNING TESTS FOR ALL SERVICES...${NC}"

# FAILED_SERVICES=()

# for service in "${SERVICES[@]}"; do
#     echo -e "\n${CYAN}→ Testing: $service${NC}"

#     docker compose run --rm --no-deps \
#       -e MONGO_URI="mongodb://localhost:27017/non_existent" \
#       $service npm test

#     if [ $? -ne 0 ]; then
#         echo -e "${RED}❌ Tests FAILED for $service${NC}"
#         FAILED_SERVICES+=("$service")
#     else
#         echo -e "${GREEN}✅ Tests PASSED for $service${NC}"
#     fi
# done

# # If ANY test fails → CI fails
# if [ ${#FAILED_SERVICES[@]} -ne 0 ]; then
#     echo -e "${RED}\n❌ CI FAILED — Some services failed tests:${NC}"
#     for s in "${FAILED_SERVICES[@]}"; do
#         echo -e "  - $RED$s$NC"
#     done
#     exit 1
# fi

# echo -e "${GREEN}\n🎉 All tests passed! Proceeding to deployment...${NC}"


# # ===================================================
# # 3️⃣ DEPLOY STAGE (CD)
# # ===================================================
# echo -e "${YELLOW}\n[3/3] 🚀 DEPLOYING APPLICATION...${NC}"

# # Backup last compose run
# echo -e "${CYAN}→ Checking for previous deployment...${NC}"
# docker compose down 2>/dev/null

# # Deploy new version
# if ! docker compose up -d; then
#     echo -e "${RED}❌ Deployment failed. Rolling back...${NC}"
#     docker compose down
#     exit 1
# fi

# echo -e "${GREEN}🌐 Deployment started successfully!${NC}"
# echo -e "${CYAN}→ Waiting for services to become healthy...${NC}"


# # ===================================================
# # HEALTH CHECK
# # ===================================================
# sleep 5
# docker compose ps

# echo -e "${GREEN}\n🎉 CI/CD PIPELINE COMPLETED SUCCESSFULLY!${NC}"


# #!/bin/bash

# # Configuration
# # List of services that have tests to run
# SERVICES=("auth-service" "api-gateway" "data-service" "worker-service" "scheduler-service" "websocket-service" "graphql-service")

# # Step 1: CI (Continuous Integration)
# echo "🔄 [CI] Starting Local Build & Test Pipeline..."

# # 1. Build the images first so we test the exact code we plan to deploy
# echo "🛠️  [CI] Building Docker images..."
# docker compose build

# # 2. Loop through each service and run its tests
# for service in "${SERVICES[@]}"; do
#     echo "🧪 [CI] Running tests for: $service"
    
#     # 'run --rm' creates a temporary container, runs the command, and deletes it.
#     # '--no-deps' ensures we don't start the whole database stack just for a unit test.
#     # Inject a fake Mongo URI so if a test accidentally tries to connect, it fails harmlessly
#     docker compose run --rm --no-deps -e MONGO_URI="mongodb://localhost:27017/non_existent_db" $service npm test
    
#     # Check the exit code of the last command
#     if [ $? -ne 0 ]; then
#         echo "❌ [CI] Tests FAILED for $service. Deployment cancelled."
#         exit 1
#     fi
#     echo "✅ [CI] Tests PASSED for $service."
# done

# echo "🎉 [CI] All tests passed!"

# # CD (Continuous Deployment)
# echo "🚀 [CD] Starting Application..."

# # 3. Start the application

# echo "🌐 [CD] Application is going live!"
# docker compose up




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

# # ===================================================
# # Attach to logs (interactive mode)
# # ===================================================
# # echo -e "${CYAN}\n📺 Attaching to live logs (interactive mode)...${NC}"
# # docker compose logs -f




# #!/bin/bash

# # ===================================================
# #  🔁 LOCAL CI/CD PIPELINE WITH REAL ROLLBACK & ZERO DOWNTIME
# #  ✅ Only ONE backup per service (timestamp based)
# #  ✅ Local tests before building images
# #  ✅ Safe rollback per service
# # ===================================================

# # Colors
# GREEN="\e[32m"
# RED="\e[31m"
# YELLOW="\e[33m"
# CYAN="\e[36m"
# NC="\e[0m"

# # Config
# SERVICES=("auth-service" "api-gateway" "data-service" "worker-service" "scheduler-service" "websocket-service" "graphql-service")
# TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# echo -e "${CYAN}\n=============================="
# echo -e " 🔄 CI/CD PIPELINE STARTED"
# echo -e "==============================${NC}"

# # ===================================================
# # 1️⃣ RUN LOCAL/UNIT TESTS BEFORE BUILD
# # ===================================================
# echo -e "${YELLOW}\n[1/5] 🧪 RUNNING LOCAL/UNIT TESTS...${NC}"

# if ! npm test; then
#     echo -e "${RED}❌ LOCAL/UNIT TESTS FAILED. PIPELINE STOPPED.${NC}"
#     exit 1
# fi

# echo -e "${GREEN}✅ LOCAL/UNIT TESTS PASSED${NC}"

# # ===================================================
# # 2️⃣ BACKUP CURRENT RUNNING CONTAINERS
# # ===================================================
# echo -e "${YELLOW}\n[2/5] 🔐 BACKING UP CURRENT CONTAINERS...${NC}"

# for service in "${SERVICES[@]}"; do
#     RUNNING_ID=$(docker ps -qf "name=${service}")

#     if [ -n "$RUNNING_ID" ]; then
#         CURRENT_IMAGE=$(docker inspect --format='{{.Config.Image}}' $RUNNING_ID)
#         BACKUP_IMAGE="$service:backup-$TIMESTAMP"

#         # Remove old backups
#         OLD_BACKUPS=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "$service:backup-")
#         for img in $OLD_BACKUPS; do
#             docker rmi -f "$img"
#             echo -e "${YELLOW}🧹 Removed old backup: $img${NC}"
#         done

#         # Create new backup
#         docker tag "$CURRENT_IMAGE" "$BACKUP_IMAGE"
#         echo -e "${CYAN}📦 Backup created: $BACKUP_IMAGE${NC}"
#     else
#         echo -e "${YELLOW}⚠️  $service was not running${NC}"
#     fi
# done

# # ===================================================
# # 3️⃣ BUILD NEW IMAGES
# # ===================================================
# echo -e "${YELLOW}\n[3/5] 🛠 BUILDING NEW IMAGES...${NC}"

# if ! docker compose build; then
#     echo -e "${RED}❌ BUILD FAILED. PIPELINE STOPPED.${NC}"
#     exit 1
# fi

# echo -e "${GREEN}✅ BUILD SUCCESSFUL${NC}"

# # ===================================================
# # 4️⃣ DEPLOY SERVICES (ZERO-DOWNTIME, PER SERVICE)
# # ===================================================
# echo -e "${YELLOW}\n[4/5] 🚀 DEPLOYING SERVICES...${NC}"

# for service in "${SERVICES[@]}"; do
#     echo -e "${CYAN}→ Deploying: $service${NC}"

#     if ! docker compose up -d --no-deps $service; then
#         echo -e "${RED}❌ $service DEPLOYMENT FAILED. ROLLING BACK...${NC}"

#         # Remove broken latest image
#         docker rmi -f "$service:latest"

#         # Restore backup
#         BACKUP_IMAGE=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "$service:backup-")
#         if [ -n "$BACKUP_IMAGE" ]; then
#             docker tag "$BACKUP_IMAGE" "$service:latest"
#             echo -e "${GREEN}✅ $service rolled back to backup image${NC}"

#             # Restart container
#             docker compose up -d --no-deps $service
#             echo -e "${GREEN}✅ $service container restarted${NC}"
#         else
#             echo -e "${RED}⚠️ No backup found for $service, manual intervention needed${NC}"
#         fi
#     else
#         echo -e "${GREEN}✅ $service deployed successfully${NC}"
#     fi
# done

# # ===================================================
# # 5️⃣ HEALTH CHECK & LOGS
# # ===================================================
# echo -e "${CYAN}\n⏱ Waiting for services to stabilize...${NC}"
# sleep 5

# docker compose ps

# echo -e "${GREEN}\n🎉 DEPLOYMENT COMPLETE${NC}"
# echo -e "${CYAN}📺 Live logs:${NC}"
# docker compose logs -f












#!/bin/bash

# ===================================================
#  🔁 LOCAL CI/CD PIPELINE — PRO MODE
#  ✅ Changed-services only deploy
#  ✅ ONE timestamp backup per service
#  ✅ Real health checks
#  ✅ Safe rollback + zero downtime
# ===================================================

# ---- COLORS ----
GREEN="\e[32m"
RED="\e[31m"
YELLOW="\e[33m"
CYAN="\e[36m"
NC="\e[0m"

# ---- CONFIG ----
SERVICES=("auth-service" "api-gateway" "data-service" "worker-service" "scheduler-service" "websocket-service" "graphql-service")
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${CYAN}\n=============================="
echo -e " 🔄 LOCAL CI/CD PIPELINE"
echo -e "==============================${NC}"

# ===================================================
# 1️⃣ DETECT CHANGED SERVICES
# ===================================================

echo -e "${YELLOW}\n[1/7] 🔍 DETECTING CHANGED SERVICES...${NC}"

CHANGED_SERVICES=()

for service in "${SERVICES[@]}"; do
    if git diff --name-only HEAD~1 | grep "^$service/" > /dev/null; then
        CHANGED_SERVICES+=("$service")
    fi
done

if [ ${#CHANGED_SERVICES[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No service changes detected. Skipping deployment.${NC}"
    exit 0
fi

echo -e "${CYAN}🧩 Services to deploy: ${CHANGED_SERVICES[*]}${NC}"

# ===================================================
# 2️⃣ RUN LOCAL / UNIT TESTS
# ===================================================

echo -e "${YELLOW}\n[2/7] 🧪 RUNNING LOCAL TESTS...${NC}"

if ! npm test; then
    echo -e "${RED}❌ TESTS FAILED. PIPELINE STOPPED.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ TESTS PASSED${NC}"

# ===================================================
# 3️⃣ BACKUP RUNNING CONTAINERS
# ===================================================

echo -e "${YELLOW}\n[3/7] 🔐 BACKING UP RUNNING CONTAINERS...${NC}"

for service in "${CHANGED_SERVICES[@]}"; do

    RUNNING_ID=$(docker ps -qf "name=${service}")

    if [ -n "$RUNNING_ID" ]; then
        CURRENT_IMAGE=$(docker inspect --format='{{.Config.Image}}' $RUNNING_ID)
        BACKUP_IMAGE="$service:backup-$TIMESTAMP"

        # Remove old backups
        OLD_BACKUPS=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "$service:backup-")
        for img in $OLD_BACKUPS; do
            docker rmi -f "$img" > /dev/null 2>&1
            echo -e "${YELLOW}🧹 Removed old: $img${NC}"
        done

        # Create new backup
        docker tag "$CURRENT_IMAGE" "$BACKUP_IMAGE"
        echo -e "${CYAN}📦 Backup created: $BACKUP_IMAGE${NC}"
    else
        echo -e "${YELLOW}⚠️  $service not running — no backup needed${NC}"
    fi

done

# ===================================================
# 4️⃣ BUILD ONLY CHANGED SERVICES
# ===================================================

echo -e "${YELLOW}\n[4/7] 🛠 BUILDING IMAGES...${NC}"

if ! docker compose build "${CHANGED_SERVICES[@]}"; then
    echo -e "${RED}❌ BUILD FAILED. STOPPING PIPELINE.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ BUILD SUCCESS${NC}"

# ===================================================
# HEALTH CHECK FUNCTION
# ===================================================

check_health() {

  SERVICE=$1

  for i in {1..10}; do

    STATUS=$(docker inspect --format='{{.State.Health.Status}}' $SERVICE 2>/dev/null)

    if [ "$STATUS" == "healthy" ]; then
      echo -e "${GREEN}✅ $SERVICE is healthy${NC}"
      return 0
    fi

    echo -e "${YELLOW}⏳ Waiting for $SERVICE to be healthy...${NC}"
    sleep 3
  done

  return 1
}

# ===================================================
# 5️⃣ ZERO-DOWNTIME DEPLOY + HEALTH CHECK
# ===================================================

echo -e "${YELLOW}\n[5/7] 🚀 DEPLOYING SERVICES...${NC}"

DEPLOYED=()
FAILED=()

for service in "${CHANGED_SERVICES[@]}"; do

    echo -e "${CYAN}\n→ Deploying $service${NC}"

    if ! docker compose up -d --no-deps $service; then

        echo -e "${RED}❌ $service deployment failed${NC}"
        FAILED+=("$service")
        continue
    fi

    if check_health "$service"; then
        DEPLOYED+=("$service")
    else
        echo -e "${RED}❌ $service failed health check. Rolling back...${NC}"

        docker rmi -f "$service:latest" > /dev/null 2>&1

        BACKUP_IMAGE=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "$service:backup-")
        if [ -n "$BACKUP_IMAGE" ]; then
            docker tag "$BACKUP_IMAGE" "$service:latest"
            docker compose up -d --no-deps $service
            echo -e "${GREEN}✅ $service rolled back and restarted${NC}"
        else
            echo -e "${RED}⛔ No backup found for $service${NC}"
        fi

        FAILED+=("$service")
    fi

done

# ===================================================
# 6️⃣ PIPELINE DASHBOARD
# ===================================================

echo -e "\n${CYAN}================================"
echo -e " 📊 PIPELINE STATUS DASHBOARD"
echo -e "================================${NC}"

printf "%-25s %-25s\n" "SERVICE" "STATUS"
echo "----------------------------------------------------------"

for service in "${CHANGED_SERVICES[@]}"; do

    STATUS=$(docker ps --format "{{.Names}} : {{.Status}}" | grep "$service")

    if [ -z "$STATUS" ]; then
        echo -e "$service                 ${RED}DOWN${NC}"
    else
        echo -e "$STATUS"
    fi

done

# ===================================================
# 7️⃣ FINAL RESULT
# ===================================================

echo -e "\n${CYAN}=============================="
echo -e " 🚦 PIPELINE RESULT"
echo -e "==============================${NC}"

if [ ${#FAILED[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ ALL DEPLOYMENTS SUCCESSFUL${NC}"
else
    echo -e "${YELLOW}✅ Successful : ${DEPLOYED[*]}${NC}"
    echo -e "${RED}❌ Failed     : ${FAILED[*]}${NC}"
fi

echo -e "\n${CYAN}📺 Live container logs:${NC}"
# docker compose logs --tail=50
docker compose logs -f

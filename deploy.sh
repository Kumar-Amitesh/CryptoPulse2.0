#!/bin/bash

#  CI/CD PIPELINE
#  Zero-Downtime Deployment (Blue-Green)
#  Automated Rollbacks
#  "Init" mode for first runs
#  Smart Change Detection

# COLORS
GREEN="\e[32m"
RED="\e[31m"
YELLOW="\e[33m"
CYAN="\e[36m"
NC="\e[0m"

# CONFIG
FIXED_PORT_SERVICES=("api-gateway" "redis" "mongo")
# SERVICES=("auth-service" "data-service" "api-gateway" "graphql-service" "websocket-service" "worker-service" "scheduler-service" )
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${CYAN}\n=============================="
echo -e " 🔄 CI/CD PIPELINE STARTED"
echo -e "==============================${NC}"

# DETECT SCOPE (INIT vs UPDATE)

CHANGED_SERVICES=()

if [[ "$1" == "--init" ]]; then
    echo -e "${YELLOW}🚀 INIT MODE DETECTED: Deploying ALL services...${NC}"
    CHANGED_SERVICES=("${SERVICES[@]}")
else
    echo -e "${YELLOW}🔍 CHECKING FOR CHANGES (Git Diff)...${NC}"
    # Find all changed top-level folders since last push
    CHANGED_FOLDERS=($(git diff --name-only origin/main..HEAD | cut -d/ -f1 | sort -u))

    for service in "${CHANGED_FOLDERS[@]}"; do
        if [ -d "$service" ] && [ -f "$service/package.json" ]; then
            CHANGED_SERVICES+=("$service")
        fi
    done
    echo -e "${CYAN}👉 Changed Services: ${CHANGED_SERVICES[*]}${NC}"
    
    # for service in "${SERVICES[@]}"; do
    #     # Check if the folder has changed in the last commit
    #     if git diff --name-only HEAD~1 -- "$service"  > /dev/null; then
    #         CHANGED_SERVICES+=("$service")
    #     fi
    # done
fi

if [ ${#CHANGED_SERVICES[@]} -eq 0 ]; then
    echo -e "${GREEN}✨ No changes detected. System is up to date.${NC}"
    exit 0
fi

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

echo -e "${GREEN}✅ TESTS PASSED${NC}"


# BUILD IMAGES

echo -e "${YELLOW}\n[2/4] 🛠 BUILDING IMAGES...${NC}"

if ! docker compose build "${CHANGED_SERVICES[@]}"; then
    echo -e "${RED}❌ BUILD FAILED. PIPELINE STOPPED.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build Success${NC}"


# DEPLOY SERVICES

echo -e "${YELLOW}\n[3/4] 🚀 DEPLOYING...${NC}"

DEPLOYED=()
FAILED=()

for service in "${CHANGED_SERVICES[@]}"; do
    echo -e "\n${CYAN}------------------------------------------------${NC}"
    echo -e "${CYAN}🔄 Updating: $service${NC}"

    # CHECK IF SERVICE IS FIXED-PORT (Standard Deploy) OR SCALABLE (Blue-Green)
    # if [[ " ${FIXED_PORT_SERVICES[*]} " =~ " ${service} " ]]; then
    #     # STANDARD DEPLOY
    #     echo -e "${YELLOW}⚠️  $service has fixed ports. Using Standard Recreate (brief downtime)...${NC}"
        
    #     # Recreate container
    #     if docker compose up -d --no-deps --force-recreate "$service"; then
    #          # Get the ID of the container we just started
    #          NEW_CONTAINER_ID=$(docker compose ps -q "$service" | head -n 1)
    #     else
    #          echo -e "${RED}❌ Failed to deploy $service${NC}"
    #          FAILED+=("$service")
    #          continue
    #     fi

    if [[ " ${FIXED_PORT_SERVICES[*]} " =~ " ${service} " ]]; then

        echo -e "${YELLOW}⚠️  $service has fixed ports. Performing backup + safe recreate...${NC}"

        # Old container ID
        OLD_CONTAINER_ID=$(docker compose ps -q "$service" | head -n 1)

        if [ -n "$OLD_CONTAINER_ID" ]; then
            BACKUP_NAME="${service}_backup_${TIMESTAMP}"

            echo -e "${CYAN}📦 Creating backup: $BACKUP_NAME${NC}"
            
            # Stop old container
            docker stop "$OLD_CONTAINER_ID" >/dev/null 2>&1
            
            # Rename using Docker’s container rename
            docker rename "$OLD_CONTAINER_ID" "$BACKUP_NAME"
        fi

        echo -e "${CYAN}🚀 Starting new instance of $service...${NC}"

        if docker compose up -d --no-deps --force-recreate "$service"; then
            NEW_CONTAINER_ID=$(docker compose ps -q "$service" | head -n 1)
        else
            echo -e "${RED}❌ Failed to start new instance. Restoring backup...${NC}"
            
            if [ -n "$BACKUP_NAME" ]; then
                docker rename "$BACKUP_NAME" "$service"
                docker start "$service"
            fi

            FAILED+=("$service")
            continue
        fi


        ### HEALTH CHECK
        echo -e "${YELLOW}⏳ Health checking new container ($NEW_CONTAINER_ID)...${NC}"

        HEALTHY="false"
        for i in {1..15}; do
            STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$NEW_CONTAINER_ID" 2>/dev/null)
            STATE=$(docker inspect --format='{{.State.Status}}' "$NEW_CONTAINER_ID" 2>/dev/null)

            if [ "$STATUS" == "healthy" ] || [ "$STATE" == "running" ]; then
                HEALTHY="true"
                break
            fi

            if [[ -z "$STATUS" || "$STATUS" == "<no value>" ]]; then
                if [ "$STATE" == "running" ]; then 
                    HEALTHY="true"
                    break
                fi
            fi

            echo -n "."
            sleep 3
        done
        echo ""

        if [ "$HEALTHY" == "true" ]; then
            echo -e "${GREEN}✅ $service is HEALTHY.${NC}"
            
            # delete backup if healthy
            if [ -n "$BACKUP_NAME" ]; then
                echo -e "${YELLOW}🧹 Removing backup container...${NC}"
                docker rm "$BACKUP_NAME" >/dev/null 2>&1
            fi

            DEPLOYED+=("$service")

        else
            echo -e "${RED}❌ New container unhealthy. Rolling back...${NC}"

            # remove broken
            docker stop "$NEW_CONTAINER_ID" >/dev/null 2>&1
            docker rm "$NEW_CONTAINER_ID" >/dev/null 2>&1

            # restore backup
            docker rename "$BACKUP_NAME" "$service"
            docker start "$service"

            FAILED+=("$service")
        fi

        continue
    fi

    else
        # BLUE-GREEN DEPLOY (Scale Up -> Health Check -> Scale Down)
        echo -e "${GREEN}✅ $service is scalable. Using Zero-Downtime Blue-Green...${NC}"

        OLD_CONTAINER_ID=$(docker compose ps -q "$service" | head -n 1)

        # Scale UP to 2
        if ! docker compose up -d --scale "$service"=2 --no-recreate "$service"; then
            echo -e "${RED}❌ Failed to scale $service${NC}"
            FAILED+=("$service")
            continue
        fi

        # Find new container ID
        if [ -n "$OLD_CONTAINER_ID" ]; then
            NEW_CONTAINER_ID=$(docker compose ps -q "$service" | grep -v "$OLD_CONTAINER_ID" | head -n 1)
        else
            NEW_CONTAINER_ID=$(docker compose ps -q "$service" | head -n 1)
        fi
    fi

    echo -e "${YELLOW}⏳ Health checking container ($NEW_CONTAINER_ID)...${NC}"

    # HEALTH CHECK LOOP
    HEALTHY="false"
    for i in {1..15}; do
        STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$NEW_CONTAINER_ID" 2>/dev/null | tr -d '\r')
        STATE=$(docker inspect --format='{{.State.Status}}' "$NEW_CONTAINER_ID" | tr -d '\r')

        # If has explicit healthcheck
        if [ "$STATUS" == "healthy" ]; then
            HEALTHY="true"
            break
        fi

        # Fallback: If no healthcheck defined, check if "running"
        # empty or "<no value>" means no healthcheck defined
        if [[ -z "$STATUS" || "$STATUS" == "<no value>" ]]; then
            if [ "$STATE" == "running" ]; then 
                HEALTHY="true"
                break
            fi
        fi
        
        echo -n "."
        sleep 4
    done
    echo ""

    if [ "$HEALTHY" == "true" ]; then
        echo -e "${GREEN}✅ Container is HEALTHY.${NC}"
        
        # Cleanup for Blue-Green services
        if [[ ! " ${FIXED_PORT_SERVICES[*]} " =~ " ${service} " ]]; then
            if [ -n "$OLD_CONTAINER_ID" ]; then
                echo -e "${YELLOW}🧹 Removing old instance...${NC}"
                docker stop "$OLD_CONTAINER_ID" > /dev/null 2>&1
                docker rm "$OLD_CONTAINER_ID" > /dev/null 2>&1
            fi
            # Reset scale to 1
            docker compose up -d --scale "$service"=1 --no-recreate "$service" > /dev/null 2>&1
        fi
        
        DEPLOYED+=("$service")
    else
        echo -e "${RED}❌ Container FAILED health check (Status: $STATUS, State: $STATE).${NC}"
        
        # Stop the unhealthy container
        echo -e "${YELLOW}TB Rolling back (Killing unhealthy container)...${NC}"
        docker stop "$NEW_CONTAINER_ID" > /dev/null 2>&1
        docker rm "$NEW_CONTAINER_ID" > /dev/null 2>&1
        
        # Restore old container scale
        docker compose up -d --scale "$service"=1 --no-recreate "$service"
        FAILED+=("$service")
    fi

done


# SUMMARY

echo -e "\n${CYAN}================================"
echo -e " 📊 DEPLOYMENT REPORT"
echo -e "================================${NC}"

if [ ${#FAILED[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ SUCCESS: All services deployed successfully.${NC}"
    echo -e "   Services: ${DEPLOYED[*]}"
else
    echo -e "${RED}⚠️  PARTIAL FAILURE${NC}"
    echo -e "${GREEN}   ✅ Deployed : ${DEPLOYED[*]}${NC}"
    echo -e "${RED}   ❌ Failed   : ${FAILED[*]}${NC}"
fi

echo -e "\n${CYAN}📺 Tail logs with: docker compose logs -f${NC}"
# docker compose logs -f
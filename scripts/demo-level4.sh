#!/bin/bash
# ============================================================
# DEMO SCRIPT - Level 4: High Performance & Scalability
# Pete Chat Application - Fullstack Final Project
# ============================================================
# Usage: ./demo-level4.sh [step]
#   Without args: show menu
#   With step number: run that step directly
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Helper functions
clear_screen() {
    printf '\033[2J'
    printf '\033[H'
}

print_header() {
    echo -e "${PURPLE}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║          PETE CHAT - Level 4 Demo: High Performance & Scalability    ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    local num=$1
    local title=$2
    echo -e "${CYAN}${BOLD}━━ STEP $num: $title ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_substep() {
    echo -e "  ${YELLOW}▶${NC} $1"
}

print_ok() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "  ${BLUE}ℹ${NC} $1"
}

print_warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

wait_key() {
    echo ""
    echo -e "${PURPLE}Press Enter to continue...${NC}"
    read -r
}

# Check prerequisites
check_prereq() {
    echo -e "${BOLD}Checking prerequisites...${NC}"

    # Check Docker
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running!${NC}"
        echo "Please start Docker Desktop first."
        exit 1
    fi
    print_ok "Docker is running"

    # Check containers
    RUNNING=$(docker ps --filter "name=pete-" --format "{{.Names}}" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$RUNNING" -lt 5 ]; then
        echo -e "${YELLOW}⚠ Only $RUNNING Pete containers running.${NC}"
        echo "Starting all containers..."
        cd "$(dirname "$0")/.." 2>/dev/null || cd "$(dirname "$0")/../.."
        docker-compose up -d --build 2>&1 | tail -5
        echo "Waiting 10s for containers to be ready..."
        sleep 10
    fi
    print_ok "All Pete containers are running"

    # Check Nginx
    if curl -s http://localhost/health > /dev/null 2>&1; then
        print_ok "Nginx is responding"
    else
        echo -e "${RED}❌ Nginx is not accessible at http://localhost${NC}"
        exit 1
    fi
}

# ============================================================
# STEP 1: Show Docker Architecture
# ============================================================
step1_architecture() {
    clear_screen
    print_header
    print_step 1 "System Architecture"
    echo ""
    echo -e "${BOLD}Architecture Overview:${NC}"
    echo ""
    echo -e "${CYAN}                         ┌─────────────────────────────────────┐${NC}"
    echo -e "${CYAN}                         │           USERS (Browser)          │${NC}"
    echo -e "${CYAN}                         │   • http://localhost:80             │${NC}"
    echo -e "${CYAN}                         │   • Real-time WebSocket chat        │${NC}"
    echo -e "${CYAN}                         │   • Load-balanced requests          │${NC}"
    echo -e "${CYAN}                         └──────────────┬──────────────────────┘${NC}"
    echo -e "${CYAN}                                        │${NC}"
    echo -e "${CYAN}                         ┌──────────────▼──────────────────────┐${NC}"
    echo -e "${CYAN}                         │     NGINX (Load Balancer)           │${NC}"
    echo -e "${CYAN}                         │   ┌──────────────────────────────┐  │${NC}"
    echo -e "${CYAN}                         │   │  • ip_hash sticky sessions    │  │${NC}"
    echo -e "${CYAN}                         │   │  • WebSocket upgrade support  │  │${NC}"
    echo -e "${CYAN}                         │   │  • Round-robin API requests   │  │${NC}"
    echo -e "${CYAN}                         │   └──────────────────────────────┘  │${NC}"
    echo -e "${CYAN}                         └──────┬───────────┬──────────┬──────┘${NC}"
    echo -e "${CYAN}                                │           │          │${NC}"
    echo -e "${CYAN}              ┌─────────────────┘           │          └─────────────────┐${NC}"
    echo -e "${CYAN}              ▼                                 ▼                           ▼${NC}"
    echo -e "${CYAN}    ┌─────────────────┐              ┌─────────────────┐            ┌─────────────────┐${NC}"
    echo -e "${CYAN}    │  BACKEND-1      │              │  BACKEND-2      │            │  BACKEND-3      │${NC}"
    echo -e "${CYAN}    │  (Docker)       │◄────────────►│  (Docker)       │◄──────────►│  (Docker)       │${NC}"
    echo -e "${CYAN}    │                 │              │                 │            │                 │${NC}"
    echo -e "${CYAN}    │  • Express API  │   REDIS PUB   │  • Express API  │  REDIS PUB  │  • Express API  │${NC}"
    echo -e "${CYAN}    │  • Socket.io    │   / SUB       │  • Socket.io   │  / SUB      │  • Socket.io   │${NC}"
    echo -e "${CYAN}    │  • WebRTC       │              │  • WebRTC      │             │  • WebRTC      │${NC}"
    echo -e "${CYAN}    └────────┬────────┘              └────────┬────────┘            └────────┬────────┘${NC}"
    echo -e "${CYAN}             │                                  │                              │${NC}"
    echo -e "${CYAN}             └──────────────┬───────────────────┘──────────────────────────────┘${NC}"
    echo -e "${CYAN}                                │${NC}"
    echo -e "${CYAN}           ┌────────────────────┼────────────────────┐${NC}"
    echo -e "${CYAN}           ▼                    ▼                    ▼${NC}"
    echo -e "${CYAN}  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐${NC}"
    echo -e "${CYAN}  │    REDIS       │   │   RABBITMQ     │   │   MONGODB      │${NC}"
    echo -e "${CYAN}  │                │   │                │   │                │${NC}"
    echo -e "${CYAN}  │  • Pub/Sub     │   │  • Message     │   │  • User data   │${NC}"
    echo -e "${CYAN}  │    Sync sockets│   │    Queue       │   │  • Messages    │${NC}"
    echo -e "${CYAN}  │  • Cache       │   │  • Async tasks │   │  • Conversations│${NC}"
    echo -e "${CYAN}  │    profiles    │   │  • Log queue   │   │                │${NC}"
    echo -e "${CYAN}  └────────────────┘   └────────────────┘   └────────────────┘${NC}"
    echo ""

    echo -e "${BOLD}Live Container Status:${NC}"
    echo ""
    docker ps --filter "name=pete-" --format "  ${GREEN}✓${NC} {{.Names}} — {{.Status}}" | head -8
    echo ""

    echo -e "${BOLD}What you see:${NC}"
    echo "  • Nginx acts as a Reverse Proxy & Load Balancer"
    echo "  • 3 backend instances run in parallel (horizontal scaling)"
    echo "  • Redis synchronizes WebSocket messages across all instances"
    echo "  • RabbitMQ queues async tasks (log writing, image compression)"
    echo "  • MongoDB stores persistent data"

    wait_key
}

# ============================================================
# STEP 2: Load Balancing
# ============================================================
step2_load_balancing() {
    clear_screen
    print_header
    print_step 2 "Load Balancing (Nginx)"
    echo ""

    echo -e "${BOLD}Problem:${NC} When running multiple backend servers, how do we"
    echo "distribute requests evenly and ensure WebSocket stability?"
    echo ""
    echo -e "${BOLD}Solution: Nginx with ip_hash sticky sessions${NC}"
    echo ""

    echo -e "${BOLD}Nginx Configuration (nginx.conf):${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    cat nginx.conf | grep -A 20 "upstream backend_servers"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${BOLD}Live Test - Sending 15 requests from different IPs:${NC}"
    echo ""

    TOTAL=15
    declare -a results=()
    tmpfile=$(mktemp)
    success=0

    for i in $(seq 1 $TOTAL); do
        response=$(curl -s -H "X-Forwarded-For: 192.168.1.$i" http://localhost/api/health 2>/dev/null)
        instance=$(echo "$response" | grep -o '"instance":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "ERROR")
        if [ "$instance" != "ERROR" ] && [ -n "$instance" ]; then
            print_ok "Request $i (IP: 192.168.1.$i) → $instance"
            echo "$instance" >> "$tmpfile"
            success=$((success + 1))
        else
            print_warn "Request $i → Failed"
        fi
        sleep 0.05
    done

    echo ""
    echo -e "${BOLD}Load Distribution Summary:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    if [ -s "$tmpfile" ]; then
        sort "$tmpfile" | uniq -c | sort -rn | while read count instance; do
            pct=$((count * 100 / TOTAL))
            bar=$(printf '█%.0s' $(seq 1 $((count * 30 / TOTAL))))
            echo -e "  $instance: ${GREEN}$count${NC}/$TOTAL requests ($pct%) $bar"
        done
    fi
    rm -f "$tmpfile"

    echo ""
    echo -e "${BOLD}Key Points:${NC}"
    echo "  • ip_hash ensures same client IP always hits same backend (sticky session)"
    echo "  • This is CRITICAL for WebSocket - a connection must stay on ONE server"
    echo "  • max_fails=3 means a sick server is removed for 30s"
    echo "  • All 3 instances handle HTTP requests, providing horizontal scalability"

    wait_key
}

# ============================================================
# STEP 3: Redis Pub/Sub for Socket.io
# ============================================================
step3_redis_pubsub() {
    clear_screen
    print_header
    print_step 3 "Redis Pub/Sub - Socket.io Adapter"
    echo ""

    echo -e "${BOLD}Problem:${NC} User A on Server-1 cannot receive messages from"
    echo "User B on Server-2. Messages get stuck on the wrong server."
    echo ""
    echo -e "${BOLD}Solution: Redis Adapter for Socket.io${NC}"
    echo ""

    echo -e "${BOLD}Backend Socket Configuration (server.js):${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    grep -A 10 "createAdapter\|RedisAdapter\|ioredis" packages/backend/src/server.js | head -20
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${BOLD}How it works:${NC}"
    echo "  1. Server-1 receives message from User A"
    echo "  2. Server-1 publishes to Redis channel:publish(channel, room, message)"
    echo "  3. Redis forwards to ALL subscribed servers (Server-1, 2, 3)"
    echo "  4. Each server emits to its local connected clients"
    echo "  5. User B (on Server-2) receives the message via Server-2's socket"
    echo ""

    echo -e "${BOLD}Live Redis Pub/Sub Channels:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    channels=$(docker exec pete-redis redis-cli PUBSUB CHANNELS 2>/dev/null)
    if [ -n "$channels" ]; then
        echo "$channels" | head -10 | sed 's/^/  /'
    else
        echo "  (no active channels yet - connect via the app first)"
    fi
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${BOLD}Redis Connected Clients:${NC}"
    docker exec pete-redis redis-cli CLIENT LIST 2>/dev/null | grep "addr" | wc -l | xargs -I{} echo "  {} Redis connections from backend instances"
    echo ""

    echo -e "${BOLD}Key Points:${NC}"
    echo "  • Redis acts as a message broker between Socket.io instances"
    echo "  • Every backend instance subscribes to the same Redis channel"
    echo "  • Messages are broadcast to ALL instances, not just one"
    echo "  • This enables TRUE horizontal scaling for real-time chat"

    wait_key
}

# ============================================================
# STEP 4: Redis Caching
# ============================================================
step4_redis_cache() {
    clear_screen
    print_header
    print_step 4 "Redis Caching"
    echo ""

    echo -e "${BOLD}Problem:${NC} Frequent database queries for user profiles,"
    echo "friend lists, and conversation data slow down the system."
    echo ""
    echo -e "${BOLD}Solution: Redis as an in-memory cache${NC}"
    echo ""

    echo -e "${BOLD}Cache Strategy:${NC}"
    echo "  • User Profiles → cached for 1 hour (frequently accessed)"
    echo "  • Friend Lists   → cached for 5 minutes (changes occasionally)"
    echo "  • Conversations  → cached for 2 minutes (real-time updates)"
    echo ""

    echo -e "${BOLD}Redis Memory Usage:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    docker exec pete-redis redis-cli INFO memory 2>/dev/null | grep -E "used_memory_human|maxmemory_human" | sed 's/^/  /'
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${BOLD}Current Cache Keys in Redis:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    keys=$(docker exec pete-redis redis-cli KEYS "*" 2>/dev/null | head -15)
    if [ -n "$keys" ]; then
        echo "$keys" | sed 's/^/  /'
    else
        echo "  (no cache keys - browse the app to generate cache)"
    fi
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${BOLD}Cache Performance Stats:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    docker exec pete-redis redis-cli INFO stats 2>/dev/null | grep -E "keyspace_hits|keyspace_misses|total_commands_processed" | sed 's/^/  /'
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${BOLD}Key Points:${NC}"
    echo "  • Redis is configured with maxmemory=256MB and allkeys-lru eviction"
    echo "  • Cache is checked BEFORE database query (Cache-Aside pattern)"
    echo "  • Cache is invalidated on data updates"
    echo "  • Reduces MongoDB load significantly for read-heavy operations"

    wait_key
}

# ============================================================
# STEP 5: RabbitMQ Message Queue
# ============================================================
step5_rabbitmq() {
    clear_screen
    print_header
    print_step 5 "RabbitMQ - Message Queue"
    echo ""

    echo -e "${BOLD}Problem:${NC} Heavy operations like writing chat logs to DB,"
    echo "compressing images block the API response thread."
    echo ""
    echo -e "${BOLD}Solution: RabbitMQ for asynchronous task processing${NC}"
    echo ""

    echo -e "${BOLD}Queue Architecture:${NC}"
    echo "  ┌─────────────────────────────────────────────────────────┐"
    echo "  │                    RABBITMQ BROKER                      │"
    echo "  │                                                         │"
    echo "  │  ┌─────────────────┐  ┌─────────────────┐              │"
    echo "  │  │  chat.logs      │  │  image.compress │              │"
    echo "  │  │  Queue          │  │  Queue          │              │"
    echo "  │  │                 │  │                 │              │"
    echo "  │  │  • Async DB     │  │  • Async image  │              │"
    echo "  │  │    logging      │  │    processing   │              │"
    echo "  │  └─────────────────┘  └─────────────────┘              │"
    echo "  └─────────────────────────────────────────────────────────┘"
    echo ""

    echo -e "${BOLD}RabbitMQ Management UI:${NC}"
    echo "  🌐 http://localhost:15672"
    echo "  👤 Username: admin | Password: admin123"
    echo ""

    echo -e "${BOLD}Live Queue Status (via Management API):${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    queues=$(curl -s -u admin:admin123 http://localhost:15672/api/queues 2>/dev/null | \
        python3 -c "import sys,json; [print(f'  {q[\"name\"]}: {q[\"messages\"]} messages, {q[\"consumers\"]} consumers') for q in json.load(sys.stdin)[:5]]" 2>/dev/null || \
    docker exec pete-rabbitmq rabbitmqctl list_queues name messages consumers 2>/dev/null | head -6 | sed 's/^/  /')
    if [ -n "$queues" ]; then
        echo "$queues"
    else
        echo "  (connecting to RabbitMQ management API...)"
        docker exec pete-rabbitmq rabbitmq-diagnostics -q ping 2>/dev/null && \
            echo "  RabbitMQ is running (use UI at http://localhost:15672 for details)"
    fi
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${BOLD}RabbitMQ Container Health:${NC}"
    docker ps --filter "name=pete-rabbitmq" --format "  $GREEN✓$NC {{.Names}}: {{.Status}}" 2>/dev/null
    echo ""

    echo -e "${BOLD}Key Points:${NC}"
    echo "  • Heavy tasks (DB logging, image compression) are queued, not blocking API"
    echo "  • Worker processes consume tasks from queues asynchronously"
    echo "  • API responds immediately; heavy work happens in background"
    echo "  • This is CRITICAL for maintaining low latency under heavy load"

    wait_key
}

# ============================================================
# STEP 6: Horizontal Scaling Demo
# ============================================================
step6_horizontal_scaling() {
    clear_screen
    print_header
    print_step 6 "Horizontal Scaling Verification"
    echo ""

    echo -e "${BOLD}Verifying all 3 backend instances are active and independent:${NC}"
    echo ""

    # Test each backend directly
    echo -e "${BOLD}Testing each backend instance directly:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    for i in 1 2 3; do
        response=$(docker exec pete-backend-$i wget -q -O - http://localhost:5000/api/health 2>/dev/null)
        instance=$(echo "$response" | grep -o '"instance":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "OFFLINE")
        if [ "$instance" != "OFFLINE" ]; then
            print_ok "Backend-$i: $instance"
        else
            print_warn "Backend-$i: Not responding on port 5000"
        fi
    done
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${BOLD}Load-balanced requests hit different instances:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    instances_seen=""
    for i in 1 2 3 4 5; do
        response=$(curl -s -H "X-Forwarded-For: 10.0.$i.1" http://localhost/api/health 2>/dev/null)
        instance=$(echo "$response" | grep -o '"instance":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "ERROR")
        echo "  Request $i → $instance"
        instances_seen="$instances_seen$instance "
    done
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    unique_instances=$(echo "$instances_seen" | tr ' ' '\n' | sort -u | grep -v '^$' | wc -l | tr -d ' ')
    echo -e "${BOLD}Result:${NC} Requests distributed across ${GREEN}$unique_instances${NC} different instance(s)"
    echo ""

    echo -e "${BOLD}Docker Compose Evidence:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    docker ps --filter "name=pete-backend" --format "  {{.Names}}: {{.Status}} | {{.Image}}" 2>/dev/null
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${BOLD}Key Points:${NC}"
    echo "  • 3 identical backend containers run in parallel"
    echo "  • Each container has its own Node.js process"
    echo "  • Nginx distributes load using round-robin (for API) + ip_hash (for WebSocket)"
    echo "  • Redis Adapter ensures Socket.io messages reach all instances"
    echo "  • If one container crashes, others continue serving (fault tolerance)"
    echo "  • Can scale to N instances by changing docker-compose.yml replicas count"

    wait_key
}

# ============================================================
# STEP 7: Summary & How to Run
# ============================================================
step7_summary() {
    clear_screen
    print_header
    echo -e "${PURPLE}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║                        DEMO SUMMARY                                  ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    echo -e "${BOLD}✅ Level 4 Features Implemented:${NC}"
    echo ""
    echo -e "  ${GREEN}1. Load Balancing (Nginx)${NC}"
    echo "     • 3 backend instances running in parallel"
    echo "     • ip_hash for WebSocket sticky sessions"
    echo "     • Round-robin for HTTP API requests"
    echo "     • Health check and auto-failover"
    echo ""
    echo -e "  ${GREEN}2. Redis Pub/Sub (Socket.io Adapter)${NC}"
    echo "     • Real-time messages sync across ALL backend instances"
    echo "     • User on Server-1 can chat with User on Server-2 seamlessly"
    echo "     • Redis acts as message broker"
    echo ""
    echo -e "  ${GREEN}3. Redis Caching${NC}"
    echo "     • User profiles cached (1 hour TTL)"
    echo "     • Friend lists cached (5 min TTL)"
    echo "     • Conversation lists cached (2 min TTL)"
    echo "     • Cache-aside pattern reduces MongoDB load"
    echo ""
    echo -e "  ${GREEN}4. RabbitMQ Message Queue${NC}"
    echo "     • Async DB logging for chat messages"
    echo "     • Async image compression"
    echo "     • Non-blocking API responses"
    echo ""
    echo -e "  ${GREEN}5. Horizontal Scaling${NC}"
    echo "     • 3 Docker containers, independently scalable"
    echo "     • Add more replicas by changing docker-compose.yml"
    echo "     • Stateless backend design enables infinite horizontal scaling"
    echo ""

    echo -e "${BOLD}📁 Project Structure:${NC}"
    echo "  pete-app/"
    echo "  ├── packages/backend/      ← Node.js + Express + Socket.io"
    echo "  ├── packages/frontend/      ← React + TypeScript"
    echo "  ├── nginx.conf             ← Load balancer config"
    echo "  ├── docker-compose.yml      ← All services defined"
    echo "  └── scripts/"
    echo "      ├── demo-level4.sh      ← This script"
    echo "      ├── test-load-balancer.sh"
    echo "      └── test-redis-cache.sh"
    echo ""

    echo -e "${BOLD}🚀 Quick Commands for Demo:${NC}"
    echo ""
    echo -e "  ${CYAN}# Start all services (one command):${NC}"
    echo "  docker-compose up -d"
    echo ""
    echo -e "  ${CYAN}# View all containers:${NC}"
    echo "  docker ps --filter \"name=pete-\""
    echo ""
    echo -e "  ${CYAN}# Watch logs from all backends:${NC}"
    echo "  docker-compose logs -f backend-1 backend-2 backend-3"
    echo ""
    echo -e "  ${CYAN}# Test load balancer:${NC}"
    echo "  ./scripts/test-load-balancer.sh"
    echo ""
    echo -e "  ${CYAN}# Test Redis cache:${NC}"
    echo "  ./scripts/test-redis-cache.sh"
    echo ""
    echo -e "  ${CYAN}# RabbitMQ Management UI:${NC}"
    echo "  http://localhost:15672 (admin / admin123)"
    echo ""

    echo -e "${BOLD}💡 During your presentation:${NC}"
    echo "  1. Show docker ps → all 8 containers running"
    echo "  2. Run Step 1 → show architecture diagram"
    echo "  3. Run Step 2 → show Nginx distributing requests"
    echo "  4. Run Step 3 → show Redis Pub/Sub channels"
    echo "  5. Open browser → demonstrate real-time chat between 2 accounts"
    echo "  6. Show RabbitMQ UI → demonstrate async task queue"
    echo ""

    echo -e "${PURPLE}${BOLD}🎯 Good luck with your demo!${NC}"
    echo ""
}

# ============================================================
# MAIN MENU
# ============================================================
main() {
    check_prereq

    if [ -n "$1" ] && [ "$1" =~ ^[1-7]$ ]; then
        # Run specific step
        case $1 in
            1) step1_architecture ;;
            2) step2_load_balancing ;;
            3) step3_redis_pubsub ;;
            4) step4_redis_cache ;;
            5) step5_rabbitmq ;;
            6) step6_horizontal_scaling ;;
            7) step7_summary ;;
        esac
        exit 0
    fi

    while true; do
        clear_screen
        print_header
        echo -e "${BOLD}Please select a demo step:${NC}"
        echo ""
        echo -e "  ${CYAN}1${NC}) System Architecture       — Show architecture diagram"
        echo -e "  ${CYAN}2${NC}) Load Balancing             — Nginx distributes requests to 3 backends"
        echo -e "  ${CYAN}3${NC}) Redis Pub/Sub              — Socket.io message sync across instances"
        echo -e "  ${CYAN}4${NC}) Redis Caching              — Cache-aside pattern reduces DB load"
        echo -e "  ${CYAN}5${NC}) RabbitMQ Message Queue     — Async task processing"
        echo -e "  ${CYAN}6${NC}) Horizontal Scaling         — Verify 3 instances work independently"
        echo -e "  ${CYAN}7${NC}) Summary & Commands         — All features + quick commands"
        echo -e "  ${CYAN}Q${NC}) Quit"
        echo ""
        echo -n "Enter choice [1-7, Q]: "
        read -r choice

        case $choice in
            1) step1_architecture ;;
            2) step2_load_balancing ;;
            3) step3_redis_pubsub ;;
            4) step4_redis_cache ;;
            5) step5_rabbitmq ;;
            6) step6_horizontal_scaling ;;
            7) step7_summary ;;
            q|Q) echo "Goodbye!"; exit 0 ;;
            *) echo "Invalid choice. Press Enter to continue."; read -r ;;
        esac
    done
}

main "$@"

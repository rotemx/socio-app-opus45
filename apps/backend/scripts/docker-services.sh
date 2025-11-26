#!/bin/bash

# Docker Services Script for Socio Backend
# Manages PostgreSQL/PostGIS and Redis containers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Container names
POSTGRES_CONTAINER="socio-postgres"
REDIS_CONTAINER="socio-redis"

# Configuration
POSTGRES_IMAGE="postgis/postgis:16-3.4"
REDIS_IMAGE="redis:7"
POSTGRES_PORT=5432
REDIS_PORT=6379
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="password"
POSTGRES_DB="socio_dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        log_info "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker Desktop or the Docker daemon."
        exit 1
    fi

    log_info "Docker is running"
}

# Pull image if not exists
pull_image_if_needed() {
    local image=$1
    if ! docker image inspect "$image" &> /dev/null; then
        log_info "Pulling image: $image"
        docker pull "$image"
    else
        log_info "Image exists: $image"
    fi
}

# Check if container is running
is_container_running() {
    local container=$1
    docker ps --format '{{.Names}}' | grep -q "^${container}$"
}

# Check if container exists (running or stopped)
container_exists() {
    local container=$1
    docker ps -a --format '{{.Names}}' | grep -q "^${container}$"
}

# Start PostgreSQL container
start_postgres() {
    if is_container_running "$POSTGRES_CONTAINER"; then
        log_info "PostgreSQL is already running"
        return 0
    fi

    pull_image_if_needed "$POSTGRES_IMAGE"

    if container_exists "$POSTGRES_CONTAINER"; then
        log_info "Starting existing PostgreSQL container..."
        docker start "$POSTGRES_CONTAINER"
    else
        log_info "Creating and starting PostgreSQL container..."
        docker run -d \
            --name "$POSTGRES_CONTAINER" \
            -e POSTGRES_USER="$POSTGRES_USER" \
            -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
            -e POSTGRES_DB="$POSTGRES_DB" \
            -p "$POSTGRES_PORT:5432" \
            -v socio_postgres_data:/var/lib/postgresql/data \
            "$POSTGRES_IMAGE"
    fi

    log_info "Waiting for PostgreSQL to be ready..."
    wait_for_postgres
    log_info "PostgreSQL is ready on port $POSTGRES_PORT"
}

# Start Redis container
start_redis() {
    if is_container_running "$REDIS_CONTAINER"; then
        log_info "Redis is already running"
        return 0
    fi

    pull_image_if_needed "$REDIS_IMAGE"

    if container_exists "$REDIS_CONTAINER"; then
        log_info "Starting existing Redis container..."
        docker start "$REDIS_CONTAINER"
    else
        log_info "Creating and starting Redis container..."
        docker run -d \
            --name "$REDIS_CONTAINER" \
            -p "$REDIS_PORT:6379" \
            -v socio_redis_data:/data \
            "$REDIS_IMAGE"
    fi

    log_info "Waiting for Redis to be ready..."
    wait_for_redis
    log_info "Redis is ready on port $REDIS_PORT"
}

# Wait for PostgreSQL to accept connections
wait_for_postgres() {
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker exec "$POSTGRES_CONTAINER" pg_isready -U "$POSTGRES_USER" &> /dev/null; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    log_error "PostgreSQL failed to start within ${max_attempts} seconds"
    exit 1
}

# Wait for Redis to accept connections
wait_for_redis() {
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker exec "$REDIS_CONTAINER" redis-cli ping &> /dev/null; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    log_error "Redis failed to start within ${max_attempts} seconds"
    exit 1
}

# Stop services
stop_services() {
    log_info "Stopping services..."

    if is_container_running "$POSTGRES_CONTAINER"; then
        docker stop "$POSTGRES_CONTAINER"
        log_info "PostgreSQL stopped"
    fi

    if is_container_running "$REDIS_CONTAINER"; then
        docker stop "$REDIS_CONTAINER"
        log_info "Redis stopped"
    fi
}

# Remove containers and volumes
clean_services() {
    log_warn "This will remove all containers and data volumes!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        stop_services

        if container_exists "$POSTGRES_CONTAINER"; then
            docker rm "$POSTGRES_CONTAINER"
            log_info "PostgreSQL container removed"
        fi

        if container_exists "$REDIS_CONTAINER"; then
            docker rm "$REDIS_CONTAINER"
            log_info "Redis container removed"
        fi

        docker volume rm socio_postgres_data socio_redis_data 2>/dev/null || true
        log_info "Data volumes removed"
    fi
}

# Show status
show_status() {
    echo ""
    echo "=== Docker Services Status ==="
    echo ""

    if is_container_running "$POSTGRES_CONTAINER"; then
        echo -e "PostgreSQL: ${GREEN}Running${NC} on port $POSTGRES_PORT"
        echo "  Connection: postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$POSTGRES_PORT/$POSTGRES_DB"
    elif container_exists "$POSTGRES_CONTAINER"; then
        echo -e "PostgreSQL: ${YELLOW}Stopped${NC}"
    else
        echo -e "PostgreSQL: ${RED}Not created${NC}"
    fi

    echo ""

    if is_container_running "$REDIS_CONTAINER"; then
        echo -e "Redis: ${GREEN}Running${NC} on port $REDIS_PORT"
        echo "  Connection: redis://localhost:$REDIS_PORT"
    elif container_exists "$REDIS_CONTAINER"; then
        echo -e "Redis: ${YELLOW}Stopped${NC}"
    else
        echo -e "Redis: ${RED}Not created${NC}"
    fi

    echo ""
}

# Print usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start   Start PostgreSQL and Redis containers (default)"
    echo "  stop    Stop running containers"
    echo "  status  Show container status"
    echo "  clean   Remove containers and volumes"
    echo "  help    Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$POSTGRES_PORT/$POSTGRES_DB"
    echo "  REDIS_URL=redis://localhost:$REDIS_PORT"
}

# Main
main() {
    local command=${1:-start}

    case $command in
        start)
            check_docker
            start_postgres
            start_redis
            show_status
            ;;
        stop)
            stop_services
            ;;
        status)
            show_status
            ;;
        clean)
            clean_services
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            log_error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

main "$@"
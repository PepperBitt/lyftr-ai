COMPOSE ?= $(shell which docker-compose 2>/dev/null || echo "docker compose")

.PHONY: up down restart build test test-backend test-frontend logs status clean

# Start the complete full-stack application (Backend: 8000, Frontend: 3000)
up:
	$(COMPOSE) up -d --build

# Stop the running application without deleting persistent database volume
down:
	$(COMPOSE) down

# Restart the application
restart:
	$(COMPOSE) restart

# Build the containers
build:
	$(COMPOSE) build

# Follow logs from all services
logs:
	$(COMPOSE) logs -f

# Check container status
status:
	$(COMPOSE) ps

# Run both backend and frontend test suites
test: test-backend test-frontend

# Run backend automated pytest suite
test-backend:
	cd backend && python3 -m pytest tests/ -v

# Run frontend vitest test suite
test-frontend:
	cd frontend && npm test

# Stop and remove volumes (clean slate)
clean:
	$(COMPOSE) down -v

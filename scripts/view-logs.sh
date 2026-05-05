#!/bin/bash

# View Logs - Xem logs của các services

echo "📋 Docker Compose Logs Viewer"
echo "================================"
echo ""
echo "Available options:"
echo "  1. All services"
echo "  2. All backends (backend-1, backend-2, backend-3)"
echo "  3. Backend-1 only"
echo "  4. Backend-2 only"
echo "  5. Backend-3 only"
echo "  6. Nginx"
echo "  7. Redis"
echo "  8. RabbitMQ"
echo "  9. Frontend"
echo ""
read -p "Select option (1-9): " option

case $option in
    1)
        echo "Showing logs for all services..."
        docker-compose logs -f
        ;;
    2)
        echo "Showing logs for all backends..."
        docker-compose logs -f backend-1 backend-2 backend-3
        ;;
    3)
        echo "Showing logs for backend-1..."
        docker-compose logs -f backend-1
        ;;
    4)
        echo "Showing logs for backend-2..."
        docker-compose logs -f backend-2
        ;;
    5)
        echo "Showing logs for backend-3..."
        docker-compose logs -f backend-3
        ;;
    6)
        echo "Showing logs for nginx..."
        docker-compose logs -f nginx
        ;;
    7)
        echo "Showing logs for redis..."
        docker-compose logs -f redis
        ;;
    8)
        echo "Showing logs for rabbitmq..."
        docker-compose logs -f rabbitmq
        ;;
    9)
        echo "Showing logs for frontend..."
        docker-compose logs -f frontend
        ;;
    *)
        echo "Invalid option!"
        exit 1
        ;;
esac

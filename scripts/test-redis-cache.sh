#!/bin/bash

# Test Redis Cache - Kiểm tra cache HIT/MISS

echo "🧪 Testing Redis Cache..."
echo "================================"
echo ""

# Kiểm tra Redis đã chạy chưa
if ! docker exec pete-redis redis-cli ping > /dev/null 2>&1; then
    echo "❌ Error: Redis is not running!"
    echo "Please run: docker-compose up -d"
    exit 1
fi

echo "✅ Redis is running"
echo ""
echo "📊 Checking cache keys in Redis..."
echo ""

# Xem tất cả cache keys
echo "Current cache keys:"
keys=$(docker exec pete-redis redis-cli KEYS "*" 2>/dev/null)
if [ -z "$keys" ]; then
    echo "   (no keys yet - cache is empty)"
else
    echo "$keys" | head -20
fi

echo ""
echo "================================"
echo "📈 Cache Statistics:"
echo "================================"

# Lấy Redis info
docker exec pete-redis redis-cli INFO stats 2>/dev/null | grep -E "keyspace_hits|keyspace_misses|total_commands_processed"

echo ""
echo "================================"
echo "📋 All Backend Connections to Redis:"
echo "================================"
docker exec pete-redis redis-cli INFO clients 2>/dev/null | grep "connected_clients"

echo ""
echo "✅ Redis cache test completed!"
echo ""
echo "💡 To see cache in action:"
echo "   1. Open http://localhost (frontend)"
echo "   2. Login and navigate the app"
echo "   3. Check logs: docker-compose logs pete-backend-1 | grep -i cache"
echo "   4. First call = Cache MISS (query DB)"
echo "   5. Second call = Cache HIT (from Redis)"
echo ""
echo "💡 RabbitMQ Management UI available at: http://localhost:15672"
echo "   Username: admin | Password: admin123"

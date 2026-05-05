#!/bin/bash

# Test RabbitMQ - Kiểm tra message queues

echo "🧪 Testing RabbitMQ..."
echo "================================"
echo ""

# Kiểm tra RabbitMQ đã chạy chưa
if ! curl -s -u admin:admin123 http://localhost:15672/api/overview > /dev/null; then
    echo "❌ Error: RabbitMQ is not running!"
    echo "Please run: docker-compose up -d"
    exit 1
fi

echo "📊 Checking RabbitMQ queues..."
echo ""

# Lấy danh sách queues
queues=$(curl -s -u admin:admin123 http://localhost:15672/api/queues | jq -r '.[] | "\(.name): \(.messages) messages"')

if [ -n "$queues" ]; then
    echo "$queues"
else
    echo "No queues found or jq not installed"
    echo "Install jq: brew install jq (macOS) or apt install jq (Linux)"
fi

echo ""
echo "================================"
echo "📈 Queue Details:"
echo "================================"

# Chi tiết từng queue
for queue in email_notifications image_processing message_logging user_activity; do
    echo ""
    echo "Queue: $queue"
    curl -s -u admin:admin123 "http://localhost:15672/api/queues/%2F/$queue" | jq -r 'if . then "  Messages: \(.messages)\n  Consumers: \(.consumers)\n  State: \(.state)" else "  Not found" end'
done

echo ""
echo "================================"
echo "💡 RabbitMQ Management UI:"
echo "   URL: http://localhost:15672"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "✅ RabbitMQ test completed!"

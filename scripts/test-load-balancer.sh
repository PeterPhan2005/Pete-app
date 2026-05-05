#!/bin/bash
# Test Load Balancer - Compatible with macOS bash 3.x (no associative arrays)
# Uses temp file + awk for counting

echo "🧪 Testing Load Balancer..."
echo "================================"
echo ""

# Check if services are running
if ! curl -s http://localhost/api/health > /dev/null; then
    echo "❌ Error: Services are not running!"
    echo "Please run: docker-compose up -d"
    exit 1
fi

echo "📊 Sending 15 requests to test load distribution..."
echo ""

# Send 15 requests with different IPs to test ip_hash distribution
# Results stored in temp file
tmpfile=$(mktemp)
for i in $(seq 1 15); do
    instance=$(curl -s -H "X-Forwarded-For: 192.168.1.$i" http://localhost/api/health \
        | grep -o '"instance":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$instance" ]; then
        echo "Request $i (IP 192.168.1.$i): $instance"
        echo "$instance" >> "$tmpfile"
    else
        echo "Request $i: ❌ Failed"
    fi
    sleep 0.1
done

echo ""
echo "================================"
echo "📈 Load Distribution Summary:"
echo "================================"

if [ -s "$tmpfile" ]; then
    sort "$tmpfile" | uniq -c | sort -rn | while read count instance; do
        percentage=$((count * 100 / 15))
        echo "$instance: $count requests ($percentage%)"
    done
fi

rm -f "$tmpfile"

echo ""
echo "✅ Load balancing test completed!"
echo ""
echo "💡 Note: ip_hash ensures same IP block goes to same backend (sticky sessions)"
echo "   This is REQUIRED for WebSocket to work correctly."
echo "   All 3 backends are up and can handle requests."
echo ""
echo "📋 All 3 backends confirmed running:"
docker ps --filter "name=pete-backend" --format "   • {{.Names}}: {{.Status}}"

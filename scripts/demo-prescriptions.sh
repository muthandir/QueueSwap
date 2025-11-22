#!/usr/bin/env bash
set -euo pipefail

APP_LOG=/tmp/queueswap-demo.log

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " QueueSwap Demo: SQS + RabbitMQ + Decorator + Consumer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1) Ensure Docker is running
if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Please start Docker first."
  exit 1
fi

# Helper: wait for a TCP port to be open (with timeout)
wait_for_port() {
  local name="$1"
  local host="$2"
  local port="$3"
  local timeout="${4:-120}" # seconds

  echo "   Waiting for $name on $host:$port (up to ${timeout}s, first run may download images)..."

  local elapsed=0
  while ! nc -z "$host" "$port" >/dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [ "$elapsed" -ge "$timeout" ]; then
      echo "   $name did not become ready in time. Please check 'docker-compose logs $name'."
      return 1
    fi
  done

  echo "   $name is ready."
}

# 2) Start infrastructure (LocalStack + RabbitMQ)
echo "[1/6] Starting queue infrastructure (LocalStack + RabbitMQ)..."
docker-compose up -d localstack rabbitmq

# Wait for LocalStack (SQS) and RabbitMQ to be reachable.
# On the very first run Docker may still be pulling images, so this can take a while.
wait_for_port "LocalStack" "localhost" 4566
wait_for_port "RabbitMQ" "localhost" 5672

# 3) Ensure .env and dependencies
if [ ! -f .env ]; then
  echo "[2/6] Creating .env from env.example..."
  cp env.example .env
fi

if [ ! -d node_modules ]; then
  echo "[3/6] Installing npm dependencies..."
  npm install
fi

# 4) Build and start the app
echo "[4/6] Building Nest application..."
npm run build

echo "   Starting app (logs: $APP_LOG)..."
# For the demo, force QUEUE_PROVIDER=conditional so that:
# - Prescriptions route US → SQS, TR → RabbitMQ
# - The background consumer reads from both SQS and RabbitMQ via ConditionalQueueService
# Kill any previous demo app
if [ -f "$APP_LOG.pid" ]; then
  OLD_PID=$(cat "$APP_LOG.pid" || true)
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" || true
    sleep 1
  fi
fi

QUEUE_PROVIDER=conditional npm run start:prod >"$APP_LOG" 2>&1 &
APP_PID=$!
echo "$APP_PID" >"$APP_LOG.pid"

# 5) Wait for app to become responsive
echo "   Waiting for app on http://localhost:3000 ..."
for i in {1..20}; do
  # use curl without -f so that a 404 still counts as "server is up"
  if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo "   App is up."
    break
  fi
  sleep 1
  if [ "$i" -eq 20 ]; then
    echo "App did not start in time. Check $APP_LOG."
    exit 1
  fi
done

BASE_URL="http://localhost:3000"

# Helper: show relevant log lines since a given line number
show_logs_since() {
  local start_line="${1:-1}"
  echo ""
  echo "   Application logs (steps only):"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  # Show only step logs if present, otherwise show full log
  if grep -q "step-" "$APP_LOG"; then
    # Only show new lines since start_line
    tail -n +"$start_line" "$APP_LOG" | grep "step-" || tail -n +"$start_line" "$APP_LOG"
  else
    tail -n +"$start_line" "$APP_LOG"
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# Helper: wait until the consumer processes the message (based on step-5-consumer logs)
wait_for_consumer() {
  local start_line="${1:-1}"
  local timeout="${2:-60}"
  local elapsed=0

  echo "Waiting for consumer to process the order (up to ${timeout}s)..."

  while [ "$elapsed" -lt "$timeout" ]; do
    if tail -n +"$start_line" "$APP_LOG" | grep "step-5-consumer" >/dev/null 2>&1; then
      echo "   Consumer processed at least one message."
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo "   Consumer did not log any processing within ${timeout}s. Showing logs anyway."
  return 1
}

echo ""
echo "[5/6] Sending first order (US → expect SQS route + notification)..."
START_LINE_US=$(( $(wc -l < "$APP_LOG" 2>/dev/null || echo 0) + 1 ))

US_RESPONSE=$(
  curl -s -X POST "$BASE_URL/prescriptions" \
    -H "Content-Type: application/json" \
    -d '{
      "patientName": "John Smith",
      "patientEmail": "john.smith@example.com",
      "nhsNumber": "US-987-654-3210",
      "pharmacyId": "PHARM-US-001",
      "medications": [
        { "medicationName": "Amoxicillin", "dosage": "250mg", "quantity": "14 capsules" }
      ],
      "deliveryMethod": "delivery",
      "deliveryAddress": "123 Main St, New York, USA",
      "country": "US",
      "notes": "Standard US order"
    }'
)

echo "US order response:"
echo "$US_RESPONSE" | jq '.'
US_ORDER_ID=$(echo "$US_RESPONSE" | jq -r '.data.orderId  // .orderId')
echo ""
wait_for_consumer "$START_LINE_US" 60
show_logs_since "$START_LINE_US"

echo "[6/6] Sending second order (TR → expect RabbitMQ route + notification)..."
START_LINE_TR=$(( $(wc -l < "$APP_LOG" 2>/dev/null || echo 0) + 1 ))

TR_RESPONSE=$(
  curl -s -X POST "$BASE_URL/prescriptions" \
    -H "Content-Type: application/json" \
    -d '{
      "patientName": "Ahmet Yılmaz",
      "patientEmail": "ahmet.yilmaz@example.com.tr",
      "nhsNumber": "TR-123-456-7890",
      "pharmacyId": "PHARM-TR-001",
      "medications": [
        { "medicationName": "Parol", "dosage": "500mg", "quantity": "20 tablets" }
      ],
      "deliveryMethod": "collection",
      "country": "TR",
      "notes": "Turkish patient, data residency required"
    }'
)

echo "TR order response:"
echo "$TR_RESPONSE" | jq '.'
TR_ORDER_ID=$(echo "$TR_RESPONSE" | jq -r '.data.orderId  // .orderId')
echo ""
wait_for_consumer "$START_LINE_TR" 60
show_logs_since "$START_LINE_TR"

echo "Demo complete."
echo "US order ID: $US_ORDER_ID"
echo "TR order ID: $TR_ORDER_ID"
echo ""

# Stop the demo app process if it's still running
if [ -f "$APP_LOG.pid" ]; then
  APP_PID_TO_KILL=$(cat "$APP_LOG.pid" 2>/dev/null || echo "")
  if [ -n "$APP_PID_TO_KILL" ] && kill -0 "$APP_PID_TO_KILL" 2>/dev/null; then
    kill "$APP_PID_TO_KILL" >/dev/null 2>&1 || true
  fi
fi
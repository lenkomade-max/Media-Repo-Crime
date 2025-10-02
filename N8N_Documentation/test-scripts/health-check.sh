#!/bin/bash

# 🔍 N8N Health Check Script
echo "🔍 Проверка здоровья N8N системы..."

SERVER="178.156.142.35"
ERRORS=0

# Функция для логирования
log_result() {
    local service=$1
    local status=$2
    local message=$3
    
    if [ "$status" = "success" ]; then
        echo "✅ $service: $message"
    else
        echo "❌ $service: $message"
        ((ERRORS++))
    fi
}

# 1. Проверка N8N доступности
echo "1️⃣ Проверка N8N..."
if curl -s --max-time 10 https://mayersn8n.duckdns.org/healthz | grep -q "ok"; then
    log_result "N8N" "success" "Доступен через HTTPS"
elif curl -s --max-time 10 http://$SERVER:5678 | grep -q "n8n"; then
    log_result "N8N" "success" "Доступен через HTTP"
else
    log_result "N8N" "error" "Недоступен"
fi

# 2. Проверка MCP сервера
echo "2️⃣ Проверка MCP сервера..."
MCP_RESPONSE=$(ssh root@$SERVER "curl -s --max-time 5 http://localhost:4123/api/ping" 2>/dev/null)
if echo "$MCP_RESPONSE" | grep -q "ok"; then
    log_result "MCP" "success" "Работает корректно"
else
    log_result "MCP" "error" "Не отвечает или недоступен"
fi

# 3. Проверка PostgreSQL
echo "3️⃣ Проверка PostgreSQL..."
if ssh root@$SERVER "docker exec root-db-1 pg_isready -U n8n" 2>/dev/null | grep -q "accepting"; then
    log_result "PostgreSQL" "success" "Принимает соединения"
else
    log_result "PostgreSQL" "error" "Недоступен"
fi

# 4. Проверка Docker контейнеров
echo "4️⃣ Проверка Docker контейнеров..."
N8N_STATUS=$(ssh root@$SERVER "docker ps | grep n8n" | wc -l)
if [ $N8N_STATUS -gt 0 ]; then
    log_result "N8N Container" "success" "Запущен"
else
    log_result "N8N Container" "error" "Не запущен"
fi

DB_STATUS=$(ssh root@$SERVER "docker ps | grep postgres" | wc -l)
if [ $DB_STATUS -gt 0 ]; then
    log_result "DB Container" "success" "Запущен"
else
    log_result "DB Container" "error" "Не запущен"
fi

# 5. Проверка дискового пространства
echo "5️⃣ Проверка ресурсов..."
DISK_USAGE=$(ssh root@$SERVER "df -h / | tail -1 | awk '{print \$5}' | sed 's/%//'" 2>/dev/null)
if [ -n "$DISK_USAGE" ] && [ $DISK_USAGE -lt 90 ]; then
    log_result "Disk Space" "success" "Использовано ${DISK_USAGE}%"
else
    log_result "Disk Space" "error" "Критически мало места (${DISK_USAGE}%)"
fi

# 6. Проверка активных workflows
echo "6️⃣ Проверка workflows..."
ACTIVE_WORKFLOWS=$(ssh root@$SERVER "docker exec root-db-1 psql -U n8n -d n8n -t -c \"SELECT COUNT(*) FROM workflow_entity WHERE active = true;\"" 2>/dev/null | tr -d ' ')
if [ -n "$ACTIVE_WORKFLOWS" ] && [ $ACTIVE_WORKFLOWS -gt 0 ]; then
    log_result "Workflows" "success" "$ACTIVE_WORKFLOWS активных workflows"
else
    log_result "Workflows" "error" "Нет активных workflows"
fi

# 7. Проверка credentials
echo "7️⃣ Проверка credentials..."
CREDENTIALS_COUNT=$(ssh root@$SERVER "docker exec root-db-1 psql -U n8n -d n8n -t -c \"SELECT COUNT(*) FROM credentials_entity;\"" 2>/dev/null | tr -d ' ')
if [ -n "$CREDENTIALS_COUNT" ] && [ $CREDENTIALS_COUNT -gt 0 ]; then
    log_result "Credentials" "success" "$CREDENTIALS_COUNT credentials настроено"
else
    log_result "Credentials" "error" "Нет настроенных credentials"
fi

# Итоговый результат
echo ""
echo "📊 Результат проверки:"
if [ $ERRORS -eq 0 ]; then
    echo "🎉 ВСЕ СИСТЕМЫ РАБОТАЮТ КОРРЕКТНО!"
    echo "✅ N8N система полностью функциональна"
    exit 0
else
    echo "⚠️  ОБНАРУЖЕНО $ERRORS ПРОБЛЕМ"
    echo "🔧 Требуется вмешательство администратора"
    exit 1
fi



#!/bin/bash

# Скрипт для проверки статуса всех сервисов
echo "🔍 Проверка статуса сервисов на 178.156.142.35..."

SERVER="178.156.142.35"

echo ""
echo "📊 Проверка MCP сервера (порт 4123)..."
if ssh root@$SERVER "curl -s http://localhost:4123/api/ping" | grep -q "ok"; then
    echo "✅ MCP сервер работает"
    ssh root@$SERVER "curl -s http://localhost:4123/api/ping" | jq .
else
    echo "❌ MCP сервер не отвечает"
fi

echo ""
echo "📊 Проверка N8N (контейнер)..."
N8N_STATUS=$(ssh root@$SERVER "docker ps | grep n8n" | wc -l)
if [ $N8N_STATUS -gt 0 ]; then
    echo "✅ N8N контейнер запущен"
    ssh root@$SERVER "docker ps | grep n8n"
else
    echo "❌ N8N контейнер не запущен"
    echo "🔄 Попытка запуска..."
    ssh root@$SERVER "docker compose up -d n8n"
fi

echo ""
echo "📊 Проверка PostgreSQL..."
PG_STATUS=$(ssh root@$SERVER "docker ps | grep postgres" | wc -l)
if [ $PG_STATUS -gt 0 ]; then
    echo "✅ PostgreSQL работает"
else
    echo "❌ PostgreSQL не запущен"
fi

echo ""
echo "📊 Проверка портов..."
ssh root@$SERVER "netstat -tlnp | grep -E ':(4123|5678|5432)' | grep LISTEN"

echo ""
echo "📊 Проверка дискового пространства..."
ssh root@$SERVER "df -h | grep -E '(Filesystem|/dev/)'| head -2"

echo ""
echo "📊 Проверка памяти..."
ssh root@$SERVER "free -h"

echo ""
echo "🎬 Готово! Все сервисы проверены."



#!/bin/bash

echo "🔍 Поиск нового OpenRouter credential ID..."

# Получаем новый OpenRouter credential ID
NEW_OPENROUTER_ID=$(ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -t -c \"SELECT id FROM credentials_entity WHERE type = 'openRouterApi' ORDER BY id DESC LIMIT 1;\"" | tr -d ' ')

echo "📋 Найден OpenRouter credential ID: $NEW_OPENROUTER_ID"

if [ -z "$NEW_OPENROUTER_ID" ]; then
    echo "❌ OpenRouter credential не найден! Добавьте его в N8N UI сначала."
    exit 1
fi

echo "🔧 Обновляю workflow с новым credential ID..."

# Заменяем placeholder на реальный ID
sed "s/NEW_OPENROUTER_ID/$NEW_OPENROUTER_ID/g" /Users/user/media-video-maker/universal-ai-agent-workflow.json > /Users/user/media-video-maker/final-ai-agent-workflow.json

echo "📤 Загружаю обновленный workflow..."

# Загружаем на сервер
scp /Users/user/media-video-maker/final-ai-agent-workflow.json root@178.156.142.35:/tmp/final_ai_agent_workflow.json

# Импортируем в N8N
ssh root@178.156.142.35 "
docker cp /tmp/final_ai_agent_workflow.json root-n8n-1:/tmp/final_ai_agent_workflow.json && 
docker exec root-db-1 psql -U n8n -d n8n -c \"DELETE FROM workflow_entity WHERE name LIKE '%Универсальная%' OR name LIKE '%AI Agent%';\" && 
docker exec root-n8n-1 n8n import:workflow --input=/tmp/final_ai_agent_workflow.json && 
docker exec root-db-1 psql -U n8n -d n8n -c \"UPDATE workflow_entity SET active = true WHERE name = '🎬 Универсальная AI Agent Автоматизация Видео';\"
"

echo "✅ Workflow обновлен с новым OpenRouter credential ID: $NEW_OPENROUTER_ID"
echo "🎬 Workflow готов к использованию!"

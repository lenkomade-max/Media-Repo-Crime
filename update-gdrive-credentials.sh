#!/bin/bash

echo "🔍 Поиск нового Google Drive credential ID..."

# Получаем новый Google Drive credential ID
NEW_GDRIVE_ID=$(ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -t -c \"SELECT id FROM credentials_entity WHERE type = 'googleDriveOAuth2Api' ORDER BY id DESC LIMIT 1;\"" | tr -d ' ')

echo "📋 Найден Google Drive credential ID: $NEW_GDRIVE_ID"

if [ -z "$NEW_GDRIVE_ID" ]; then
    echo "❌ Google Drive credential не найден! Создайте его в N8N UI сначала."
    exit 1
fi

echo "🔧 Обновляю workflow с новым Google Drive credential ID..."

# Обновляем workflow с новым Google Drive ID
sed "s/XDM9FIbDJMpu7nGH/$NEW_GDRIVE_ID/g" /Users/user/media-video-maker/final-ai-agent-workflow.json > /Users/user/media-video-maker/updated-gdrive-workflow.json

echo "📤 Загружаю обновленный workflow..."

# Загружаем на сервер
scp /Users/user/media-video-maker/updated-gdrive-workflow.json root@178.156.142.35:/tmp/updated_gdrive_workflow.json

# Импортируем в N8N
ssh root@178.156.142.35 "
docker cp /tmp/updated_gdrive_workflow.json root-n8n-1:/tmp/updated_gdrive_workflow.json && 
docker exec root-db-1 psql -U n8n -d n8n -c \"DELETE FROM workflow_entity WHERE name LIKE '%Универсальная%';\" && 
docker exec root-n8n-1 n8n import:workflow --input=/tmp/updated_gdrive_workflow.json && 
docker exec root-db-1 psql -U n8n -d n8n -c \"UPDATE workflow_entity SET active = true WHERE name = '🎬 Универсальная AI Agent Автоматизация Видео';\"
"

echo "✅ Workflow обновлен с новым Google Drive credential ID: $NEW_GDRIVE_ID"

# Тестируем workflow
echo "🧪 Тестирую полный workflow..."
ssh root@178.156.142.35 "docker exec root-n8n-1 n8n execute --id=\$(docker exec root-db-1 psql -U n8n -d n8n -t -c \"SELECT id FROM workflow_entity WHERE name = '🎬 Универсальная AI Agent Автоматизация Видео' AND active = true;\" | tr -d ' ')"

echo "🎬 Полный цикл: AI Agent → Google Drive → MCP → Видео готов!"

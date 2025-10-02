#!/bin/bash
# 🔧 КОМАНДЫ ДЛЯ ИСПРАВЛЕНИЯ WORKFLOW 3TuNc9SUt9EDDqii

echo "🔧 ИСПРАВЛЕНИЕ WORKFLOW 3TuNc9SUt9EDDqii"
echo "=================================="

# 1. Проверяем workflow
echo "🔍 Проверка workflow..."
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"SELECT id, name, active FROM workflow_entity WHERE id = '3TuNc9SUt9EDDqii';\""

# 2. Проверяем credentials
echo "🔑 Проверка credentials..."
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"SELECT id, name, type FROM credentials_entity ORDER BY name;\""

# 3. Получаем nodes для анализа
echo "📦 Получение nodes..."
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -t -c \"SELECT LENGTH(nodes::text) FROM workflow_entity WHERE id = '3TuNc9SUt9EDDqii';\""

# 4. Исправляем credentials в workflow (основная команда)
echo "🔧 Применение исправлений..."

# Создаем SQL скрипт для исправления
cat > /tmp/fix_workflow.sql << 'EOF'
-- Исправление workflow 3TuNc9SUt9EDDqii
UPDATE workflow_entity 
SET nodes = REPLACE(
    REPLACE(
        REPLACE(nodes::text, 
            '"credentials":{}', 
            '"credentials":{"openRouterApi":{"id":"dctACn3yXSG7qIdH","name":"OpenRouter account"}}'
        ),
        '"sessionId":', 
        '"sessionIdExpression":"={{ $workflow.executionId }}","sessionId":'
    ),
    '"googleDriveOAuth2Api":{}',
    '"googleDriveOAuth2Api":{"id":"XDM9FIbDJMpu7nGH","name":"Google Drive account"}'
)::json,
"updatedAt" = NOW()
WHERE id = '3TuNc9SUt9EDDqii';
EOF

# Копируем скрипт на сервер и выполняем
scp /tmp/fix_workflow.sql root@178.156.142.35:/tmp/
ssh root@178.156.142.35 "docker exec -i root-db-1 psql -U n8n -d n8n < /tmp/fix_workflow.sql"

# 5. Перезапускаем N8N
echo "🔄 Перезапуск N8N..."
ssh root@178.156.142.35 "docker restart root-n8n-1"

# Ждем запуска
echo "⏱️ Ожидание запуска N8N (20 секунд)..."
sleep 20

# 6. Активируем workflow
echo "🔄 Активация workflow..."
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"UPDATE workflow_entity SET active = true WHERE id = '3TuNc9SUt9EDDqii';\""

# 7. Проверяем результат
echo "✅ Проверка результата..."
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"SELECT active FROM workflow_entity WHERE id = '3TuNc9SUt9EDDqii';\""

echo "🎉 ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!"
echo "🌐 Обновите страницу: https://mayersn8n.duckdns.org/workflow/3TuNc9SUt9EDDqii"



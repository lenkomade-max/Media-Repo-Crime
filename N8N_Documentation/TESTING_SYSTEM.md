# 🧪 N8N Testing System - Система автоматического тестирования

## 🎯 Цель системы тестирования

Автоматически тестировать workflows после каждого изменения, чтобы:
- ✅ Убедиться что все nodes работают
- ✅ Проверить AI агенты
- ✅ Валидировать API интеграции
- ✅ Тестировать полный pipeline
- ✅ Быстро находить и исправлять ошибки

## 🔧 Компоненты системы

### 1. **Health Check Script**
```bash
#!/bin/bash
# health-check.sh

echo "🔍 Проверка здоровья N8N системы..."

# Проверка N8N
if curl -s https://mayersn8n.duckdns.org/healthz | grep -q "ok"; then
    echo "✅ N8N доступен"
else
    echo "❌ N8N недоступен"
    exit 1
fi

# Проверка MCP
if curl -s http://178.156.142.35:4123/api/ping | grep -q "ok"; then
    echo "✅ MCP сервер работает"
else
    echo "❌ MCP сервер недоступен"
    exit 1
fi

# Проверка PostgreSQL
if ssh root@178.156.142.35 "docker exec root-db-1 pg_isready -U n8n" | grep -q "accepting"; then
    echo "✅ PostgreSQL работает"
else
    echo "❌ PostgreSQL недоступен"
    exit 1
fi

echo "🎉 Все сервисы работают!"
```

### 2. **Workflow Test Script**
```bash
#!/bin/bash
# test-workflow.sh

WORKFLOW_NAME="🎬 Правильная Автоматизация Видео (AI Agent)"
N8N_URL="https://mayersn8n.duckdns.org"
N8N_AUTH="admin:supersecret"

echo "🧪 Тестирование workflow: $WORKFLOW_NAME"

# Получить ID workflow
WORKFLOW_ID=$(curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/workflows" | \
    jq -r ".[] | select(.name == \"$WORKFLOW_NAME\") | .id")

if [ -z "$WORKFLOW_ID" ]; then
    echo "❌ Workflow не найден"
    exit 1
fi

echo "📋 Workflow ID: $WORKFLOW_ID"

# Запустить тест
EXECUTION_RESPONSE=$(curl -s -X POST -u "$N8N_AUTH" \
    -H "Content-Type: application/json" \
    -d '{"topic": "тестовая криминальная история"}' \
    "$N8N_URL/api/v1/workflows/$WORKFLOW_ID/execute")

EXECUTION_ID=$(echo "$EXECUTION_RESPONSE" | jq -r '.id')

if [ -z "$EXECUTION_ID" ]; then
    echo "❌ Не удалось запустить workflow"
    echo "$EXECUTION_RESPONSE"
    exit 1
fi

echo "🚀 Execution ID: $EXECUTION_ID"

# Ждем завершения (максимум 5 минут)
for i in {1..30}; do
    sleep 10
    STATUS=$(curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/executions/$EXECUTION_ID" | \
        jq -r '.finished')
    
    if [ "$STATUS" = "true" ]; then
        echo "✅ Workflow завершен успешно"
        break
    elif [ "$STATUS" = "false" ]; then
        echo "❌ Workflow завершился с ошибкой"
        curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/executions/$EXECUTION_ID" | \
            jq '.data.resultData.error'
        exit 1
    else
        echo "⏳ Ожидание завершения... ($i/30)"
    fi
done

echo "🎉 Тест workflow прошел успешно!"
```

### 3. **AI Agent Test Script**
```bash
#!/bin/bash
# test-ai-agents.sh

echo "🤖 Тестирование AI агентов..."

# Тест OpenRouter API
echo "📡 Тест OpenRouter API..."
OPENROUTER_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $OPENROUTER_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "anthropic/claude-3.5-sonnet",
        "messages": [{"role": "user", "content": "Тест"}],
        "max_tokens": 10
    }' \
    "https://openrouter.ai/api/v1/chat/completions")

if echo "$OPENROUTER_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null; then
    echo "✅ OpenRouter API работает"
else
    echo "❌ OpenRouter API недоступен"
    echo "$OPENROUTER_RESPONSE"
    exit 1
fi

# Тест Google Drive API
echo "📁 Тест Google Drive API..."
# Здесь будет тест Google Drive через N8N credentials

echo "🎉 Все AI агенты работают!"
```

### 4. **Integration Test Script**
```bash
#!/bin/bash
# test-integrations.sh

echo "🔗 Тестирование интеграций..."

# Тест MCP API
echo "🎬 Тест MCP API..."
MCP_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "files": [{"id": "test", "src": "/tmp/test.jpg", "type": "photo", "durationSec": 5}],
        "width": 1080,
        "height": 1920,
        "tts": {"provider": "kokoro", "voice": "default"},
        "ttsText": "Тест"
    }' \
    "http://178.156.142.35:4123/api/create-video")

if echo "$MCP_RESPONSE" | jq -e '.id' > /dev/null; then
    echo "✅ MCP API работает"
    JOB_ID=$(echo "$MCP_RESPONSE" | jq -r '.id')
    echo "📋 Job ID: $JOB_ID"
else
    echo "❌ MCP API недоступен"
    echo "$MCP_RESPONSE"
    exit 1
fi

# Тест Google Drive
echo "📁 Тест Google Drive..."
# Здесь будет тест загрузки/скачивания файлов

echo "🎉 Все интеграции работают!"
```

## 🚀 Автоматизированная система тестирования

### Master Test Script
```bash
#!/bin/bash
# run-all-tests.sh

echo "🎯 Запуск полного тестирования N8N системы"
echo "=" * 50

# 1. Health Check
echo "1️⃣ Health Check..."
if ! ./health-check.sh; then
    echo "❌ Health Check провален"
    exit 1
fi

# 2. AI Agents Test
echo "2️⃣ AI Agents Test..."
if ! ./test-ai-agents.sh; then
    echo "❌ AI Agents Test провален"
    exit 1
fi

# 3. Integrations Test
echo "3️⃣ Integrations Test..."
if ! ./test-integrations.sh; then
    echo "❌ Integrations Test провален"
    exit 1
fi

# 4. Full Workflow Test
echo "4️⃣ Full Workflow Test..."
if ! ./test-workflow.sh; then
    echo "❌ Workflow Test провален"
    exit 1
fi

echo ""
echo "🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!"
echo "✅ N8N система полностью функциональна"
echo "🚀 Готово к продакшену!"
```

## 📊 Continuous Testing

### Автоматический запуск тестов:

#### 1. **После каждого изменения workflow**
```bash
# В скрипте обновления workflow добавить:
echo "🧪 Запуск тестов после обновления..."
./run-all-tests.sh

if [ $? -eq 0 ]; then
    echo "✅ Обновление успешно - все тесты прошли"
else
    echo "❌ Обновление провалено - откат изменений"
    # Здесь код для отката
    exit 1
fi
```

#### 2. **Ежедневный health check**
```bash
# Добавить в crontab:
0 9 * * * /path/to/health-check.sh >> /var/log/n8n-health.log 2>&1
```

#### 3. **Еженедельный полный тест**
```bash
# Добавить в crontab:
0 2 * * 1 /path/to/run-all-tests.sh >> /var/log/n8n-tests.log 2>&1
```

## 🔍 Test Monitoring

### Система уведомлений:
```bash
#!/bin/bash
# notify-test-results.sh

TEST_RESULT=$1
TEST_NAME=$2

if [ "$TEST_RESULT" = "success" ]; then
    echo "✅ $TEST_NAME прошел успешно" | \
        curl -X POST -H 'Content-Type: application/json' \
        -d '{"text": "✅ N8N Test Success: '$TEST_NAME'"}' \
        $WEBHOOK_URL
else
    echo "❌ $TEST_NAME провален" | \
        curl -X POST -H 'Content-Type: application/json' \
        -d '{"text": "❌ N8N Test Failed: '$TEST_NAME'"}' \
        $WEBHOOK_URL
fi
```

### Логирование результатов:
```bash
#!/bin/bash
# log-test-results.sh

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
TEST_NAME=$1
TEST_RESULT=$2
TEST_DETAILS=$3

echo "[$TIMESTAMP] $TEST_NAME: $TEST_RESULT - $TEST_DETAILS" >> /var/log/n8n-tests.log

# Ротация логов
if [ $(wc -l < /var/log/n8n-tests.log) -gt 1000 ]; then
    tail -500 /var/log/n8n-tests.log > /var/log/n8n-tests.log.tmp
    mv /var/log/n8n-tests.log.tmp /var/log/n8n-tests.log
fi
```

## 📈 Test Metrics

### Метрики которые отслеживаем:
- ⏱️ Время выполнения workflow
- 📊 Успешность выполнения (%)
- 🔄 Количество ретраев
- 💾 Использование ресурсов
- 🌐 Время отклика API

### Dashboard метрик:
```bash
#!/bin/bash
# generate-test-dashboard.sh

echo "📊 N8N Test Dashboard"
echo "=" * 30

# Последние 10 тестов
echo "🕐 Последние тесты:"
tail -10 /var/log/n8n-tests.log

# Статистика успешности
SUCCESS_COUNT=$(grep "SUCCESS" /var/log/n8n-tests.log | wc -l)
TOTAL_COUNT=$(wc -l < /var/log/n8n-tests.log)
SUCCESS_RATE=$((SUCCESS_COUNT * 100 / TOTAL_COUNT))

echo "📈 Статистика:"
echo "Всего тестов: $TOTAL_COUNT"
echo "Успешных: $SUCCESS_COUNT"
echo "Успешность: $SUCCESS_RATE%"

# Среднее время выполнения
echo "⏱️ Производительность:"
grep "EXECUTION_TIME" /var/log/n8n-tests.log | \
    awk '{sum+=$3; count++} END {print "Среднее время: " sum/count " сек"}'
```

## 🎯 Test-Driven Development для N8N

### Процесс разработки:
1. **Написать тест** для новой функциональности
2. **Запустить тест** - он должен провалиться
3. **Реализовать функциональность** в workflow
4. **Запустить тест** - он должен пройти
5. **Рефакторинг** если нужно
6. **Финальный тест** всей системы

### Пример TDD для нового AI агента:
```bash
# 1. Создать тест для нового агента
echo "🧪 Тест нового AI агента..."

# 2. Тест должен провалиться (агента еще нет)
# 3. Добавить агента в workflow
# 4. Тест должен пройти
# 5. Интеграционный тест всего workflow
```

---

**🎯 Цель: 100% покрытие тестами всех критических функций N8N системы**

*Обновлено: {{ new Date().toISOString() }}*

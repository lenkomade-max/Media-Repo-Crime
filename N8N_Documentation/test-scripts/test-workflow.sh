#!/bin/bash

# 🧪 N8N Workflow Test Script
echo "🧪 Тестирование основного workflow..."

WORKFLOW_NAME="🎬 Правильная Автоматизация Видео (AI Agent)"
N8N_URL="https://mayersn8n.duckdns.org"
N8N_AUTH="admin:supersecret"
TEST_TOPIC="тестовая криминальная история для проверки системы"

# Функция для логирования
log_step() {
    echo "📋 $1"
}

log_success() {
    echo "✅ $1"
}

log_error() {
    echo "❌ $1"
    exit 1
}

# 1. Проверка доступности N8N API
log_step "Проверка доступности N8N API..."
if ! curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/workflows" >/dev/null 2>&1; then
    log_error "N8N API недоступен"
fi
log_success "N8N API доступен"

# 2. Поиск workflow
log_step "Поиск workflow '$WORKFLOW_NAME'..."
WORKFLOW_DATA=$(curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/workflows")
WORKFLOW_ID=$(echo "$WORKFLOW_DATA" | jq -r ".[] | select(.name == \"$WORKFLOW_NAME\") | .id")

if [ -z "$WORKFLOW_ID" ] || [ "$WORKFLOW_ID" = "null" ]; then
    log_error "Workflow '$WORKFLOW_NAME' не найден"
fi
log_success "Workflow найден (ID: $WORKFLOW_ID)"

# 3. Проверка активности workflow
WORKFLOW_ACTIVE=$(echo "$WORKFLOW_DATA" | jq -r ".[] | select(.name == \"$WORKFLOW_NAME\") | .active")
if [ "$WORKFLOW_ACTIVE" != "true" ]; then
    log_error "Workflow не активен"
fi
log_success "Workflow активен"

# 4. Запуск тестового выполнения
log_step "Запуск тестового выполнения..."
EXECUTION_RESPONSE=$(curl -s -X POST -u "$N8N_AUTH" \
    -H "Content-Type: application/json" \
    -d "{\"topic\": \"$TEST_TOPIC\"}" \
    "$N8N_URL/api/v1/workflows/$WORKFLOW_ID/execute")

EXECUTION_ID=$(echo "$EXECUTION_RESPONSE" | jq -r '.id')

if [ -z "$EXECUTION_ID" ] || [ "$EXECUTION_ID" = "null" ]; then
    log_error "Не удалось запустить workflow: $(echo "$EXECUTION_RESPONSE" | jq -r '.message // .error // "Unknown error"')"
fi
log_success "Workflow запущен (Execution ID: $EXECUTION_ID)"

# 5. Мониторинг выполнения
log_step "Мониторинг выполнения (максимум 10 минут)..."
START_TIME=$(date +%s)
MAX_WAIT_TIME=600  # 10 минут

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    if [ $ELAPSED -gt $MAX_WAIT_TIME ]; then
        log_error "Превышено время ожидания (10 минут)"
    fi
    
    # Получаем статус выполнения
    EXECUTION_DATA=$(curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/executions/$EXECUTION_ID")
    FINISHED=$(echo "$EXECUTION_DATA" | jq -r '.finished')
    STATUS=$(echo "$EXECUTION_DATA" | jq -r '.status')
    
    if [ "$FINISHED" = "true" ]; then
        if [ "$STATUS" = "success" ]; then
            log_success "Workflow выполнен успешно за $ELAPSED секунд"
            break
        else
            ERROR_MESSAGE=$(echo "$EXECUTION_DATA" | jq -r '.data.resultData.error.message // "Unknown error"')
            log_error "Workflow завершился с ошибкой: $ERROR_MESSAGE"
        fi
    fi
    
    # Показываем прогресс
    PROGRESS_INFO=$(echo "$EXECUTION_DATA" | jq -r '.data.resultData.runData | keys | length // 0')
    echo "⏳ Выполняется... ($ELAPSED сек, обработано $PROGRESS_INFO nodes)"
    
    sleep 10
done

# 6. Анализ результатов
log_step "Анализ результатов выполнения..."
EXECUTION_RESULT=$(curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/executions/$EXECUTION_ID")

# Проверяем ключевые этапы
NODES_DATA=$(echo "$EXECUTION_RESULT" | jq -r '.data.resultData.runData // {}')

# AI Сценарист
if echo "$NODES_DATA" | jq -e '.["🎭 AI Сценарист Agent"]' >/dev/null; then
    log_success "AI Сценарист отработал корректно"
else
    log_error "AI Сценарист не выполнился"
fi

# Google Drive поиск
if echo "$NODES_DATA" | jq -e '.["📁 AI Режиссер - Поиск в Google Drive"]' >/dev/null; then
    log_success "Google Drive поиск выполнен"
else
    echo "⚠️  Google Drive поиск не выполнился (возможно, нет подходящих файлов)"
fi

# MCP интеграция
if echo "$NODES_DATA" | jq -e '.["🎬 MCP Монтажер"]' >/dev/null; then
    log_success "MCP интеграция работает"
else
    echo "⚠️  MCP интеграция не выполнилась"
fi

# Финальный результат
FINAL_RESULT=$(echo "$NODES_DATA" | jq -r '.["🎉 Финальный результат"][0].data.main[0].json.status // "unknown"')
if [ "$FINAL_RESULT" = "completed" ]; then
    log_success "Workflow завершен полностью успешно"
elif [ "$FINAL_RESULT" = "video_creation_started" ]; then
    log_success "Видео создание запущено успешно"
else
    echo "⚠️  Финальный статус: $FINAL_RESULT"
fi

# 7. Сохранение результатов теста
log_step "Сохранение результатов теста..."
TEST_REPORT="/tmp/n8n_test_report_$(date +%Y%m%d_%H%M%S).json"
echo "$EXECUTION_RESULT" > "$TEST_REPORT"
log_success "Отчет сохранен: $TEST_REPORT"

# 8. Итоговая статистика
echo ""
echo "📊 ИТОГОВАЯ СТАТИСТИКА ТЕСТА:"
echo "🎯 Workflow: $WORKFLOW_NAME"
echo "🆔 Execution ID: $EXECUTION_ID"
echo "⏱️  Время выполнения: $ELAPSED секунд"
echo "📋 Статус: $STATUS"
echo "📄 Отчет: $TEST_REPORT"

if [ "$STATUS" = "success" ]; then
    echo ""
    echo "🎉 ТЕСТ WORKFLOW ПРОШЕЛ УСПЕШНО!"
    echo "✅ Система готова к продакшену"
    exit 0
else
    echo ""
    echo "❌ ТЕСТ WORKFLOW ПРОВАЛЕН"
    echo "🔧 Требуется исправление ошибок"
    exit 1
fi



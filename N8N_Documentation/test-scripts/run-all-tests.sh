#!/bin/bash

# 🎯 Master Test Script - Полное тестирование N8N системы
echo "🎯 Запуск полного тестирования N8N системы"
echo "=" | head -c 50; echo ""

# Переменные
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/n8n_test_$(date +%Y%m%d_%H%M%S).log"
TESTS_PASSED=0
TESTS_FAILED=0

# Функции логирования
log_test_start() {
    echo "🧪 ТЕСТ: $1" | tee -a "$LOG_FILE"
    echo "Время начала: $(date)" >> "$LOG_FILE"
}

log_test_result() {
    local test_name=$1
    local result=$2
    local details=$3
    
    if [ "$result" = "PASS" ]; then
        echo "✅ $test_name: ПРОШЕЛ" | tee -a "$LOG_FILE"
        ((TESTS_PASSED++))
    else
        echo "❌ $test_name: ПРОВАЛЕН - $details" | tee -a "$LOG_FILE"
        ((TESTS_FAILED++))
    fi
    echo "Время завершения: $(date)" >> "$LOG_FILE"
    echo "---" >> "$LOG_FILE"
}

# Проверка зависимостей
check_dependencies() {
    echo "🔍 Проверка зависимостей..."
    
    # Проверяем наличие необходимых команд
    local missing_deps=()
    
    for cmd in curl jq ssh; do
        if ! command -v $cmd >/dev/null 2>&1; then
            missing_deps+=($cmd)
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo "❌ Отсутствуют зависимости: ${missing_deps[*]}"
        echo "Установите их перед запуском тестов"
        exit 1
    fi
    
    echo "✅ Все зависимости установлены"
}

# Тест 1: Health Check
run_health_check() {
    log_test_start "Health Check"
    
    if [ -f "$SCRIPT_DIR/health-check.sh" ]; then
        if bash "$SCRIPT_DIR/health-check.sh" >> "$LOG_FILE" 2>&1; then
            log_test_result "Health Check" "PASS" ""
            return 0
        else
            log_test_result "Health Check" "FAIL" "Системные компоненты недоступны"
            return 1
        fi
    else
        log_test_result "Health Check" "FAIL" "Скрипт health-check.sh не найден"
        return 1
    fi
}

# Тест 2: AI Agents Test
run_ai_agents_test() {
    log_test_start "AI Agents Test"
    
    # Тест OpenRouter API
    echo "🤖 Тестирование OpenRouter API..." >> "$LOG_FILE"
    
    # Простой тест доступности OpenRouter
    if curl -s --max-time 10 "https://openrouter.ai/api/v1/models" >/dev/null 2>&1; then
        echo "✅ OpenRouter API доступен" >> "$LOG_FILE"
        log_test_result "AI Agents Test" "PASS" ""
        return 0
    else
        log_test_result "AI Agents Test" "FAIL" "OpenRouter API недоступен"
        return 1
    fi
}

# Тест 3: Integrations Test
run_integrations_test() {
    log_test_start "Integrations Test"
    
    # Тест MCP API
    echo "🎬 Тестирование MCP API..." >> "$LOG_FILE"
    
    MCP_RESPONSE=$(ssh root@178.156.142.35 "curl -s --max-time 10 -X POST \
        -H 'Content-Type: application/json' \
        -d '{\"files\":[{\"id\":\"test\",\"src\":\"/tmp/test.jpg\",\"type\":\"photo\",\"durationSec\":5}],\"width\":1080,\"height\":1920,\"tts\":{\"provider\":\"kokoro\",\"voice\":\"default\"},\"ttsText\":\"Тест\"}' \
        http://localhost:4123/api/create-video" 2>/dev/null)
    
    if echo "$MCP_RESPONSE" | jq -e '.id' >/dev/null 2>&1; then
        JOB_ID=$(echo "$MCP_RESPONSE" | jq -r '.id')
        echo "✅ MCP API работает (Job ID: $JOB_ID)" >> "$LOG_FILE"
        log_test_result "Integrations Test" "PASS" ""
        return 0
    else
        echo "❌ MCP API ответ: $MCP_RESPONSE" >> "$LOG_FILE"
        log_test_result "Integrations Test" "FAIL" "MCP API недоступен"
        return 1
    fi
}

# Тест 4: Full Workflow Test
run_workflow_test() {
    log_test_start "Full Workflow Test"
    
    if [ -f "$SCRIPT_DIR/test-workflow.sh" ]; then
        if bash "$SCRIPT_DIR/test-workflow.sh" >> "$LOG_FILE" 2>&1; then
            log_test_result "Full Workflow Test" "PASS" ""
            return 0
        else
            log_test_result "Full Workflow Test" "FAIL" "Workflow выполнился с ошибками"
            return 1
        fi
    else
        log_test_result "Full Workflow Test" "FAIL" "Скрипт test-workflow.sh не найден"
        return 1
    fi
}

# Тест 5: Performance Test
run_performance_test() {
    log_test_start "Performance Test"
    
    # Проверяем время отклика N8N
    START_TIME=$(date +%s%N)
    if curl -s --max-time 5 "https://mayersn8n.duckdns.org" >/dev/null 2>&1; then
        END_TIME=$(date +%s%N)
        RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 )) # в миллисекундах
        
        echo "⏱️ Время отклика N8N: ${RESPONSE_TIME}ms" >> "$LOG_FILE"
        
        if [ $RESPONSE_TIME -lt 5000 ]; then # менее 5 секунд
            log_test_result "Performance Test" "PASS" "Время отклика: ${RESPONSE_TIME}ms"
            return 0
        else
            log_test_result "Performance Test" "FAIL" "Медленный отклик: ${RESPONSE_TIME}ms"
            return 1
        fi
    else
        log_test_result "Performance Test" "FAIL" "N8N недоступен"
        return 1
    fi
}

# Главная функция
main() {
    echo "🚀 Начало тестирования: $(date)" | tee "$LOG_FILE"
    echo "📄 Лог файл: $LOG_FILE"
    echo ""
    
    # Проверка зависимостей
    check_dependencies
    echo ""
    
    # Запуск всех тестов
    echo "🧪 Запуск тестов..."
    echo ""
    
    # Тест 1: Health Check
    run_health_check
    echo ""
    
    # Тест 2: AI Agents
    run_ai_agents_test
    echo ""
    
    # Тест 3: Integrations
    run_integrations_test
    echo ""
    
    # Тест 4: Performance
    run_performance_test
    echo ""
    
    # Тест 5: Full Workflow (самый важный)
    run_workflow_test
    echo ""
    
    # Итоговый отчет
    TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
    SUCCESS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))
    
    echo "📊 ИТОГОВЫЙ ОТЧЕТ ТЕСТИРОВАНИЯ"
    echo "=" | head -c 40; echo ""
    echo "📅 Дата: $(date)"
    echo "📄 Лог: $LOG_FILE"
    echo "🧪 Всего тестов: $TOTAL_TESTS"
    echo "✅ Прошло: $TESTS_PASSED"
    echo "❌ Провалено: $TESTS_FAILED"
    echo "📈 Успешность: $SUCCESS_RATE%"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo "🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!"
        echo "✅ N8N система полностью функциональна"
        echo "🚀 Готово к продакшену!"
        
        # Отправляем уведомление об успехе (если настроен webhook)
        if [ -n "$SUCCESS_WEBHOOK_URL" ]; then
            curl -s -X POST -H 'Content-Type: application/json' \
                -d "{\"text\": \"✅ N8N Tests Passed: $SUCCESS_RATE% ($TESTS_PASSED/$TOTAL_TESTS)\"}" \
                "$SUCCESS_WEBHOOK_URL" >/dev/null 2>&1
        fi
        
        exit 0
    else
        echo "⚠️  ОБНАРУЖЕНЫ ПРОБЛЕМЫ!"
        echo "🔧 Требуется исправление $TESTS_FAILED ошибок"
        echo "📋 Детали в лог файле: $LOG_FILE"
        
        # Отправляем уведомление об ошибках (если настроен webhook)
        if [ -n "$ERROR_WEBHOOK_URL" ]; then
            curl -s -X POST -H 'Content-Type: application/json' \
                -d "{\"text\": \"❌ N8N Tests Failed: $TESTS_FAILED/$TOTAL_TESTS tests failed\"}" \
                "$ERROR_WEBHOOK_URL" >/dev/null 2>&1
        fi
        
        exit 1
    fi
}

# Обработка сигналов
trap 'echo "🛑 Тестирование прервано пользователем"; exit 130' INT TERM

# Запуск
main "$@"



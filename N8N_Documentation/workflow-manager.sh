#!/bin/bash

# 🎬 N8N Workflow Manager - Система управления workflow
echo "🎬 N8N Workflow Manager"

SERVER="178.156.142.35"
WORKFLOW_NAME="🎬 Правильная Автоматизация Видео (AI Agent)"
BACKUP_DIR="/tmp/n8n_backups"
N8N_URL="https://mayersn8n.duckdns.org"
N8N_AUTH="admin:supersecret"

# Создаем директорию для backup
mkdir -p "$BACKUP_DIR"

# Функции
show_help() {
    echo "Использование: $0 [команда]"
    echo ""
    echo "Команды:"
    echo "  status      - Показать статус workflow"
    echo "  backup      - Создать backup текущего workflow"
    echo "  restore     - Восстановить из backup"
    echo "  update      - Обновить workflow из файла"
    echo "  test        - Запустить тест workflow"
    echo "  activate    - Активировать workflow"
    echo "  deactivate  - Деактивировать workflow"
    echo "  logs        - Показать последние executions"
    echo "  export      - Экспортировать workflow в файл"
    echo "  help        - Показать эту справку"
}

get_workflow_id() {
    local workflow_data=$(curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/workflows" 2>/dev/null)
    echo "$workflow_data" | jq -r ".[] | select(.name == \"$WORKFLOW_NAME\") | .id"
}

show_status() {
    echo "📊 Статус workflow: $WORKFLOW_NAME"
    echo ""
    
    # Получаем информацию о workflow
    local workflow_id=$(get_workflow_id)
    
    if [ -z "$workflow_id" ] || [ "$workflow_id" = "null" ]; then
        echo "❌ Workflow не найден"
        return 1
    fi
    
    local workflow_data=$(curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/workflows/$workflow_id" 2>/dev/null)
    local active=$(echo "$workflow_data" | jq -r '.active')
    local updated=$(echo "$workflow_data" | jq -r '.updatedAt')
    local nodes_count=$(echo "$workflow_data" | jq -r '.nodes | length')
    
    echo "🆔 ID: $workflow_id"
    echo "🔄 Активен: $([ "$active" = "true" ] && echo "✅ Да" || echo "❌ Нет")"
    echo "📅 Обновлен: $updated"
    echo "🔗 Nodes: $nodes_count"
    
    # Последние executions
    echo ""
    echo "📋 Последние выполнения:"
    local executions=$(curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/executions?limit=5&workflowId=$workflow_id" 2>/dev/null)
    echo "$executions" | jq -r '.data[] | "  \(.startedAt // "N/A") - \(.status // "unknown") (\(.id))"' | head -5
}

create_backup() {
    echo "💾 Создание backup workflow..."
    
    local workflow_id=$(get_workflow_id)
    if [ -z "$workflow_id" ] || [ "$workflow_id" = "null" ]; then
        echo "❌ Workflow не найден"
        return 1
    fi
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/workflow_backup_$timestamp.json"
    
    # Экспортируем через API
    local workflow_data=$(curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/workflows/$workflow_id" 2>/dev/null)
    
    if [ -n "$workflow_data" ] && [ "$workflow_data" != "null" ]; then
        echo "$workflow_data" > "$backup_file"
        echo "✅ Backup создан: $backup_file"
        
        # Также создаем backup через SSH на сервере
        ssh root@$SERVER "docker exec root-n8n-1 n8n export:workflow --id=$workflow_id --output=/root/backup_$timestamp.json" 2>/dev/null
        echo "✅ Серверный backup: /root/backup_$timestamp.json"
        
        return 0
    else
        echo "❌ Не удалось создать backup"
        return 1
    fi
}

restore_backup() {
    echo "🔄 Восстановление из backup..."
    
    # Показываем доступные backups
    echo "Доступные backups:"
    ls -la "$BACKUP_DIR"/workflow_backup_*.json 2>/dev/null | tail -5
    
    read -p "Введите имя файла backup (или Enter для последнего): " backup_file
    
    if [ -z "$backup_file" ]; then
        backup_file=$(ls -t "$BACKUP_DIR"/workflow_backup_*.json 2>/dev/null | head -1)
    else
        backup_file="$BACKUP_DIR/$backup_file"
    fi
    
    if [ ! -f "$backup_file" ]; then
        echo "❌ Backup файл не найден: $backup_file"
        return 1
    fi
    
    echo "📂 Восстанавливаем из: $backup_file"
    
    # Удаляем текущий workflow
    local workflow_id=$(get_workflow_id)
    if [ -n "$workflow_id" ] && [ "$workflow_id" != "null" ]; then
        curl -s -X DELETE -u "$N8N_AUTH" "$N8N_URL/api/v1/workflows/$workflow_id" >/dev/null 2>&1
        echo "🗑️ Старый workflow удален"
    fi
    
    # Импортируем backup
    local import_response=$(curl -s -X POST -u "$N8N_AUTH" \
        -H "Content-Type: application/json" \
        -d @"$backup_file" \
        "$N8N_URL/api/v1/workflows" 2>/dev/null)
    
    local new_id=$(echo "$import_response" | jq -r '.id')
    if [ -n "$new_id" ] && [ "$new_id" != "null" ]; then
        echo "✅ Workflow восстановлен (ID: $new_id)"
        
        # Активируем
        curl -s -X PATCH -u "$N8N_AUTH" \
            -H "Content-Type: application/json" \
            -d '{"active": true}' \
            "$N8N_URL/api/v1/workflows/$new_id" >/dev/null 2>&1
        echo "✅ Workflow активирован"
        
        return 0
    else
        echo "❌ Не удалось восстановить workflow"
        echo "Ответ: $import_response"
        return 1
    fi
}

update_workflow() {
    local file_path=$1
    
    if [ -z "$file_path" ]; then
        read -p "Введите путь к файлу workflow: " file_path
    fi
    
    if [ ! -f "$file_path" ]; then
        echo "❌ Файл не найден: $file_path"
        return 1
    fi
    
    echo "🔄 Обновление workflow из файла: $file_path"
    
    # Создаем backup перед обновлением
    create_backup
    
    # Удаляем текущий workflow
    local workflow_id=$(get_workflow_id)
    if [ -n "$workflow_id" ] && [ "$workflow_id" != "null" ]; then
        curl -s -X DELETE -u "$N8N_AUTH" "$N8N_URL/api/v1/workflows/$workflow_id" >/dev/null 2>&1
        echo "🗑️ Старый workflow удален"
    fi
    
    # Импортируем новый
    local import_response=$(curl -s -X POST -u "$N8N_AUTH" \
        -H "Content-Type: application/json" \
        -d @"$file_path" \
        "$N8N_URL/api/v1/workflows" 2>/dev/null)
    
    local new_id=$(echo "$import_response" | jq -r '.id')
    if [ -n "$new_id" ] && [ "$new_id" != "null" ]; then
        echo "✅ Workflow обновлен (ID: $new_id)"
        
        # Активируем
        curl -s -X PATCH -u "$N8N_AUTH" \
            -H "Content-Type: application/json" \
            -d '{"active": true}' \
            "$N8N_URL/api/v1/workflows/$new_id" >/dev/null 2>&1
        echo "✅ Workflow активирован"
        
        # Запускаем тест
        echo "🧪 Запуск тестирования..."
        if [ -f "N8N_Documentation/test-scripts/test-workflow.sh" ]; then
            bash N8N_Documentation/test-scripts/test-workflow.sh
        fi
        
        return 0
    else
        echo "❌ Не удалось обновить workflow"
        echo "Ответ: $import_response"
        return 1
    fi
}

test_workflow() {
    echo "🧪 Запуск теста workflow..."
    
    if [ -f "N8N_Documentation/test-scripts/test-workflow.sh" ]; then
        bash N8N_Documentation/test-scripts/test-workflow.sh
    else
        echo "❌ Тестовый скрипт не найден"
        return 1
    fi
}

activate_workflow() {
    echo "🔄 Активация workflow..."
    
    local workflow_id=$(get_workflow_id)
    if [ -z "$workflow_id" ] || [ "$workflow_id" = "null" ]; then
        echo "❌ Workflow не найден"
        return 1
    fi
    
    local response=$(curl -s -X PATCH -u "$N8N_AUTH" \
        -H "Content-Type: application/json" \
        -d '{"active": true}' \
        "$N8N_URL/api/v1/workflows/$workflow_id" 2>/dev/null)
    
    if echo "$response" | jq -e '.active' >/dev/null 2>&1; then
        echo "✅ Workflow активирован"
        return 0
    else
        echo "❌ Не удалось активировать workflow"
        return 1
    fi
}

deactivate_workflow() {
    echo "⏸️ Деактивация workflow..."
    
    local workflow_id=$(get_workflow_id)
    if [ -z "$workflow_id" ] || [ "$workflow_id" = "null" ]; then
        echo "❌ Workflow не найден"
        return 1
    fi
    
    local response=$(curl -s -X PATCH -u "$N8N_AUTH" \
        -H "Content-Type: application/json" \
        -d '{"active": false}' \
        "$N8N_URL/api/v1/workflows/$workflow_id" 2>/dev/null)
    
    if echo "$response" | jq -e '.active == false' >/dev/null 2>&1; then
        echo "✅ Workflow деактивирован"
        return 0
    else
        echo "❌ Не удалось деактивировать workflow"
        return 1
    fi
}

show_logs() {
    echo "📋 Последние executions workflow..."
    
    local workflow_id=$(get_workflow_id)
    if [ -z "$workflow_id" ] || [ "$workflow_id" = "null" ]; then
        echo "❌ Workflow не найден"
        return 1
    fi
    
    local executions=$(curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/executions?limit=10&workflowId=$workflow_id" 2>/dev/null)
    
    echo "$executions" | jq -r '.data[] | "\(.startedAt // "N/A") | \(.status // "unknown") | \(.id) | \(.data.resultData.error.message // "OK")"' | \
    while IFS='|' read -r started status id error; do
        local status_icon="❓"
        case "$status" in
            "success") status_icon="✅" ;;
            "error") status_icon="❌" ;;
            "running") status_icon="🔄" ;;
            "waiting") status_icon="⏳" ;;
        esac
        
        echo "$status_icon $started - $status ($id) - $error"
    done
}

export_workflow() {
    local output_file=$1
    
    if [ -z "$output_file" ]; then
        output_file="workflow_export_$(date +%Y%m%d_%H%M%S).json"
    fi
    
    echo "📤 Экспорт workflow в файл: $output_file"
    
    local workflow_id=$(get_workflow_id)
    if [ -z "$workflow_id" ] || [ "$workflow_id" = "null" ]; then
        echo "❌ Workflow не найден"
        return 1
    fi
    
    local workflow_data=$(curl -s -u "$N8N_AUTH" "$N8N_URL/api/v1/workflows/$workflow_id" 2>/dev/null)
    
    if [ -n "$workflow_data" ] && [ "$workflow_data" != "null" ]; then
        echo "$workflow_data" | jq '.' > "$output_file"
        echo "✅ Workflow экспортирован: $output_file"
        return 0
    else
        echo "❌ Не удалось экспортировать workflow"
        return 1
    fi
}

# Главная функция
main() {
    case "$1" in
        "status")
            show_status
            ;;
        "backup")
            create_backup
            ;;
        "restore")
            restore_backup
            ;;
        "update")
            update_workflow "$2"
            ;;
        "test")
            test_workflow
            ;;
        "activate")
            activate_workflow
            ;;
        "deactivate")
            deactivate_workflow
            ;;
        "logs")
            show_logs
            ;;
        "export")
            export_workflow "$2"
            ;;
        "help"|"")
            show_help
            ;;
        *)
            echo "❌ Неизвестная команда: $1"
            show_help
            exit 1
            ;;
    esac
}

# Проверка зависимостей
if ! command -v jq >/dev/null 2>&1; then
    echo "❌ Требуется установить jq"
    exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
    echo "❌ Требуется установить curl"
    exit 1
fi

# Запуск
main "$@"



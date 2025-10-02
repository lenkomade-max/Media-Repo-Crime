# 🎬 N8N Workflow Management - Система управления

## 📋 Методы управления workflows

### 1. **Через N8N UI** (Рекомендуется)
```
URL: https://mayersn8n.duckdns.org
Логин: admin
Пароль: supersecret
```

**Преимущества:**
- ✅ Визуальное редактирование
- ✅ Мгновенная валидация
- ✅ Тестирование nodes
- ✅ Просмотр executions

### 2. **Через N8N CLI**
```bash
# Экспорт workflow
ssh root@178.156.142.35 "docker exec root-n8n-1 n8n export:workflow --id={ID} --output=/tmp/workflow.json"

# Импорт workflow
ssh root@178.156.142.35 "docker exec root-n8n-1 n8n import:workflow --input=/tmp/workflow.json"

# Список workflows
ssh root@178.156.142.35 "docker exec root-n8n-1 n8n list:workflow"

# Активация workflow
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"UPDATE workflow_entity SET active = true WHERE name = 'Workflow Name';\""
```

### 3. **Через Database** (Экстренные случаи)
```sql
-- Просмотр workflows
SELECT id, name, active FROM workflow_entity;

-- Активация workflow
UPDATE workflow_entity SET active = true WHERE name = 'Workflow Name';

-- Обновление workflow
UPDATE workflow_entity SET nodes = '...' WHERE name = 'Workflow Name';
```

### 4. **Через REST API**
```bash
# Получить список workflows
curl -u admin:supersecret https://mayersn8n.duckdns.org/api/v1/workflows

# Создать workflow
curl -X POST -u admin:supersecret \
  -H "Content-Type: application/json" \
  -d @workflow.json \
  https://mayersn8n.duckdns.org/api/v1/workflows

# Активировать workflow
curl -X PATCH -u admin:supersecret \
  -H "Content-Type: application/json" \
  -d '{"active": true}' \
  https://mayersn8n.duckdns.org/api/v1/workflows/{ID}
```

## 🔄 Принцип "Один Workflow"

### Вместо создания новых workflows:
1. **Найти существующий workflow**
2. **Сделать backup**
3. **Отредактировать существующий**
4. **Протестировать изменения**
5. **Активировать обновленный**

### Backup workflow перед изменениями:
```bash
# Создать backup
ssh root@178.156.142.35 "docker exec root-n8n-1 n8n export:workflow --id={ID} --output=/root/backups/workflow_$(date +%Y%m%d_%H%M%S).json"
```

## 📊 Мониторинг workflows

### Проверка статуса:
```bash
# Статус всех workflows
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"SELECT name, active FROM workflow_entity;\""

# Последние executions
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"SELECT * FROM execution_entity ORDER BY \\\"startedAt\\\" DESC LIMIT 5;\""
```

### Логи N8N:
```bash
# Просмотр логов
ssh root@178.156.142.35 "docker logs root-n8n-1 -f"

# Поиск ошибок
ssh root@178.156.142.35 "docker logs root-n8n-1 | grep -i error"
```

## 🧪 Тестирование workflows

### Автоматическое тестирование:
```bash
# Запуск тестового workflow
curl -X POST -u admin:supersecret \
  https://mayersn8n.duckdns.org/api/v1/workflows/{TEST_ID}/execute

# Проверка результата
curl -u admin:supersecret \
  https://mayersn8n.duckdns.org/api/v1/executions/{EXECUTION_ID}
```

### Ручное тестирование:
1. Открыть workflow в N8N UI
2. Нажать "Execute Workflow"
3. Проверить результат каждого node
4. Исправить ошибки
5. Повторить тест

## 🔧 Troubleshooting

### Workflow не активируется:
```bash
# Проверить ошибки в базе данных
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"SELECT * FROM workflow_entity WHERE active = false;\""

# Перезапустить N8N
ssh root@178.156.142.35 "docker restart root-n8n-1"
```

### Workflow не выполняется:
```bash
# Проверить credentials
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"SELECT id, name, type FROM credentials_entity;\""

# Проверить connections между nodes
# (через N8N UI)
```

### Memory/Session ошибки:
```json
// Добавить в Simple Memory node:
{
  "parameters": {
    "sessionIdExpression": "={{ $workflow.executionId }}"
  }
}
```

## 📝 Best Practices

### 1. **Naming Convention:**
- 🎬 для основных workflows
- 🧪 для тестовых workflows
- 🔧 для утилитарных workflows

### 2. **Версионирование:**
- Использовать Git для версионирования JSON файлов
- Создавать tags для стабильных версий
- Документировать изменения

### 3. **Error Handling:**
- Добавлять error handling nodes
- Использовать try-catch в Code nodes
- Логировать ошибки

### 4. **Performance:**
- Минимизировать количество HTTP requests
- Использовать кэширование где возможно
- Оптимизировать Code nodes

---

*Обновлено: {{ new Date().toISOString() }}*



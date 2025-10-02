# 🤖 Правила работы AI Assistant с N8N

## 📋 Обязательные правила

### ✅ ВСЕГДА ДЕЛАТЬ:

#### 1. **Тестирование после изменений**
```bash
# Обязательная последовательность:
1. Внести изменения в workflow
2. Импортировать/обновить в N8N
3. Запустить тестовый workflow
4. Проверить результат
5. Исправить ошибки если есть
6. Повторить тест
7. Только после успешного теста - завершить задачу
```

#### 2. **Использовать один workflow**
- ❌ НЕ создавать новые workflows без крайней необходимости
- ✅ Редактировать существующий "🎬 Правильная Автоматизация Видео (AI Agent)"
- ✅ Делать backup перед изменениями
- ✅ Использовать версионирование

#### 3. **Проверять все соединения**
```json
// Обязательно проверить:
- connections между nodes
- credential IDs
- AI model connections (ai_languageModel, ai_memory)
- HTTP Request URLs
- Google Drive folder IDs
```

#### 4. **Валидировать credentials**
```bash
# Проверить существующие credentials:
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"SELECT id, name, type FROM credentials_entity;\""

# Использовать правильные IDs:
- OpenRouter: dctACn3yXSG7qIdH
- Google Drive: XDM9FIbDJMpu7nGH
```

#### 5. **Создавать backup**
```bash
# Перед любыми изменениями:
ssh root@178.156.142.35 "docker exec root-n8n-1 n8n export:workflow --id={ID} --output=/root/backups/workflow_backup_$(date +%Y%m%d_%H%M%S).json"
```

### ❌ НИКОГДА НЕ ДЕЛАТЬ:

#### 1. **Не создавать новые workflows**
- Не создавать дубликаты
- Не создавать "тестовые версии"
- Работать только с существующим

#### 2. **Не удалять рабочие workflows**
- Не удалять активные workflows
- Не удалять без backup

#### 3. **Не изменять credentials без уведомления**
- Не менять credential IDs
- Не удалять существующие credentials

#### 4. **Не использовать кастомные HTTP nodes вместо встроенных AI nodes**
```json
// ❌ НЕПРАВИЛЬНО:
{
  "type": "n8n-nodes-base.httpRequest",
  "url": "https://openrouter.ai/api/v1/chat/completions"
}

// ✅ ПРАВИЛЬНО:
{
  "type": "@n8n/n8n-nodes-langchain.agent",
  "connections": {
    "ai_languageModel": "OpenRouter Chat Model",
    "ai_memory": "Simple Memory"
  }
}
```

## 🔧 Процесс внесения изменений

### Шаг 1: Анализ
```bash
# 1. Проанализировать текущий workflow
# 2. Определить что нужно изменить
# 3. Спланировать изменения
# 4. Проверить зависимости
```

### Шаг 2: Backup
```bash
# Создать backup текущего workflow
ssh root@178.156.142.35 "docker exec root-n8n-1 n8n export:workflow --name='🎬 Правильная Автоматизация Видео (AI Agent)' --output=/root/backup_$(date +%Y%m%d_%H%M%S).json"
```

### Шаг 3: Изменения
```bash
# 1. Внести изменения в JSON файл
# 2. Валидировать JSON структуру
# 3. Проверить все IDs и connections
# 4. Проверить credentials
```

### Шаг 4: Импорт
```bash
# Удалить старый workflow
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"DELETE FROM workflow_entity WHERE name = '🎬 Правильная Автоматизация Видео (AI Agent)';\""

# Импортировать обновленный
ssh root@178.156.142.35 "docker exec root-n8n-1 n8n import:workflow --input=/root/updated_workflow.json"

# Активировать
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"UPDATE workflow_entity SET active = true WHERE name = '🎬 Правильная Автоматизация Видео (AI Agent)';\""
```

### Шаг 5: Тестирование
```bash
# 1. Перезапустить N8N если нужно
ssh root@178.156.142.35 "docker restart root-n8n-1"

# 2. Проверить что workflow появился в UI
# 3. Запустить тестовое выполнение
# 4. Проверить каждый node
# 5. Исправить ошибки
# 6. Повторить тест до успеха
```

### Шаг 6: Документирование
```bash
# 1. Обновить документацию
# 2. Записать изменения в changelog
# 3. Создать commit в Git
# 4. Обновить TODO list
```

## 🧪 Обязательное тестирование

### Тесты которые ВСЕГДА нужно запускать:

#### 1. **Проверка доступности N8N**
```bash
curl -s https://mayersn8n.duckdns.org/healthz
```

#### 2. **Тест AI агентов**
```bash
# Запустить workflow с тестовыми данными
# Проверить что AI агенты отвечают
# Проверить парсинг JSON ответов
```

#### 3. **Проверка MCP сервера**
```bash
curl -s http://178.156.142.35:4123/api/ping
```

#### 4. **Валидация Google Drive**
```bash
# Проверить доступ к папкам
# Проверить скачивание файлов
# Проверить загрузку результатов
```

#### 5. **Полный workflow тест**
```bash
# Запустить полный workflow от начала до конца
# Проверить создание видео
# Проверить загрузку на Google Drive
```

## 📊 Мониторинг и диагностика

### Обязательные проверки:

#### 1. **Статус сервисов**
```bash
# N8N
ssh root@178.156.142.35 "docker ps | grep n8n"

# PostgreSQL
ssh root@178.156.142.35 "docker ps | grep postgres"

# MCP Server
ssh root@178.156.142.35 "curl -s http://localhost:4123/api/ping"
```

#### 2. **Логи ошибок**
```bash
# N8N логи
ssh root@178.156.142.35 "docker logs root-n8n-1 | tail -20"

# MCP логи
ssh root@178.156.142.35 "docker logs root-media-video-maker-1 | tail -20"
```

#### 3. **База данных**
```bash
# Проверить workflows
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"SELECT name, active FROM workflow_entity;\""

# Проверить credentials
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"SELECT name, type FROM credentials_entity;\""
```

## 🚨 Типичные ошибки и решения

### 1. **"No session ID found" в Simple Memory**
```json
// Решение:
{
  "parameters": {
    "sessionIdExpression": "={{ $workflow.executionId }}"
  }
}
```

### 2. **Credentials ошибки**
```bash
# Проверить ID credentials в базе данных
ssh root@178.156.142.35 "docker exec root-db-1 psql -U n8n -d n8n -c \"SELECT id, name FROM credentials_entity;\""

# Использовать правильные IDs в workflow
```

### 3. **MCP Server недоступен**
```bash
# Перезапустить контейнер
ssh root@178.156.142.35 "docker restart root-media-video-maker-1"

# Проверить статус
ssh root@178.156.142.35 "curl http://localhost:4123/api/ping"
```

### 4. **AI Agent connections**
```json
// Правильные connections:
"connections": {
  "ai_languageModel": [
    [{"node": "OpenRouter Chat Model", "type": "ai_languageModel", "index": 0}]
  ],
  "ai_memory": [
    [{"node": "Simple Memory", "type": "ai_memory", "index": 0}]
  ]
}
```

## 📝 Checklist для AI Assistant

### Перед началом работы:
- [ ] Проверить статус всех сервисов
- [ ] Создать backup текущего workflow
- [ ] Проанализировать требуемые изменения

### Во время работы:
- [ ] Использовать только встроенные AI nodes
- [ ] Проверять все credential IDs
- [ ] Валидировать JSON структуру
- [ ] Тестировать каждое изменение

### После завершения:
- [ ] Запустить полный тест workflow
- [ ] Проверить все connections
- [ ] Обновить документацию
- [ ] Создать commit изменений

---

**🎯 Главное правило: НИКОГДА не завершать задачу без успешного тестирования!**

*Обновлено: {{ new Date().toISOString() }}*

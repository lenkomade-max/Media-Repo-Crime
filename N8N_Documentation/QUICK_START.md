# 🚀 N8N Quick Start Guide

## 🎯 Быстрый старт для нового AI Assistant

Если вы новый AI Assistant, который будет работать с этой N8N системой, следуйте этому руководству:

### 1. **Понимание системы** (5 минут)
```bash
# Прочитайте эти файлы в порядке приоритета:
1. README.md - Общий обзор системы
2. CONTEXT_HISTORY.md - Полная история проекта
3. AI_ASSISTANT_RULES.md - Обязательные правила работы
```

### 2. **Проверка состояния системы** (2 минуты)
```bash
# Запустите health check:
cd N8N_Documentation/test-scripts
chmod +x health-check.sh
./health-check.sh
```

### 3. **Текущий активный workflow** (1 минута)
- **Название**: "🎬 Правильная Автоматизация Видео (AI Agent)"
- **Файл**: `correct-ai-workflow.json`
- **Статус**: Активен и работает
- **Последнее обновление**: Исправлена ошибка Simple Memory

### 4. **Основные команды** (3 минуты)
```bash
# Управление workflow:
./workflow-manager.sh status    # Проверить статус
./workflow-manager.sh test      # Запустить тест
./workflow-manager.sh backup    # Создать backup

# Полное тестирование:
cd test-scripts
./run-all-tests.sh
```

### 5. **Если нужно внести изменения** (ОБЯЗАТЕЛЬНО!)
```bash
# ВСЕГДА следуйте этой последовательности:
1. ./workflow-manager.sh backup          # Создать backup
2. # Внести изменения в correct-ai-workflow.json
3. ./workflow-manager.sh update correct-ai-workflow.json  # Обновить
4. ./workflow-manager.sh test            # Протестировать
5. # Только если тест прошел - изменения готовы!
```

## ⚠️ КРИТИЧЕСКИ ВАЖНО:

### ❌ НИКОГДА НЕ ДЕЛАЙТЕ:
- Не создавайте новые workflows
- Не удаляйте рабочие workflows
- Не используйте кастомные HTTP nodes для AI
- Не завершайте задачу без тестирования

### ✅ ВСЕГДА ДЕЛАЙТЕ:
- Создавайте backup перед изменениями
- Используйте встроенные N8N AI Agent nodes
- Тестируйте каждое изменение
- Читайте AI_ASSISTANT_RULES.md

## 🔧 Доступ к системе:

### N8N Web Interface:
- **URL**: https://mayersn8n.duckdns.org
- **Логин**: admin
- **Пароль**: supersecret

### Сервер:
- **SSH**: root@178.156.142.35
- **MCP API**: http://178.156.142.35:4123

### Credentials (уже настроены):
- **OpenRouter**: dctACn3yXSG7qIdH
- **Google Drive**: XDM9FIbDJMpu7nGH

## 🧪 Система тестирования:

### Автоматические тесты:
```bash
# Полное тестирование (10 минут):
./test-scripts/run-all-tests.sh

# Быстрая проверка (1 минута):
./test-scripts/health-check.sh

# Тест workflow (5 минут):
./test-scripts/test-workflow.sh
```

## 📚 Дополнительная документация:

- **WORKFLOW_MANAGEMENT.md** - Управление workflows
- **TESTING_SYSTEM.md** - Система тестирования
- **CONTEXT_HISTORY.md** - История проекта
- **AI_ASSISTANT_RULES.md** - Правила для AI

## 🎯 Типичные задачи:

### Исправить ошибку в workflow:
1. `./workflow-manager.sh backup`
2. Отредактировать `correct-ai-workflow.json`
3. `./workflow-manager.sh update correct-ai-workflow.json`
4. `./workflow-manager.sh test`

### Добавить новый AI Agent:
1. Изучить структуру в `correct-ai-workflow.json`
2. Использовать `@n8n/n8n-nodes-langchain.agent`
3. Подключить OpenRouter Chat Model и Simple Memory
4. Обязательно протестировать

### Проверить работоспособность:
1. `./test-scripts/health-check.sh`
2. `./workflow-manager.sh status`
3. `./workflow-manager.sh test`

## 🆘 Если что-то сломалось:

### 1. Проверить логи:
```bash
ssh root@178.156.142.35 "docker logs root-n8n-1 | tail -20"
```

### 2. Перезапустить сервисы:
```bash
ssh root@178.156.142.35 "docker restart root-n8n-1"
```

### 3. Восстановить из backup:
```bash
./workflow-manager.sh restore
```

### 4. Полная диагностика:
```bash
./test-scripts/run-all-tests.sh
```

---

**🎯 Главное правило: ВСЕГДА тестируйте изменения перед завершением задачи!**

*Обновлено: {{ new Date().toISOString() }}*

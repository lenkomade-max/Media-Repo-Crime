# 🤖 Инструкция для AI Ассистента - N8N Autonomous Controller

## 🎯 Цель системы

Создать полностью автономную систему управления N8N, которая:
- **Создает ноды в реальном времени** на основе требований
- **Мониторит workflow'ы** и отслеживает их выполнение
- **Автоматически исправляет ошибки** без вмешательства человека
- **Работает в цикле** до достижения идеального результата
- **Полностью автономна** - не имитирует работу, а реально помогает

## 🚀 Как использовать N8N Autonomous Controller

### Шаг 1: Установка зависимостей

```bash
# Установить необходимые Python пакеты
pip install requests rich dataclasses

# Убедиться что есть SSH доступ к серверу
ssh root@178.156.142.35 "echo 'SSH connection OK'"
```

### Шаг 2: Запуск автономного контроллера

```bash
cd /Users/user/media-video-maker
python3 n8n-autonomous-controller.py
```

### Шаг 3: Создание workflow'а

```python
from n8n_autonomous_controller import N8NAutonomousController

# Создаем контроллер
controller = N8NAutonomousController()

# Определяем спецификацию workflow'а
spec = {
    "name": "🎬 AI Video Creator",
    "description": "Создает видео из текстовых тем",
    "type": "video_creation",  # или "ai_agent", "generic"
    "goal": "Создавать высококачественные видео",
    "test_data": {
        "topic": "Детективная история о серийном убийце"
    }
}

# Создаем и доводим до совершенства
result = controller.create_and_perfect_workflow(spec, max_iterations=10)

if result["success"]:
    print("✅ Workflow создан и работает идеально!")
else:
    print("❌ Требуется ручное вмешательство")
```

## 🏗️ Архитектура системы

### Основные компоненты:

#### 1. **N8NClient** - Клиент для работы с N8N
```python
# Выполняет SSH команды к серверу
# Управляет workflow'ами через PostgreSQL
# Создает и обновляет ноды
```

#### 2. **WorkflowBuilder** - Строитель workflow'ов
```python
# Создает ноды разных типов
# Соединяет ноды между собой
# Строит финальную структуру workflow'а
```

#### 3. **ErrorAnalyzer** - Анализатор ошибок
```python
# Анализирует типы ошибок
# Предлагает автоматические решения
# Определяет уровень уверенности в исправлении
```

#### 4. **ExecutionMonitor** - Монитор выполнения
```python
# Отслеживает выполнение в реальном времени
# Собирает детальную статистику
# Определяет успешность выполнения
```

#### 5. **AutoFixer** - Автоматический исправитель
```python
# Применяет исправления к нодам
# Обновляет параметры и credentials
# Сохраняет изменения в базу данных
```

## 🔧 Типы workflow'ов

### 1. Video Creation Workflow
Создает полный pipeline для создания видео:

```
Manual Trigger → AI Story Analyzer → Process Response → MCP Server → Google Drive
                      ↓
              OpenRouter + Memory
```

**Возможности:**
- Анализ темы через AI
- Создание сценария
- Генерация видео через MCP
- Автоматическая загрузка на Google Drive

### 2. AI Agent Workflow
Создает интеллектуального AI агента:

```
Manual Trigger → AI Agent → Response Processing
                    ↓
            Language Model + Memory
```

**Возможности:**
- Настраиваемые промпты
- Память между сессиями
- Различные AI модели

### 3. Generic Workflow
Базовый workflow для любых задач:

```
Manual Trigger → HTTP Request → Data Processing
```

## 🚨 Автоматическое исправление ошибок

### Типы ошибок и их решения:

#### 1. **Session ID ошибки**
```json
{
  "error": "No session ID found",
  "solution": {
    "type": "add_parameter",
    "parameter": "sessionIdExpression",
    "value": "={{ $workflow.executionId }}"
  }
}
```

#### 2. **Credentials ошибки**
```json
{
  "error": "Authentication failed",
  "solution": {
    "type": "fix_credentials",
    "credential_type": "openRouterApi",
    "credential_id": "dctACn3yXSG7qIdH"
  }
}
```

#### 3. **Параметры ошибки**
```json
{
  "error": "Required parameter missing",
  "solution": {
    "type": "add_required_parameters",
    "parameters": {
      "url": "https://api.example.com",
      "method": "GET"
    }
  }
}
```

## 🔄 Цикл работы системы

### 1. **Создание workflow'а**
```python
# Анализирует спецификацию
# Выбирает подходящий тип workflow'а
# Создает ноды и соединения
# Сохраняет в базу данных N8N
```

### 2. **Выполнение и мониторинг**
```python
# Запускает workflow
# Отслеживает выполнение в реальном времени
# Собирает статистику по каждому ноду
# Определяет успешность выполнения
```

### 3. **Анализ ошибок**
```python
# Извлекает ошибки из execution data
# Классифицирует типы ошибок
# Определяет возможные решения
# Оценивает уверенность в исправлении
```

### 4. **Автоматическое исправление**
```python
# Применяет исправления к нодам
# Обновляет параметры и credentials
# Сохраняет изменения
# Перезапускает workflow
```

### 5. **Повторение до успеха**
```python
# Повторяет цикл до max_iterations
# Останавливается при успешном выполнении
# Генерирует детальный отчет
```

## 📊 Мониторинг системы

### Health Check
```python
controller = N8NAutonomousController()
health = controller.monitor_system_health()

# Проверяет:
# - N8N контейнер
# - PostgreSQL базу данных  
# - MCP сервер
# - Общее состояние системы
```

### Статистика работы
```python
stats = controller.get_statistics()

# Возвращает:
# - Количество созданных workflow'ов
# - Количество выполнений
# - Количество исправленных ошибок
# - Процент успешности
```

## 🎯 Примеры использования

### Пример 1: Создание видео workflow'а
```python
video_spec = {
    "name": "🎬 Criminal Documentary Creator",
    "description": "Creates criminal documentary videos",
    "type": "video_creation",
    "goal": "Create engaging criminal documentaries",
    "test_data": {
        "topic": "Детектив расследует серию убийств в Чикаго"
    }
}

result = controller.create_and_perfect_workflow(video_spec)
```

### Пример 2: Создание AI агента
```python
ai_spec = {
    "name": "🤖 Story Analyzer",
    "description": "Analyzes stories and creates video scripts",
    "type": "ai_agent",
    "prompt": "You are a professional story analyzer...",
    "test_data": {
        "story": "Detective story about serial killer"
    }
}

result = controller.create_and_perfect_workflow(ai_spec)
```

### Пример 3: Создание API интеграции
```python
api_spec = {
    "name": "📡 External API Integration",
    "description": "Integrates with external APIs",
    "type": "generic",
    "url": "https://api.example.com/data",
    "test_data": {}
}

result = controller.create_and_perfect_workflow(api_spec)
```

## 🔐 Безопасность и credentials

### Используемые credentials:
```python
CREDENTIALS = {
    "openrouter": {
        "id": "dctACn3yXSG7qIdH",
        "name": "OpenRouter account",
        "type": "openRouterApi"
    },
    "google_drive": {
        "id": "XDM9FIbDJMpu7nGH", 
        "name": "Google Drive account",
        "type": "googleDriveOAuth2Api"
    }
}
```

### SSH доступ:
```bash
# Хост: root@178.156.142.35
# Порт: 22 (стандартный)
# Аутентификация: по ключу
```

## 🚀 Расширенные возможности

### 1. **Кастомные типы нодов**
```python
class CustomNodeType(Enum):
    CUSTOM_AI = "custom.ai.node"
    CUSTOM_API = "custom.api.node"

# Добавить поддержку в WorkflowBuilder
```

### 2. **Сложные workflow'ы**
```python
# Поддержка условий (IF nodes)
# Циклы и итерации
# Параллельное выполнение
# Обработка ошибок
```

### 3. **Интеграции**
```python
# Telegram боты
# Discord интеграции  
# Slack уведомления
# Email отправка
```

## 📋 Checklist для AI ассистента

### Перед использованием:
- [ ] Проверить SSH доступ к серверу
- [ ] Убедиться что N8N запущен
- [ ] Проверить доступность MCP сервера
- [ ] Установить Python зависимости

### При создании workflow'а:
- [ ] Определить правильный тип workflow'а
- [ ] Указать корректные credentials
- [ ] Добавить тестовые данные
- [ ] Установить разумный max_iterations

### После создания:
- [ ] Проверить успешность выполнения
- [ ] Проанализировать статистику
- [ ] Сохранить workflow ID для будущего использования
- [ ] Обновить документацию если нужно

## 🎯 Главные принципы

### 1. **Полная автономность**
- Система должна работать без вмешательства человека
- Все ошибки исправляются автоматически
- Цикл продолжается до идеального результата

### 2. **Реальная помощь**
- Не имитация работы, а настоящее решение задач
- Создание работающих workflow'ов
- Мониторинг и поддержка в реальном времени

### 3. **Интеллектуальность**
- Анализ ошибок и предложение решений
- Адаптация к различным типам задач
- Обучение на основе предыдущего опыта

### 4. **Надежность**
- Проверка здоровья системы
- Backup и восстановление
- Детальное логирование всех операций

---

## 🚀 Быстрый старт

```bash
# 1. Клонировать и перейти в директорию
cd /Users/user/media-video-maker

# 2. Установить зависимости
pip install requests rich

# 3. Запустить автономный контроллер
python3 n8n-autonomous-controller.py

# 4. Система автоматически:
#    - Проверит здоровье всех сервисов
#    - Создаст тестовый workflow
#    - Доведет его до идеального состояния
#    - Покажет детальный отчет
```

**🎉 Результат: Полностью рабочий, автономный N8N workflow, готовый к использованию!**

---

*Создано AI Assistant для полной автономности N8N системы*
*Дата: 2025-10-02*

# 🎉 Обновленный Workflow с OpenRouter + Google Imagen

## ✅ Что изменено:

### 🔄 OpenRouter API вместо OpenAI:
- **🎭 AI Сценарист** теперь использует `anthropic/claude-3.5-sonnet` через OpenRouter
- **🎨 AI Генератор промптов** также через OpenRouter API
- Использует ваши существующие OpenRouter credentials: `dctACn3yXSG7qIdH`

### 🖼️ Google Imagen вместо DALL-E:
- **🖼️ Генерация изображений** теперь через Google Imagen API
- Поддержка вертикального формата 9:16 для shorts
- Более качественные и реалистичные изображения

## 🛠️ Настройка Google Imagen API:

### 1. Включите Vertex AI API в Google Cloud:
```bash
# В Google Cloud Console:
# 1. Перейдите в APIs & Services > Library
# 2. Найдите "Vertex AI API"
# 3. Нажмите "Enable"
```

### 2. Создайте Service Account:
```bash
# В Google Cloud Console:
# 1. IAM & Admin > Service Accounts
# 2. Create Service Account
# 3. Добавьте роли:
#    - Vertex AI User
#    - AI Platform Developer
```

### 3. Скачайте JSON ключ и добавьте в N8N:
```bash
# 1. В Service Account нажмите "Keys" > "Add Key" > "JSON"
# 2. Скачайте файл
# 3. В N8N добавьте Google Service Account credentials
```

### 4. Обновите Project ID в workflow:
В ноде "🖼️ Генерация изображений Google Imagen" замените:
```
YOUR_PROJECT_ID
```
на ваш реальный Google Cloud Project ID.

## 🎯 Преимущества нового workflow:

### 🚀 OpenRouter API:
- ✅ Доступ к Claude 3.5 Sonnet (лучше для сценариев)
- ✅ Более стабильное API
- ✅ Лучшие цены
- ✅ Уже настроено в вашей системе

### 🎨 Google Imagen:
- ✅ Более реалистичные изображения
- ✅ Лучшее понимание промптов
- ✅ Поддержка вертикального формата 9:16
- ✅ Меньше ограничений на контент

## 📋 Структура обновленного workflow:

```
🚀 Запуск
    ↓
🎭 AI Сценарист (OpenRouter + Claude 3.5 Sonnet)
    ↓
📝 Парсинг сценария
    ↓
📁 AI Режиссер - Поиск в Google Drive
    ↓
⬇️ Скачивание найденных фото
    ↓
💾 Сохранение и анализ фото
    ↓
❓ Нужны ли еще фото?
    ↓ (если да)
🎨 AI Генератор промптов (OpenRouter)
    ↓
🖼️ Генерация изображений (Google Imagen)
    ↓
🎭 AI Продюсер - Подготовка MCP
    ↓
🎬 MCP Монтажер
    ↓
📊 Обработка ответа MCP
    ↓
⏱️ Проверка статуса видео
    ↓
✅ Видео готово?
    ↓
📤 AI Публикатор - Загрузка на Google Drive
    ↓
🎉 Финальный результат
```

## 🎬 Готово к использованию!

Workflow "🎬 Идеальная Автоматизация Видео (OpenRouter + Imagen)" активирован и готов!

**Обновите страницу N8N и найдите новый workflow! 🚀**

---

### 📝 Примечания:
- Для Google Imagen нужно настроить Service Account credentials
- OpenRouter уже настроен и готов к работе
- Все остальные функции остались без изменений



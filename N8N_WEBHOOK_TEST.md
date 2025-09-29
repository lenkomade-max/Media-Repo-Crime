# 🧪 Тестирование Webhook в n8n

## 📡 Что делает Webhook endpoint

Новый endpoint: `POST /mcp/n8n/webhook/:webhookId` позволяет n8n получать данные из внешних источников.

## 🔧 Настройка в n8n

### 1. Создание Webhook Node

1. Добавьте **Webhook** node в ваш workflow
2. Установите:
   - **Webhook path**: `test-webhook` (или любой уникальный ID)
   - **HTTP Method**: `POST`
   - **Response**: `Return response with data`

### 2. Получение URL

n8n автоматически сгенерирует URL типа:
```
https://YOUR_N8N_DOMAIN/webhook/test-webhook
```

**ВНЕШНИЙ ТЕСТ:**
```bash
curl -X POST https://YOUR_N8N_DOMAIN/webhook/test-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://178.156.142.35:5123/mcp/n8n/info"
  }'
```

## 🧪 Тестирование интеграции

### Этап 1: Тест обычного webhook

```bash
# Простой тест webhook endpoint
curl -X POST http://178.156.142.35:5123/mcp/n8n/webhook/test123 \
  -H "Content-Type: application/json" \
  -d '{
    "test": true,
    "message": "Тест от curl",
    "timestamp": "2025-01-27T12:00:00Z"
  }'
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "webhookId": "test123",
  "received": true,
  "timestamp": "2025-09-29T12:00:00Z",
  "data": {
    "test": true,
    "message": "Тест от curl",
    "timestamp": "2025-01-27T12:00:00Z"
  }
}
```

### Этап 2: Тест создания видео с webhook

```bash
# Создание видео через n8n интеграцию
curl -X POST http://178.156.142.35:5123/mcp/tools/media-video \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "id": "n8n-test-job",
        "src": "/test/image1.jpg", 
        "type": "photo",
        "durationSec": 3
      }
    ],
    "width": 1080,
    "height": 1920,
    "outputFormat": "mp4",
    "webhook": {
      "url": "https://YOUR_N8N_DOMAIN/webhook/test-webhook",
      "events": ["done", "error"]
    }
  }'
```

### Этап 3: Проверка webhook логов

```bash
# Проверяем логи webhook (на сервере)
ssh root@178..156.142.35
ls -la /root/media-video-maker/output/webhook_*

# Смотрим содержимое последнего webhook
tail -20 /root/media-video-maker/output/webhook_*.json
```

## 🔽 Workflow для тестирования в n8n

### Простой Workflow:

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "test-webhook",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Http Request",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "http://178.156.142.35:5123/mcp/tools/media-video",
        "method": "POST",
        "json": {
          "files": [
            {
              "id": "{{ $json.id }}",
              "src": "{{ $json.imagePath }}",
              "type": "photo",
              "durationSec": 3
            }
          ],
          "width": 1080,
          "height": 1920,
          "webhook": {
            "url": "{{ $node['Webhook'].json['webhookUrl'] }}"
          }
        }
      }
    }
  ]
}
```

## 📋 Пошаговая инструкция

### Шаг 1: Настройка n8n

1. Откройте ваш n8n workflow
2. Добавьте **Webhook** node
3. Настройте:
   - Path: `media-test`
   - Method: `POST`
   - Response: JSON

4. **Активируйте** workflow (важно!)

### Шаг 2: Получение webhook URL

В n8n Webhook node покажет URL типа:
```
https://your-n8n-d.com/webhook/media-test
```

### Шаг 3: Тестовый вызов извне

```bash
# Тест из команды или Postman
curl -X POST https://your-n8n-d.com/webhook/media-test \
  -H "Content-Type: application/json" \
  -d '{
    "id": "manual-test",
    "imagePath": "/test/images/photo1.jpg",
    "webhookUrl": "https://your-n8n-d.com/webhook/media-test"
  }'
```

### Шаг 4: Проверка в n8n

В n8n workflow должен увидеть:
- Данные в Webhook node
- Выполнившийся Http Request node
- Созданное задание на сервер

### Шаг 5: Мониторинг статуса

```javascript
// В V8 коде для получения статуса
const jobId = items[0].json.id;
const statusUrl = `http://178.156.142.35:5123/mcp/status/${jobId}`;

return [{ json: { statusUrl, jobId } }];
```

## 🔍 Диагностика проблем

### Проверка доступности n8n:

```bash
# Проверка работает ли ваш n8n
curl -I https://your-n8n-domain.com

# Проверка webhook endpoint
curl -X POST https://your-n8n-domain.com/webhook/test-endpoint \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Проверка нашего сервера:

```bash
# Проверка MCP сервера
curl http://178.156.142.35:5123/mcp/ping

# Проверка webhook endpoint
curl http://178.156.142.35:5123/mcp/n8n/info

# Тест прямого webhook вызова
curl -X POST http://178.156.142.35:5123/mcp/n8n/webhook/direct-test \
  -H "Content-Type: application/json" \
  -d '{"direct": "test"}'
```

## 📞 Что делать если не работает

1. **Проверьте что workflow активен** в n8n
2. **Убедитесь что webhook URL правильный**
3. **Проверьте firewall** - может блокировать запросы
4. **Проверьте логи n8n** на наличие ошибок
5. **Используйте простой curl тест** сначала

---

**Готов к тестированию!** 🧪

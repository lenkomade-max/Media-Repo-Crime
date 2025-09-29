# 🔗 MCP Server Webhook - Подключение к нашему серверу

## 🎯 **Наш MCP Server**

**Основной URL**: `http://178.156.142.35:5123`

## 📡 **Доступные webhook endpoints:**

### **1. Наш собственный webhook endpoint**
```
POST http://178.156.142.35:5123/mcp/n8n/webhook/YOUR_WEBHOOK_ID
```

### **2. Информация о webhook**
```
GET http://178.156.142.35:5123/mcp/n8n/info
```

## 🔧 **Варианты подключения:**

### **Вариант A: Простой HTTP Request в n8n**

1. **Создайте HTTP Request node** в n8n
2. **Настройки**:
   ```
   Method: POST
   URL: http://178.156.142.35:5123/mcp/tools/media-video
   Headers: Content-Type: application/json
   Body:
   {
     "files": [
       {
         "id": "test-video",
         "src": "/path/to/image.jpg",
         "type": "photo",
         "durationSec": 3
       }
     ],
     "width": 1080,
     "height": 1920,
     "webhook": {
       "url": "ВЕБХУК_URL_ЗАВЕРШЕНИЯ"
     }
   }
   ```

3. **Response**: Получите `jobId` в ответе
4. **Проверка статуса**: Опрос через `GET http://178.156.142.35:5123/mcp/status/{jobId}`

### **Вариант B: Webhook → HTTP Request**

1. **Webhook node** (принимает триггеры)
2. **HTTP Request node** (отправляет на наш сервер)

**Настройка HTTP Request:**
```json
{
  "method": "POST",
  "url": "http://178.156.142.35:5123/mcp/tools/media-video",
  "body": {
    "files": [
      {
        "id": "{{ $json.jobId }}",
        "src": "{{ $json.imagePath }}",
        "type": "photo", 
        "durationSec": {{ $json.duration || 3 }}
      }
    ],
    "width": 1080,
    "height": 1920,
    "webhook": {
      "url": "{{ $node['Webhook'].json['webhookUrl'] }}"
    }
  }
}
```

### **Вариант C: Server-Sent Events (SSE)**

1. **Webhook node** для получения данных
2. **Function node с fetch** для мониторинга SSE

```javascript
// В Function node
const eventSource = new EventSource('http://178.156.142.35:5123/mcp/sse');
eventSource.addEventListener('job', (event) => {
  const jobData = JSON.parse(event.data);
  if (jobData.state === 'done') {
    // Отправляем результат в следующий шаг
    return [{ json: jobData }];
  }
});
```

## 🧪 **Тестирование подключения:**

### **Шаг 1: Проверка доступности**
```bash
curl http://178.156.142.35:5123/mcp/ping
```

### **Шаг 2: Информация о endpoints**
```bash
curl http://178.156.142.35:5123/mcp/n8n/info
```

### **Шаг 3: Тест создания задачи**
```bash
curl -X POST http://178.156.142.35:5123/mcp/tools/media-video \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"id": "test", "src": "/test/image.jpg", "type": "photo", "durationSec": 2}
    ],
    "width": 720,
    "height": 1280
  }'
```

**Ответ:**
```json
{
  "ok": true,
  "id": "job-uuid-here",
  "webhookConfigured": false,
  "statusUrl": "http://178.156.142.35:5123/mcp/status/job-uuid-here",
  "n8nWebhook": null
}
```

### **Шаг 4: Проверка статуса**
```bash
curl http://178.156.142.35:5123/mcp/status/JOB_ID
```

## 📋 **Пример полноценного workflow в n8n:**

### **1. Manual Trigger**
- Запуск вручную для тестирования

### **2. HTTP Request (создание видео)**
```json
{
  "method": "POST",
  "url": "http://178.156.142.35:5123/mcp/tools/media-video",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "files": [
      {
        "id": "{{ $json.imageId }}",
        "src": "{{ $json.imagePath }}",
        "type": "photo",
        "durationSec": {{ $json.duration }}
      }
    ],
    "width": 1920,
    "height": 1080,
    "outputFormat": "mp4"
  }
}
```

### **3. Wait** 
- Ожидание 30 секунд

### **4. HTTP Request (проверка статуса)**
```json
{
  "method": "GET", 
  "url": "http://178.156.142.35:5123/mcp/status/{{ $node['HTTP Request'].json['id'] }}"
}
```

### **5. IF (статус проверка)**
```javascript
const status = items[0].json.state;
if (status === 'done') {
  return true;
}
return false;
```

### **6. Google Drive/Slack/Email**
- Отправка результата

## 🔍 **Диагностика проблем:**

### **Webhook не отвечает:**
```bash
# Проверь внешний доступ
curl http://178.156.142.35:5123/mcp/ping
```

### **Задача не создается:**
```bash
# Проверь логи сервера
docker logs mcp-final-webhook | tail -20
```

### **Статус не обновляется:**
```bash
# Проверь очередь задач
curl http://178.156.142.35:5123/mcp/status/JOB_ID
```

## 🎯 **Готовые команды для n8n:**

### **Создание видео:**
```bash
curl -X POST http://178.156.142.35:5123/mcp/tools/media-video \
  -H "Content-Type: application/json" \
  -d '{"files":[{"id":"n8n-test","src":"/test/img.jpg","type":"photo","durationSec":2}],"width":1080,"height":1920}'
```

### **Получение статуса:**
```bash
curl http://178.156.142.35:5123/mcp/status/JOB_ID_FROM_RESPONSE
```

### **Список возможностей:**
```bash
curl http://178.156.142.35:5123/mcp/capabilities
```

---

**Все endpoints готовы для интеграции с n8n!** 🚀

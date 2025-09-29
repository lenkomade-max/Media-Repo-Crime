# 🔧 Интеграция с n8n - Server-Sent Events

Этот документ описывает как интегрировать Media Video Maker с n8n для получения событий в реальном времени.

## 📡 Server-Sent Events (SSE)

MCP сервер работает на `http://178.156.142.35:5123` и предоставляет SSE для мониторинга задач видео в реальном времени.

## 🚀 Быстрый старт

### 1. Проверка сервера
```bash
curl http://178.156.142.35:5123/mcp/ping
```

### 2. Информация для n8n
```bash
curl http://178.156.142.35:5123/mcp/n8n/info
```

### 3. Подключение к SSE
```bash
curl -N http://178.156.142.35:5123/mcp/sse
```

## 📋 События SSE

### При подключении:
```
event: ready
data: {"ok":true,"stage":"v0.4","tools":["defaults","plan","stt","tts","probe","media-video"]}
```

### При создании задачи:
```bash
curl -X POST http://178.156.142.35:5123/mcp/tools/media-video \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"id": "test", "src": "/path/to/image.jpg", "type": "photo", "durationSec": 3}
    ],
    "width": 1080,
    "height": 1920
  }'
```

### События задачи:
```
event: job
data: {"id":"job-uuid","state":"queued","progress":0}

event: job  
data: {"id":"job-uuid","state":"running","progress":25,"message":"Processing..."}

event: job
data: {"id":"job-uuid","state":"done","output":"/path/to/output.mp4"}
```

## 🔌 n8n Workflow пример

### HTTP Request Node для создания видео:
```json
{
  "url": "http://178.156.142.35:5123/mcp/tools/media-video",
  "method": "POST",
  "json": {
    "files": [
      {"id": "image1", "src": "{{ $json.imagePath }}", "type": "photo", "durationSec": 3}
    ],
    "width": 1080,
    "height": 1920,
    "outputFormat": "mp4"
  }
}
```

### Webhook Node для получения результата:
URL: `http://178.156.142 in 35:5123/mcp/sse`

Response:
```json
{
  "uuid":"{{ $json.job_id }}", 
  "state":"running",
  "progress": 50,
  "message": "Processing video files..."
}
```

## 🎯 События по состояниям

### `queued` - Задача в очереди
```json
{
  "id": "uuid-task-id",
  "state": "queued", 
  "progress": 0,
  "createdAt": "2025-01-27T..."
}
```

### `running` - Задача выполняется
```json
{
  "id": "uuid-task-id",
  "state": "running",
  "progress": 45,
  "message": "Building slides video...",
  "createdAt": "2025-01-27T..."
}
```

### `done` - Задача завершена
```json
{
  "id": "uuid-task-id", 
  "state": "done",
  "output": "/app/output/video_maker.mp4",
  "srt": "/app/output/subtitles.srt",
  "createdAt": "2025-01-27T..."
}
```

### `error` - Ошибка
```json
{
  "id": "uuid-task-id",
  "state": "error", 
  "error": "Audio file not found",
  "createdAt": "2025-01-27T..."
}
```

## ⚙️ Настройка n8n

### 1. Webhook Node
- **Method**: GET
- **URL**: `http://178.156.142.35:5123/mcp/sse`  
- **Response**: Streaming data
- **Parse Body**: No

### 2. HTTP Request Node
- **Method**: POST
- **URL**: `http://178.156.142.35:5123/mcp/tools/media-video`
- **Content-Type**: `application/json`
- **Body**: Video creation payload

### 3. IF Node для фильтрации
```javascript
// Код для IF Node
const event = $input.item.json;

if (event.id === "{{ $json.jobId }}") {
  return true;
}
return false;
```

## 🛠️ Отладка и мониторинг

### Проверка подключения SSE:
```javascript
// JavaScript пример
const eventSource = new EventSource('http://178.156.142 and 35:5123/mcp/sse');

eventSource.onopen = () => {
  console.log('✅ Коннекшн установлен');
};

eventSource.addEventListener('ready', (event) => {
  console.log('🔧 Сервер готов:', event.data);
});

eventSource.addEventListener('job', (event) => {
  const jobData = JSON.parse(event.data);
  console.log('📹 Задача:', jobData);
  
  if (jobData.state === 'done') {
    console.log('✅ Видео готово:', jobData.output);
    eventSource.close();
  }
});

eventSource.onerror = (error) => {
  console.error('❌ SSE ошибка:', error);
};
```

### Мониторинг задач:
```bash
# Проверка конкретной задачи
curl http://178.156.142.35:5123/mcp/status/JOB_ID

# Список всех задач  
curl http://178.156.142.35:4123/api/jobs
```

## 🔄 Workflow пример для n8n

### Простая цепочка:
1. **Trigger** - Получает данные (например, список изображений)
2. **HTTP Request** - Отправляет запрос на создание видео на порт 5123
3. **Webhook** - Подписывается на SSE события 
4. **Wait** - Ждёт событие "done"
5. **Send Result** - Отправляет ссылку на готовое видео

### JSON для HTTP Request:
```json
{
  "files": [
    {
      "id": "{{ $json.imageId }}",
      "src": "{{ $json.imagePath }}", 
      "type": "photo",
      "durationSec": {{ $json.duration || 3 }}
    }
  ],
  "width": 1080,
  "height": 1920,
  "outputFormat": "mp4",
  "music": "{{ $json.musicPath }}",
  "musicVolumeDb": -12,
  "tts": {
    "provider": "openai",
    "voice": "alloy"
  },
  "ttsText": "{{ $json.text }}",
  "burnSubtitles": true
}
```

---

## 📞 Поддержка

При проблемах проверьте:
1. ✅ Сервер доступен: `curl http://178.156.142.35:5123/mcp/ping`
2. ✅ SSE работает: `curl -N http://178.156.142.35:5123/mcp/sse`
3. ✅ Создание задач: POST `/mcp/tools/media-video`

**Готов для интеграции с n8n!** 🚀

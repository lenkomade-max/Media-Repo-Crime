# 🌟 Примеры использования Media Video Maker API

API работает на порту **4123**: `http://localhost:4123`

## 🔍 1. Проверка работоспособности

```bash
curl http://localhost:4123/api/ping
```

**Ответ:**
```json
{
  "status": "ok",
  "version": "2.1-main", 
  "service": "media-video-maker",
  "memory": {"used": 45, "total": 128, "unit": "MB"},
  "uptime": 3600,
  "endpoints": {
    "capabilities": "/api/capabilities",
    "createVideo": "POST /api/create-video"
  },
  "message": "🎬 Media Video Maker API работает отлично!"
}
```

## 📊 2. Возможности сервиса

```bash
curl http://localhost:4123/api/capabilities
```

**Ответ:**
```json
{
  "supportedFormats": {
    "input": ["jpg", "jpeg", "png", "webp", "mp4", "mov"],
    "output": ["mp4", "mov"]
  },
  "tts": {
    "providers": ["kokoro", "openai", "none"],
    "voices": ["alloy", "echo", "fable", "onyx"]
  },
  "effects": {
    "zoom": {"enabled": true, "description": "Плавное масштабирование"},
    "vhs": {"enabled": true, "description": "Винтажный VHS эффект"},
    "retro": {"enabled": true, "description": "Ретро стилизация"}
  },
  "limits": {
    "maxFiles": 50,
    "maxDurationMinutes": 30,
    "maxResolution": "4K"
  }
}
```

## 🎥 3. Создание простого видео

```bash
curl -X POST http://localhost:4123/api/create-video \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "id": "img1",
        "src": "/path/to/image1.jpg",
        "type": "photo",
        "durationSec": 3
      },
      {
        "id": "vid1", 
        "src": "/path/to/video1.mp4",
        "type": "video"
      }
    ],
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "durationPerPhoto": 2.0,
    "outputFormat": "mp4"
  }'
```

**Ответ:**
```json
{
  "id": "uuid-job-hash",
  "status": "queued",
  "progress": 0,
  "files": 2,
  "duration": 4,
  "resolution": "1080x1920",
  "createdAt": "2025-01-27T...",
  "webhooks": {
    "status": "http://localhost:4123/api/status/uuid-job-hash",
    "sse": "http://localhost:5123/mcp/sse"
  }
}
```

## 📈 4. Проверка статуса задачи

```bash
curl http://localhost:4123/api/status/{job-id}
```

**Во время выполнения:**
```json
{
  "id": "uuid-job-hash",
  "state": "running",
  "progress": 45,
  "message": "Processing video files...",
  "timestamp": "2025-01-27T...",
  "elapsed": 125000,
  "eta": 152000
}
```

**После завершения:**
```json
{
  "id": "uuid-job-hash", 
  "state": "done",
  "output": "/app/output/video_uuid.mp4",
  "srt": "/app/output/video_uuid.srt",
  "timestamp": "2025-01-27T..."
}
```

## 📋 5. Список всех задач

```bash
curl "http://localhost:4123/api/jobs?limit=10&offset=0"
```

**Ответ:**
```json
{
  "jobs": [
    {
      "id": "uuid-1",
      "state": "done",
      "output": "/app/output/video_1.mp4",
      "createdAt": 1738001045000
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 15,
    "hasMore": true
  }
}
```

## ❌ 6. Отмена задачи

```bash
curl -X DELETE http://localhost:4123/api/jobs/{job-id}
```

**Ответ:**
```json
{
  "id": "uuid-job-hash",
  "status": "cancelled",
  "message": "Задача успешно отменена",
  "timestamp": "2025-01-27T..."
}
```

## 🎭 7. Сложные эффекты и оверлеи

```bash
curl -X POST http://localhost:4123/api/create-video \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "id": "slide1",
        "src": "/images/presentation.jpg",
        "type": "photo",
        "durationSec": 5
      }
    ],
    "width": 1920,
    "height": 1080,
    "effects": [
      {
        "kind": "zoom",
        "startSec": 1,
        "endSec": 4,
        "params": {
          "startScale": 1.0,
          "endScale": 1.2,
          "cx": 0.5,
          "cy": 0.3
        }
      }
    ],
    "overlays": [
      {
        "target": "top",
        "text": "Заголовок презентации",
        "startSec": 0,
        "endSec": 5,
        "style": {
          "font": "DejaVu Sans Bold",
          "size": 48,
          "color": "#FFFFFF",
          "background": "rgba(0,0,0,0.7)",
          "outlineWidth": 2
        }
      },
      {
        "target": "rect", 
        "startSec": 1,
        "endSec": 3,
        "position": {"x": 100, "y": 200},
        "shape": {
          "w": 300,
          "h": 150,
          "color": "#FF0000",
          "thickness": 4,
          "fillOpacity": 0.1
        }
      }
    ],
    "music": "/path/to/background.mp3",
    "musicVolumeDb": -12,
    "tts": {
      "provider": "openai",
      "voice": "alloy",
      "model": "tts-1"
    },
    "ttsText": "Добро пожаловать на презентацию! Сегодня мы обсудим новые возможности.",
    "burnSubtitles": true
  }'
```

## 🚨 Коды ошибок

| Код | Описание |
|-----|----------|
| `VALIDATION_ERROR` | Ошибка валидации входных данных |
| `EMPTY_FILES` | Минимум один медиафайл требуется |
| `TOO_MANY_FILES` | Максимум 50 файлов |
| `4K_FILE_LIMIT` | Для 4K максимум 10 файлов |
| `NOT_FOUND` | Задача не найдена |
| `INTERNAL_ERROR` | Внутренняя ошибка сервера |

## 🔗 Интеграция с n8n/MCP

Для автоматизации используйте MCP сервер на порту **5123**:

```bash
# SSE для получения событий в реальном времени
curl -N http://localhost:5123/mcp/sse

# Создание задачи через MCP
curl -X POST http://localhost:5123/mcp/tools/media-video \
  -H "Content-Type: application/json" \
  -d '{"files":[{"id":"test","src":"/path/to/file.jpg","type":"photo"}]}'
```

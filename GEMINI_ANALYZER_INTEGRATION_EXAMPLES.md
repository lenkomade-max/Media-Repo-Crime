# Примеры интеграции Gemini Video Analyzer

## 1. Базовый пример запроса

```bash
curl -X POST http://localhost:3000/analyze \
  -F "video=@test_video.mp4" \
  -F "callback_url=http://178.156.142.35:4123/api/analysis-callback" \
  -F "analysis_duration=8"
```

## 2. Пример ответа от Gemini Analyzer

```json
{
  "video_id": "abc123",
  "analysis": {
    "subtitles": true,
    "voiceover": true,
    "music_or_sfx": true,
    "visual_effects": ["VHS", "overlay", "blur"],
    "slides_or_text": true,
    "analysis_confidence": 0.95,
    "video_duration_analyzed": 8.5,
    "detected_language": "en",
    "audio_quality": "good",
    "visual_quality": "medium"
  },
  "timestamp": "2025-10-03T17:30:00Z",
  "processing_time_ms": 2500
}
```

## 3. Callback на наш сервер

```bash
POST http://178.156.142.35:4123/api/analysis-callback
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "video_id": "abc123",
  "source": "gemini-analyzer",
  "analysis": {
    "subtitles": true,
    "voiceover": true,
    "music_or_sfx": true,
    "visual_effects": ["VHS", "overlay"],
    "slides_or_text": false
  },
  "metadata": {
    "analyzer_version": "1.0.0",
    "processing_time_ms": 2500,
    "confidence": 0.95
  }
}
```

## 4. Интеграция с нашим Media Server

### Наш сервер должен иметь endpoint:
```javascript
// В media-server.ts
app.post('/api/analysis-callback', async (req, res) => {
  const { video_id, analysis } = req.body;
  
  // Сохраняем результат анализа
  await saveAnalysisResult(video_id, analysis);
  
  // Обновляем статус видео
  await updateVideoStatus(video_id, 'analyzed');
  
  res.json({ status: 'received' });
});
```

## 5. Примеры различных типов видео

### Видео с субтитрами
```json
{
  "subtitles": true,
  "voiceover": false,
  "music_or_sfx": false,
  "visual_effects": [],
  "slides_or_text": false
}
```

### Видео с озвучкой и музыкой
```json
{
  "subtitles": false,
  "voiceover": true,
  "music_or_sfx": true,
  "visual_effects": [],
  "slides_or_text": true
}
```

### Видео с эффектами
```json
{
  "subtitles": false,
  "voiceover": true,
  "music_or_sfx": true,
  "visual_effects": ["VHS", "grain", "overlay"],
  "slides_or_text": true
}
```

## 6. Конфигурация для разработчика

### config.json
```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "gemini": {
    "api_key": "YOUR_GEMINI_API_KEY",
    "model": "gemini-2.5-pro",
    "max_tokens": 1000
  },
  "callback": {
    "default_url": "http://178.156.142.35:4123/api/analysis-callback",
    "timeout": 10000,
    "retry_attempts": 3
  },
  "upload": {
    "max_file_size": "100MB",
    "allowed_formats": ["mp4", "avi", "mov", "mkv", "webm"],
    "temp_dir": "./uploads"
  }
}
```

### .env
```bash
GEMINI_API_KEY=your_gemini_api_key_here
CALLBACK_URL=http://178.156.142.35:4123/api/analysis-callback
PORT=3000
NODE_ENV=production
```

## 7. Docker Compose для тестирования

```yaml
version: '3.8'
services:
  gemini-analyzer:
    build: .
    ports:
      - "3000:3000"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - CALLBACK_URL=http://178.156.142.35:4123/api/analysis-callback
    volumes:
      - ./uploads:/app/uploads
    restart: unless-stopped

  # Для тестирования интеграции
  test-client:
    image: curlimages/curl
    depends_on:
      - gemini-analyzer
    command: |
      sh -c "
        sleep 10 &&
        curl -X POST http://gemini-analyzer:3000/analyze \
          -F 'video=@/test/test_video.mp4' \
          -F 'callback_url=http://178.156.142.35:4123/api/analysis-callback'
      "
```

## 8. Мониторинг и логирование

### Health check
```bash
curl http://localhost:3000/health
```

Ответ:
```json
{
  "status": "healthy",
  "gemini_api": "connected",
  "callback_url": "http://178.156.142.35:4123/api/analysis-callback",
  "uptime": 3600,
  "processed_videos": 150
}
```

### Логи
```json
{
  "timestamp": "2025-10-03T17:30:00Z",
  "level": "info",
  "message": "Video analysis completed",
  "video_id": "abc123",
  "processing_time_ms": 2500,
  "analysis_result": {
    "subtitles": true,
    "voiceover": true
  }
}
```

## 9. Обработка ошибок

### Ошибка Gemini API
```json
{
  "error": "gemini_api_error",
  "message": "Failed to analyze video",
  "details": "API quota exceeded",
  "video_id": "abc123"
}
```

### Ошибка callback
```json
{
  "error": "callback_failed",
  "message": "Failed to send callback",
  "details": "Connection timeout",
  "retry_count": 2
}
```

## 10. Тестирование с нашим сервером

### Проверка интеграции
```bash
# 1. Запустить analyzer
docker run -p 3000:3000 gemini-analyzer

# 2. Отправить тестовое видео
curl -X POST http://localhost:3000/analyze \
  -F "video=@test_video.mp4" \
  -F "callback_url=http://178.156.142.35:4123/api/analysis-callback"

# 3. Проверить callback на нашем сервере
curl http://178.156.142.35:4123/api/analysis-results/abc123
```

---

**Важно**: Убедитесь, что наш сервер (178.156.142.35:4123) доступен для callback запросов от analyzer'а.

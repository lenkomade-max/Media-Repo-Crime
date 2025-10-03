# Gemini Video Analyzer - Техническое задание

## Обзор проекта
Создать минимальное веб-приложение (API-сервис) для анализа видеофайлов с использованием Gemini 2.5 API.

## Функциональность

### Основной endpoint
- **POST /analyze** - принимает видеофайл через multipart/form-data
- Анализирует первые 5-10 секунд видео
- Возвращает JSON с результатами анализа

### Анализируемые элементы
1. **Встроенные субтитры** (burned-in subtitles)
2. **Озвучка/голосовое сопровождение** (voiceover/narration)
3. **Звуковые эффекты или музыка** (music/sound effects)
4. **Графические эффекты** (VHS-эффект, overlay-эффекты, фильтры)
5. **Слайды/текстовые вставки** (text overlays, slides)

### Формат ответа
```json
{
  "subtitles": true,
  "voiceover": true,
  "music_or_sfx": true,
  "visual_effects": ["VHS", "overlay", "blur"],
  "slides_or_text": false,
  "analysis_confidence": 0.95,
  "video_duration_analyzed": 8.5
}
```

### Callback система
- Отправляет результат на указанный URL через POST запрос
- URL настраивается в конфиге
- Retry логика для неудачных отправок

## Технические требования

### Backend
- **Node.js + Express** или **Python + FastAPI/Flask**
- Минимальные зависимости
- Чистая архитектура

### API интеграция
- **Gemini 2.5 API** для анализа видео
- Обработка multipart/form-data
- Валидация входных файлов

### Конфигурация
```json
{
  "gemini_api_key": "YOUR_GEMINI_API_KEY",
  "callback_url": "http://your-server.com/callback",
  "max_file_size": "100MB",
  "supported_formats": ["mp4", "avi", "mov", "mkv"],
  "analysis_duration": 10
}
```

## Интеграция с существующей системой

### Наш сервер (178.156.142.35)
- **Media Server**: http://178.156.142.35:4123
- **Kokoro TTS**: http://178.156.142.35:11402
- **MCP Server**: http://178.156.142.35:5123

### Пример использования
```bash
# Отправка видео на анализ
curl -X POST http://your-analyzer:3000/analyze \
  -F "video=@test_video.mp4" \
  -F "callback_url=http://178.156.142.35:4123/api/analysis-callback"

# Callback будет отправлен на наш сервер
POST http://178.156.142.35:4123/api/analysis-callback
Content-Type: application/json

{
  "video_id": "abc123",
  "analysis": {
    "subtitles": true,
    "voiceover": false,
    "music_or_sfx": true,
    "visual_effects": ["VHS"],
    "slides_or_text": true
  }
}
```

## Структура проекта

```
video-analyzer/
├── src/
│   ├── routes/
│   │   └── analyze.js
│   ├── services/
│   │   ├── gemini.js
│   │   └── callback.js
│   ├── utils/
│   │   ├── fileValidator.js
│   │   └── videoProcessor.js
│   └── app.js
├── config/
│   └── config.json
├── package.json
└── README.md
```

## Примеры реализации

### Node.js + Express
```javascript
const express = require('express');
const multer = require('multer');
const { analyzeVideo } = require('./services/gemini');
const { sendCallback } = require('./services/callback');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/analyze', upload.single('video'), async (req, res) => {
  try {
    const analysis = await analyzeVideo(req.file.path);
    await sendCallback(analysis, req.body.callback_url);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Python + FastAPI
```python
from fastapi import FastAPI, File, UploadFile, Form
from services.gemini import analyze_video
from services.callback import send_callback

app = FastAPI()

@app.post("/analyze")
async def analyze(
    video: UploadFile = File(...),
    callback_url: str = Form(...)
):
    analysis = await analyze_video(video.file)
    await send_callback(analysis, callback_url)
    return analysis
```

## Дополнительные требования

### Безопасность
- Валидация типов файлов
- Ограничение размера файлов
- Rate limiting
- API key для Gemini

### Мониторинг
- Логирование запросов
- Метрики производительности
- Health check endpoint

### Обработка ошибок
- Graceful degradation
- Retry механизм для callbacks
- Детальные error messages

## Тестирование

### Unit тесты
- Анализ различных типов видео
- Валидация входных данных
- Callback отправка

### Integration тесты
- Полный цикл: видео → анализ → callback
- Тестирование с реальными видеофайлами
- Проверка интеграции с нашим сервером

## Деплой

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment variables
```bash
GEMINI_API_KEY=your_key_here
CALLBACK_URL=http://178.156.142.35:4123/api/analysis-callback
PORT=3000
MAX_FILE_SIZE=100MB
```

## Критерии готовности

1. ✅ Принимает видео через POST /analyze
2. ✅ Анализирует с помощью Gemini 2.5 API
3. ✅ Возвращает JSON с результатами
4. ✅ Отправляет callback на наш сервер
5. ✅ Обрабатывает ошибки gracefully
6. ✅ Имеет health check endpoint
7. ✅ Логирует все операции
8. ✅ Готов к деплою в Docker

## Контакты для интеграции

- **Наш сервер**: 178.156.142.35
- **Media Server API**: http://178.156.142.35:4123/api/
- **Callback endpoint**: http://178.156.142.35:4123/api/analysis-callback

---

**Примечание**: Это приложение будет интегрировано в существующую систему медиа-обработки. Убедитесь, что callback URL корректно настроен для отправки результатов на наш сервер.

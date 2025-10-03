# Инструкция для разработчика: Добавление API к Gemini Video Analyzer

## Ситуация
Ваш фронтенд приложение отлично работает! Но нам нужен **серверный API** для интеграции с нашей системой.

## Что нужно добавить (15-30 минут):

### 1. Установить зависимости
```bash
npm install express multer
```

### 2. Создать server.js
```javascript
const express = require('express');
const multer = require('multer');
const app = express();

const upload = multer({ dest: 'uploads/' });

// Использовать вашу существующую логику анализа
app.post('/api/analyze', upload.single('video'), async (req, res) => {
  try {
    // Здесь использовать вашу функцию analyzeVideo
    const analysis = await analyzeVideo(req.file);
    
    // Отправить callback на наш сервер
    if (req.body.callback_url) {
      await fetch(req.body.callback_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: Date.now().toString(),
          analysis: analysis,
          timestamp: new Date().toISOString()
        })
      });
    }
    
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('API server running on port 3000');
});
```

### 3. Запустить сервер
```bash
node server.js
```

## Что нам нужно:

✅ **POST /api/analyze** - принимает видео + callback_url  
✅ **Callback на наш сервер**: `http://178.156.142.35:4123/api/analysis-callback`  
✅ **JSON ответ** в вашем формате  

## Формат ответа (как у вас):
```json
{
  "subtitles": true,
  "voiceover": false,
  "music_or_sfx": false,
  "visual_effects": ["VHS", "overlay"],
  "slides_or_text": true,
  "analysis_confidence": 0.95
}
```

## Тестирование:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "video=@test_video.mp4" \
  -F "callback_url=http://178.156.142.35:4123/api/analysis-callback"
```

## Важно:
- Используйте вашу **существующую логику анализа**
- НЕ нужно переписывать ничего
- Просто оберните в Express endpoint
- Добавьте callback отправку

## Наш сервер:
- **IP**: 178.156.142.35
- **Callback URL**: http://178.156.142.35:4123/api/analysis-callback
- **Media Server**: http://178.156.142.35:4123

## Результат:
После этого мы сможем интегрировать ваше приложение с нашей системой медиа-обработки!

---

**Вопросы?** Пишите, поможем с интеграцией!

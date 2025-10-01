# 🚀 Быстрый старт для AI помощника

## Что нужно знать при запуске проекта

### 1. **Обязательные файлы для скачивания:**
```
media-video-maker_server/kokoro-v1.0.onnx  (310MB)
media-video-maker_server/voices-v1.0.bin   (веса для TTS)
```

### 2. **Команды запуска:**
```bash
cd media-video-maker_server
npm install
npm run dev  # или npm start
```

### 3. **Порты:**
- REST API: http://localhost:3000
- MCP Server: http://localhost:3001

### 4. **Основные эндпоинты:**
- `POST /api/create-video` - создание видео
- `GET /api/status/:id` - статус задачи
- `POST /mcp/tools/media-video` - MCP создание видео

### 5. **Структура JSON плана:**
```json
{
  "files": [{"id": "img1", "src": "image.jpg", "type": "image"}],
  "width": 1080, "height": 1920, "fps": 30,
  "music": "music.mp3",
  "tts": {"provider": "kokoro", "text": "Текст"},
  "transcribeAudio": true,
  "burnSubtitles": true,
  "overlays": [{"type": "text", "text": "Заголовок"}],
  "effects": [{"kind": "zoom", "params": {"startScale": 1.0, "endScale": 1.2}}]
}
```

### 6. **Возможности:**
- ✅ Видео из изображений
- ✅ Фоновая музыка
- ✅ TTS озвучка (Kokoro/OpenAI)
- ✅ Авто субтитры (Whisper)
- ✅ Текстовые оверлеи
- ✅ Эффекты (zoom, VHS, retro)
- ✅ 4K поддержка

### 7. **Требования:**
- Node.js 18+
- FFmpeg
- Python 3.8+ (Whisper)
- 4GB+ RAM

### 8. **Готовые видео сохраняются в:**
- `media-video-maker_server/out/`
- `media-video-maker_server/assets/`

### 9. **Логи:**
- `server.log` - общие
- `api_server.log` - REST API
- `job_*/` - задачи

### 10. **Проблемы:**
- Нет `kokoro-v1.0.onnx` → скачать модель
- FFmpeg ошибка → проверить установку
- Порт занят → изменить в `src/index.ts`

---
**Готово к работе!** 🎬

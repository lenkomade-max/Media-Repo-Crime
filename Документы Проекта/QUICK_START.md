# 🚀 Быстрый старт для AI помощника

## Что нужно знать при запуске проекта

### 1. **Обязательные файлы для скачивания:**
```
media-video-maker_server/kokoro_tss_server.py (Kokoro TTS API сервер)
media-video-maker_server/voices-v1.0.bin   (веса для TTS)
```

### 2. **Команды запуска:**
```bash
cd media-video-maker_server
npm install
npm run dev  # или npm start
```

### 3. **Порты:**
- REST API: http://localhost:4123
- MCP Server: http://localhost:5123

### 4. **Основные эндпоинты:**
- `POST /api/create-video` - создание видео
- `GET /api/status/:id` - статус задачи
- `POST /mcp/tools/media-video` - MCP создание видео
- `POST /api/upload` - загрузка файлов (если реализовано)

### 5. **Структура JSON плана (локальные файлы):**
```json
{
  "files": [{"id": "img1", "src": "image.jpg", "type": "image"}],
  "width": 1080, "height": 1920, "fps": 30,
  "music": "music.mp3",
  "tts": {"provider": "kokoro", "text": "Текст", "endpoint": "http://178.156.142.35:11402/v1/tts"},
  "transcribeAudio": true,
  "burnSubtitles": true,
  "overlays": [{"type": "text", "text": "Заголовок"}],
  "effects": [{"kind": "zoom", "params": {"startScale": 1.0, "endScale": 1.2}}]
}
```

### 5.1. **JSON план с внешними URL:**
```json
{
  "files": [{"id": "img1", "src": "https://picsum.photos/800/600", "type": "image", "download": true}],
  "width": 1080, "height": 1920, "fps": 30,
  "music": "https://file-examples.com/storage/fe68c0b5b5b5b5b5b5b5b5b/2017/11/file_example_MP3_700KB.mp3",
  "musicDownload": true,
  "tts": {"provider": "none", "download": true},
  "voiceFile": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
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
- ✅ **Скачивание файлов по URL** (FileDownloader)
- ✅ **Автоочистка скачанных файлов** (CleanupService)
- ✅ **Webhook уведомления** для n8n/внешних сервисов

### 7. **Требования:**
- Node.js 18+
- FFmpeg
- Python 3.8+ (Whisper)
- 4GB+ RAM
- Интернет-соединение (для скачивания файлов)

### 8. **Готовые видео сохраняются в:**
- `media-video-maker_server/out/`
- `media-video-maker_server/assets/`
- `media-video-maker_server/assets/downloads/` (временные скачанные файлы, автоочистка)

### 9. **Логи:**
- `server.log` - общие
- `api_server.log` - REST API
- `job_*/` - задачи
- `assets/downloads/` - скачанные файлы (автоочистка)

### 10. **Проблемы:**
- Kokoro TTS не работает → запустить `python3 kokoro_tss_server.py`
- FFmpeg ошибка → проверить установку
- Порт занят → изменить в `src/index.ts` (REST: 4123, MCP: 5123)
- Ошибки скачивания → проверить URL, MIME-типы, размеры файлов
- Проблемы автоочистки → проверить права доступа к `assets/downloads/`

---
**Готово к работе!** 🎬

# Media Video Maker

Полнофункциональный сервер для создания видео с MCP и REST API.

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
cd media-video-maker_server
npm install
```

### 2. Скачать недостающие файлы
**ВАЖНО:** Скачайте недостающие файлы:
- `kokoro-v1.0.onnx` (310MB) - модель TTS Kokoro
- `voices-v1.0.bin` - веса для Kokoro TTS

Поместите их в папку `media-video-maker_server/`

### 3. Запуск сервера
```bash
# Разработка
npm run dev

# Продакшн
npm run build
npm start
```

## 📡 API Endpoints

### REST API (порт 4123)
- `GET /api/ping` - проверка статуса
- `POST /api/create-video` - создание видео
- `GET /api/status/:id` - статус задачи
- `GET /api/jobs` - список задач
- `GET /api/capabilities` - возможности сервера

### MCP Server (порт 5123)
- `POST /mcp/tools/media-video` - создание видео через MCP
- `POST /mcp/subtitles/generate` - генерация субтитров
- `POST /mcp/tts/synthesize` - синтез речи
- `POST /mcp/assets/probe` - анализ медиа файлов

## 🎬 Создание видео

### Пример JSON плана (локальные файлы):
```json
{
  "files": [
    {
      "id": "img1",
      "src": "path/to/image.jpg",
      "type": "image"
    }
  ],
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "durationPerPhoto": 2.0,
  "music": "path/to/music.mp3",
  "tts": {
    "provider": "kokoro",
    "text": "Текст для озвучки"
  },
  "transcribeAudio": true,
  "burnSubtitles": true,
  "overlays": [
    {
      "type": "text",
      "text": "Заголовок",
      "position": "top-center",
      "start": 0,
      "end": 5
    }
  ],
  "effects": [
    {
      "kind": "zoom",
      "params": {
        "startScale": 1.0,
        "endScale": 1.2
      }
    }
  ]
}
```

### Пример JSON плана (внешние URL):
```json
{
  "files": [
    {
      "id": "img1",
      "src": "https://picsum.photos/800/600",
      "type": "image",
      "download": true
    },
    {
      "id": "vid1",
      "src": "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
      "type": "video",
      "download": true
    }
  ],
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "durationPerPhoto": 2.0,
  "music": "https://file-examples.com/storage/fe68c0b5b5b5b5b5b5b5b5b/2017/11/file_example_MP3_700KB.mp3",
  "musicDownload": true,
  "tts": {
    "provider": "none",
    "download": true
  },
  "voiceFile": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
  "transcribeAudio": true,
  "burnSubtitles": true,
  "overlays": [
    {
      "type": "text",
      "text": "Заголовок",
      "position": "top-center",
      "start": 0,
      "end": 5
    }
  ],
  "effects": [
    {
      "kind": "zoom",
      "params": {
        "startScale": 1.0,
        "endScale": 1.2
      }
    }
  ]
}
```

## 🛠 Возможности

- ✅ Создание видео из изображений
- ✅ Добавление фоновой музыки
- ✅ TTS озвучка (Kokoro, OpenAI)
- ✅ Автоматические субтитры (Whisper)
- ✅ Текстовые оверлеи
- ✅ Видео эффекты (zoom, VHS, retro)
- ✅ Аудио микширование с ducking
- ✅ Поддержка 4K разрешений
- ✅ Кастомные FFmpeg фильтры
- ✅ **Скачивание файлов по URL** (FileDownloader)
- ✅ **Автоочистка скачанных файлов** (CleanupService)
- ✅ **Webhook уведомления** для n8n/внешних сервисов

## 📁 Структура проекта

```
media-video-maker_server/
├── src/
│   ├── audio/          # TTS и аудио обработка
│   ├── pipeline/       # Основной пайплайн видео
│   ├── server/         # REST и MCP серверы
│   ├── subtitles/      # Генерация субтитров
│   ├── transcribe/     # Whisper транскрипция
│   └── utils/          # Утилиты (FileDownloader, CleanupService)
├── assets/             # Медиа файлы
│   └── downloads/      # Временные скачанные файлы (автоочистка)
├── out/               # Готовые видео
└── dist/              # Скомпилированный код
```

## 🔧 Требования

- Node.js 18+
- FFmpeg
- Python 3.8+ (для Whisper)
- 4GB+ RAM
- 10GB+ свободного места
- Интернет-соединение (для скачивания файлов по URL)

## 🐛 Решение проблем

### Ошибка "kokoro-v1.0.onnx not found"
Скачайте файл модели и поместите в `media-video-maker_server/`

### Ошибка FFmpeg
Убедитесь что FFmpeg установлен: `ffmpeg -version`

### Порт занят
Измените порты в `src/index.ts` (REST: 4123, MCP: 5123)

### Ошибки скачивания файлов
- Проверьте доступность URL: `curl -I "https://example.com/file.jpg"`
- Убедитесь что URL возвращает правильный MIME-тип
- Проверьте размер файла (лимиты: фото 50MB, видео 500MB, аудио 100MB)
- Проверьте права доступа к папке `assets/downloads/`

### Проблемы автоочистки
- Проверьте права доступа к `assets/downloads/`
- Убедитесь что webhook endpoint доступен
- Проверьте логи сервера на ошибки очистки

## 📝 Логи

Логи сохраняются в:
- `server.log` - общие логи
- `api_server.log` - REST API
- `job_*/` - логи конкретных задач
- `assets/downloads/` - временные скачанные файлы (автоочистка)

## 🎯 Примеры использования

### Создание простого видео (локальные файлы):
```bash
curl -X POST http://localhost:4123/api/create-video \
  -H "Content-Type: application/json" \
  -d @example_plan.json
```

### Создание видео с внешними URL:
```bash
curl -X POST http://localhost:4123/api/create-video \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"id": "img1", "src": "https://picsum.photos/800/600", "type": "image", "download": true}
    ],
    "music": "https://file-examples.com/storage/fe68c0b5b5b5b5b5b5b5b5b/2017/11/file_example_MP3_700KB.mp3",
    "musicDownload": true,
    "width": 1080,
    "height": 1920,
    "durationPerPhoto": 2.0
  }'
```

### Через MCP:
```bash
curl -X POST http://localhost:5123/mcp/tools/media-video \
  -H "Content-Type: application/json" \
  -d @mcp_plan.json
```

## 📞 Поддержка

При проблемах проверьте:
1. Все зависимости установлены
2. FFmpeg работает
3. Порты свободны
4. Достаточно места на диске
5. Модели TTS скачаны
6. Интернет-соединение для скачивания файлов
7. URL файлов доступны и возвращают правильные MIME-типы
8. Права доступа к папке `assets/downloads/`

---
**Проект готов к использованию!** 🎉

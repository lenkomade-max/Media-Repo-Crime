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

### REST API (порт 3000)
- `GET /api/ping` - проверка статуса
- `POST /api/create-video` - создание видео
- `GET /api/status/:id` - статус задачи
- `GET /api/jobs` - список задач
- `GET /api/capabilities` - возможности сервера

### MCP Server (порт 3001)
- `POST /mcp/tools/media-video` - создание видео через MCP
- `POST /mcp/subtitles/generate` - генерация субтитров
- `POST /mcp/tts/synthesize` - синтез речи
- `POST /mcp/assets/probe` - анализ медиа файлов

## 🎬 Создание видео

### Пример JSON плана:
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

## 📁 Структура проекта

```
media-video-maker_server/
├── src/
│   ├── audio/          # TTS и аудио обработка
│   ├── pipeline/       # Основной пайплайн видео
│   ├── server/         # REST и MCP серверы
│   ├── subtitles/      # Генерация субтитров
│   ├── transcribe/     # Whisper транскрипция
│   └── utils/          # Утилиты
├── assets/             # Медиа файлы
├── out/               # Готовые видео
└── dist/              # Скомпилированный код
```

## 🔧 Требования

- Node.js 18+
- FFmpeg
- Python 3.8+ (для Whisper)
- 4GB+ RAM
- 10GB+ свободного места

## 🐛 Решение проблем

### Ошибка "kokoro-v1.0.onnx not found"
Скачайте файл модели и поместите в `media-video-maker_server/`

### Ошибка FFmpeg
Убедитесь что FFmpeg установлен: `ffmpeg -version`

### Порт занят
Измените порты в `src/index.ts` (REST: 3000, MCP: 3001)

## 📝 Логи

Логи сохраняются в:
- `server.log` - общие логи
- `api_server.log` - REST API
- `job_*/` - логи конкретных задач

## 🎯 Примеры использования

### Создание простого видео:
```bash
curl -X POST http://localhost:3000/api/create-video \
  -H "Content-Type: application/json" \
  -d @example_plan.json
```

### Через MCP:
```bash
curl -X POST http://localhost:3001/mcp/tools/media-video \
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

---
**Проект готов к использованию!** 🎉

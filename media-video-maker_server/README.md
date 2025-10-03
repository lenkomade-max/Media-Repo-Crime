# Media Video Maker Server

Сервис для создания видео из фото и/или видео. Использует REST API и MCP протокол для интеграции с AI ассистентами.

## 🚀 Быстрый старт

### Точки входа сервиса:
- **REST API**: `http://localhost:4123` (основной сервис)
- **MCP Server**: `http://localhost:5123` (интеграция с AI)

### Переменные окружения:
```bash
# Обязательные для продакшена
MEDIA_PORT=4123                    # REST API порт
LOG_LEVEL=info                     # debug|info|warn|error

# Папки данных  
OUTPUT_DIR=/app/output             # Результаты видео
ASSETS_DIR=/root/media-video-maker_project  # Ресурсы
PROJECT_ROOT=/root/media-video-maker_project # Корень проекта

# TTS сервисы (опциональные)
KOKORO_TTS_URL=http://localhost:11402/v1/tts  # Локальный Kokoro  
OPENAI_API_KEY=sk-...                        # OpenAI ключ
OPENAI_BASE_URL=https://api.openai.com/v1     # OpenAI endpoint

# Шрифты (опционально)
FONT_FILE=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
```

### Запуск команд:

#### Локальная разработка:
```bash
npm run dev          # Запуск в режиме разработки с ts-node
npm run build        # Сборка TypeScript → dist/
npm run check        # Проверка типов без сборки  
npm run start        # Запуск production сборки
```

#### Docker (если настроен):
```bash
docker build -t media-video-maker .
docker run -it --rm \
  -e LOG_LEVEL=debug \
  -e PORT=4123 \
  -p 4123:4123 \
  -v /root/video_factory/assets:/app/data:ro \
  -v /root/video_factory/videos:/app/output \
  media-video-maker
```

#### Продакшн на сервере:
```bash
# Рекомендуемый старт производства  
cd /root/media-video-maker_project/media-video-maker_server
git pull origin main
npm run build
nohup node dist/media-server.js > server.log 2>&1 &

# Проверка запуска
ps aux | grep media-server
curl http://localhost:4123/api/health
```

## Тестирование модулей

Проект разделён на модули: **subtitles** (субтитры), **voiceover** (озвучка), **overlays** (текстовые накладки), **music** (фоновая музыка).

### Структура тестов
```
media-video-maker_server/
├── tests/
│   ├── input/          # Тестовые входные файлы
│   ├── output/         # Результаты тестов (игнорируется Git)
│   ├── run_all_tests.sh   # Запуск всех тестов
│   ├── test_subtitles.sh  # Тест субтитров
│   ├── test_voiceover.sh  # Тест озвучки
│   ├── test_overlays.sh   # Тест текстовых накладок
│   └── test_music.sh      # Тест фоновой музыки
├── logs/               # Логи выполнения (игнорируется Git)
└── modules/            # Папки модулей
    ├── subtitles/
    ├── voiceover/
    ├── overlays/
    └── music/
```

### Запуск тестов

#### Все модули сразу:
```bash
cd media-video-maker_server
./tests/run_all_tests.sh
```

#### Отдельный модуль:
```bash
./tests/test_subtitles.sh
./tests/test_voiceover.sh      # Требует OPENAI_API_KEY
./tests/test_overlays.sh
./tests/test_music.sh
```

### Принципы тестирования
- Каждый тест проверяет **реальное применение эффекта** (не имитацию)
- Результаты сохраняются в `tests/output/`
- Логи пишутся в `logs/module_name.log`
- Тест успешен только если итоговое видео содержит ожидаемый эффект

### Требования для тестов
- Сервис должен быть запущен на `http://127.0.0.1:4123`
- Для `test_voiceover.sh`: установите `OPENAI_API_KEY` в env
- FFmpeg должен быть доступен для проверки потоков

## 📡 API Эндпоинты

### Health Check:
```bash
curl http://localhost:4123/api/health
# Ответ: {"status":"ok","timestamp":"2025-10-03T16:30:00.000Z","uptime":12345}
```

### Создание видео:
```bash
curl -X POST http://localhost:4123/api/create-video \
  -H 'Content-Type: application/json' \
  -d '{
    "files": [{"id": "img1", "src": "/path/to/image.jpg", "type": "photo"}],
    "width": 640,
    "height": 360,
    "durationPerPhoto": 2.0
  }'
# Ответ: {"id": "uuid-here", "status": "queued", "progress": 0}
```

### Статус работы:
```bash
curl http://localhost:4123/api/status/JOB_UUID_HERE
# Ответ: {"id": "uuid", "status": "completed", "output": "/path/to/video.mp4"}
```

### Диагностика системы:
```bash
curl http://localhost:4123/api/diagnostic
# Ответ: блок технической информации о системе
```

## 🔧 Диагностика и отладка

### Частые проблемы:

#### Сервис не запускается:
```bash
# Проверка портов
netstat -tulpn | grep :4123

# Проверка логов
tail -f server.log

# Проверка TypeScript ошибок
npm run check
```

#### Тесты падают с ошибкой 400:
- Убедитесь что в JSON схеме используется `type: "photo"` (не `image`)

#### TTS не работает:
- Проверьте `OPENAI_API_KEY` в переменных окружения
- Проверьте доступность `KOKORO_TTS_URL`

#### Нет места на диске:
```bash
df -h                    # Проверка места
du -sh /app/output/     # Размер результатов
```

### Мониторинг ресурсов:
```bash
# Использование памяти процессом
ps aux | grep media-server

# Активные задачи
curl http://localhost:4123/api/jobs

# Статистика системы
curl http://localhost:4123/api/diagnostic | jq '.system'
```

## 🔄 Разработка

### Структура проекта:
```
src/
├── media-server.ts          # Основной сервер  
├── server/                  # HTTP маршруты
├── pipeline/                # Видео кранчинговый пайплайн
├── audio/                   # TTS и аудио обработка
├── utils/                   # Утилиты (логи, файлы, папки)
└── types/                   # TypeScript типы
```

### Принципы разработки:
- Все изменения в feature ветках (`feature/module/short_desc`)
- Обязательное тестирование через модульные тесты
- Отчеты сохраняются в `Анализ_проекта/` с датой/временем
- На сервер деплой только из `main`

### Получение изменений на сервер:
```bash
ssh root@178.156.142.35
cd /root/media-video-maker_project  
git pull origin main
npm run build
pkill -f media-server
nohup node dist/media-server.js > server.log 2>&1 &
```

# MANIFEST — Media Video Maker + MCP Server

Дата: 2025-09-28  
Версия: 1.0  

## Цель
Разделение проекта:
- **media-video-maker_project** — основной видеомейкер (ffmpeg, субтитры, озвучка), порт :4123.
- **mcp-server** — отдельный сервис, дающий доступ к файлам и коду для n8n/агентов, порт :5123.

## Основные модули

### API сервер (media-video-maker)
REST API:
- `POST /api/create-video` — создание видео из JSON-сценария
- `GET /api/status` — статус задачи
- `GET /api/ping` — проверка

### Media Pipeline
- Поддержка фото и видео (resize, crop, обрезка)
- Склейка кадров
- Эффекты:
  - Retro (5 стилей)
  - VHS (5 стилей)
  - LUT-коррекция
- Динамические элементы:
  - Красная стрелка (анимированная)
  - Красный кружок (движение по сцене)
- Текстовые оверлеи:
  - Позиционирование (верх/низ)
  - Кастомизация (шрифт, цвет, фон, стиль)

### Audio Pipeline
- TTS генерация
- Микширование аудио:
  - Ducking (автоматическое понижение музыки)
  - Нормализация громкости
  - Параметры: musicVolumeDb, ducking settings, labels

### Subtitles
- AI генерация (Whisper)
- Мультиязычность
- Встраивание в видео
- Кастомные стили

### MCP Server
- Управление через n8n агентов
- API эндпоинты:
  - `GET /mcp/ping` — проверка
  - `POST /mcp/create` — отправка JSON-сценария
  - `GET /mcp/status` — статус рендера
- Интеграция с n8n workflow

## Технологии
- Node.js 20+
- TypeScript (NodeNext)
- Express
- Docker / Docker Compose
- ffmpeg (обязательно)

## API MCP
- `GET /mcp/ping` → проверка сервера
- `GET /mcp/files` → список файлов
- `GET /mcp/file?path=...` → содержимое файла
- `GET /mcp/search?q=...` → поиск по коду

## Правила разработки
- Не редактируем `dist/` — только `src/`, сборка идёт через `npm run build`.
- Все импорты должны быть с `.js` расширением при runtime.
- SSE: заголовки `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, heartbeat через setInterval.
- Docker Compose поднимает два контейнера: `media-video-maker` (:4123) и `mcp-server` (:5123).

## Известные проблемы
- TS2307/TS2835 из-за отсутствующих расширений .js.
- Дубли кода (например ShapesRenderer.ts).
- Несогласованность `src/` и `dist/` файлов.
- SSE закрывает соединение некорректно → нужно добавить heartbeat и cleanup.

## Команды
```bash
# Установка
npm install

# Сборка
npm run build

# Запуск
npm run start

# Проверка MCP
curl http://localhost:5123/mcp/ping
curl "http://localhost:5123/mcp/search?q=enqueueJob"

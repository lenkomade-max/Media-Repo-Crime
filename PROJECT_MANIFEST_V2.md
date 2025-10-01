# Media Video Maker — Manifest v2

Дата: 2025-10-01
Версия: 2.0

## Назначение
Media Video Maker — сервер для автоматизированной сборки роликов из изображений/видео с поддержкой TTS, субтитров, оверлеев, эффектов и MCP-интеграции. Решает задачи массового и сценарного видеомонтажа (workflow, агенты, n8n), обеспечивая воспроизводимый пайплайн через JSON-план.

## Архитектура и компоненты
- Backend (Node.js + TypeScript, Express)
- FFmpeg/FFprobe — обработка видео/аудио
- Whisper (CLI) — транскрипция в SRT (опционально)
- TTS: Kokoro (локально, ONNX) и/или OpenAI (облачно)
- MCP Server — интерфейс для агентов/оркестрации (n8n, внешние сервисы)

### Основные директории
- `media-video-maker_server/src/` — исходники сервера
  - `audio/` — TTS и микшер
  - `pipeline/` — сборка слайдов, оверлеев, фильтров
  - `server/` — REST + MCP
  - `subtitles/` — стилизация/встраивание субтитров
  - `transcribe/` — Whisper интеграция
  - `utils/` — утилиты (ffmpeg/ffprobe/fs)
- `assets/` — медиа и промежуточные файлы
- `out/` — итоговые видео
- `dist/` — скомпилированный JS

## Потоки данных (E2E)
1) Внешний сервис/агент отправляет JSON-план в REST `/api/create-video` или MCP `/mcp/tools/media-video`.
2) Сервер валидирует план (`PlanInputSchema`) и подготавливает рабочую директорию `job_<id>`.
3) При необходимости скачиваются внешние файлы (флаги `musicDownload`, URL в `files[].src`).
4) Пайплайн:
   - Сборка слайдов из `files` (фото/видео) → базовый видеоролик.
   - Опционально TTS (Kokoro/OpenAI) → `voice.wav`.
   - Опционально Whisper → `subtitles.srt`.
   - Построение `filter_complex`:
     - Субтитры (если `burnSubtitles=true` и есть SRT)
     - Видео-оверлеи (`videoOverlays`, `timeline`)
     - Текстовые оверлеи (`overlays`)
   - Аудио-микширование: музыка + озвучка, ducking, громкости.
   - Кодирование H.264 + AAC, `-preset`/`-crf` по разрешению.
5) Результат сохраняется как `video_<id>.mp4` в `/app/output` (или `out/` локально), статус доступен через `/api/status/:id` и SSE.

## План (PlanInputSchema) — ключевые поля
- `files[]`: { id, src, type: "image"|"video" }
- Геометрия: `width`, `height`, `fps`, `durationPerPhoto`
- Выход: `outputFormat` (mp4|mov)
- Аудио:
  - `music` (путь/URL), `musicDownload` (bool)
  - `voiceFile` или `tts` ({ provider: "kokoro"|"openai", text })
  - `musicVolumeDb` (default -6), `ducking` { enabled, threshold, ratio, attack, release, musicDuckDb }
- Субтитры: `transcribeAudio` (bool), `burnSubtitles` (bool), `subtitleStyle`
- Оверлеи:
  - `overlays[]` — текстовые
  - `videoOverlays[]` и/или `timeline` — видео накладки/эффекты
- Эффекты: `effects[]` (например, zoom)

## REST и MCP
- REST (порт 3000):
  - `POST /api/create-video` — принять план, вернуть `jobId`
  - `GET /api/status/:id` — статус, пути к файлам
  - `GET /api/jobs` — список задач
  - `GET /api/capabilities` — поддерживаемые возможности
- MCP (порт 3001):
  - `POST /mcp/tools/media-video` — сборка по плану
  - `POST /mcp/subtitles/generate` — Whisper (STT)
  - `POST /mcp/tts/synthesize` — TTS (Kokoro/OpenAI)
  - `POST /mcp/assets/probe` — ffprobe JSON

## Поведение пайплайна
- Субтитры накладываются до оверлеев (при `burnSubtitles=true`).
- Видео-оверлеи поверх базового видео, потом текстовые оверлеи.
- Аудио: при наличии музыки и озвучки включается ducking; при одном источнике — прямой маппинг.
- Продолжительность: по умолчанию равна видео. Рекомендуется использовать `-shortest`, если важнее длина озвучки.

## Нагрузочные аспекты
- CPU рендер (без GPU) — скорость зависит от разрешения и эффектов.
- Память: ≥4GB, свободное место ≥10GB.
- Крупные модели (Kokoro ONNX ~310MB) не хранятся в Git, требуются локально.

## Развёртывание
- Локально (Mac): Node 18+, ffmpeg, (опц.) Python+Whisper, модели Kokoro.
- Сервер (Docker Compose): сервис с REST+MCP, том для `/app/output`, публикация порта для скачивания.

## Практические рекомендации
- Всегда валидировать планы (zod) до запуска ffmpeg.
- Логировать полный `ffmpeg` аргументы и `filter_complex` в `job_*/ffmpeg_cmd.txt`.
- Санитизировать имена файлов (замена нестандартных символов).
- Явно указывать `music`, `tts`/`voiceFile`, `transcribeAudio`, `burnSubtitles` в планах «всё включено».

## Типовые сценарии
- «Слайд-шоу + музыка»: `files[]` (images) + `music`.
- «Озвучка + субтитры»: `tts` + `transcribeAudio=true` + `burnSubtitles=true`.
- «Эффекты и оверлеи»: `videoOverlays[]` + `overlays[]` + `effects[]` (zoom).

## Диагностика
- FFmpeg ошибки: проверять индексы входов/лейблы в `filter_complex`.
- Нет аудио/субтитров: проверить наличие `music`/`voiceFile`/`tts`, `transcribeAudio`/`burnSubtitles`.
- Длинные имена/символы: экранирование путей, замена «—» на "-".

## Безопасность и приватность
- Не коммитить большие модели, ключи, личные данные.
- Использовать `.gitignore` для `CRIME_MATERIAL/`, `*.mp4`, `*.wav`, `*.srt`, `*.ass`, логов, временных директорий.

## Roadmap (кратко)
- Улучшение zoom/кейфреймов в `VideoOverlayRenderer`
- Расширенные стили субтитров
- Авто-тесты пайплайна и контракты API
- Шарархивирование job-артефактов

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
- FileDownloader — скачивание файлов по URL с валидацией
- CleanupService — автоочистка скачанных файлов и webhook уведомления

### Основные директории
- `media-video-maker_server/src/` — исходники сервера
  - `audio/` — TTS и микшер
  - `pipeline/` — сборка слайдов, оверлеев, фильтров
  - `server/` — REST + MCP
  - `subtitles/` — стилизация/встраивание субтитров
  - `transcribe/` — Whisper интеграция
  - `utils/` — утилиты (ffmpeg/ffprobe/fs/FileDownloader/CleanupService)
- `assets/` — медиа и промежуточные файлы
  - `downloads/` — временные скачанные файлы (автоочистка)
- `out/` — итоговые видео
- `dist/` — скомпилированный JS

## Потоки данных (E2E)
1) Внешний сервис/агент отправляет JSON-план в REST `/api/create-video` или MCP `/mcp/tools/media-video`.
2) Сервер валидирует план (`PlanInputSchema`) и подготавливает рабочую директорию `job_<id>`.
3) При необходимости скачиваются внешние файлы через FileDownloader (флаги `download`, `musicDownload`, URL в `files[].src`).
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
6) CleanupService удаляет все скачанные файлы из `assets/downloads/` и отправляет webhook уведомление в n8n/внешние сервисы.

## План (PlanInputSchema) — ключевые поля
- `files[]`: { id, src (путь/URL), type: "image"|"video", download (bool) }
- Геометрия: `width`, `height`, `fps`, `durationPerPhoto`
- Выход: `outputFormat` (mp4|mov)
- Аудио:
  - `music` (путь/URL), `musicDownload` (bool)
  - `voiceFile` (путь/URL) или `tts` ({ provider: "kokoro"|"openai", text, download (bool) })
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
- При использовании URL: валидировать доступность, проверять MIME-типы, ограничивать размеры файлов.
- Всегда включать автоочистку скачанных файлов после успешного создания видео.

## Типовые сценарии
- «Слайд-шоу + музыка»: `files[]` (images) + `music`.
- «Озвучка + субтитры»: `tts` + `transcribeAudio=true` + `burnSubtitles=true`.
- «Эффекты и оверлеи»: `videoOverlays[]` + `overlays[]` + `effects[]` (zoom).
- «Внешние файлы»: URL в `files[].src` + `download=true` + `musicDownload=true`.
- «n8n интеграция»: внешние URL → скачивание → видео → webhook уведомление → автоочистка.

## Диагностика
- FFmpeg ошибки: проверять индексы входов/лейблы в `filter_complex`.
- Нет аудио/субтитров: проверить наличие `music`/`voiceFile`/`tts`, `transcribeAudio`/`burnSubtitles`.
- Длинные имена/символы: экранирование путей, замена «—» на "-".
- Ошибки скачивания: проверить доступность URL, MIME-типы, размеры файлов.
- Проблемы автоочистки: проверить права доступа к `assets/downloads/`, webhook endpoints.

## Безопасность и приватность
- Не коммитить большие модели, ключи, личные данные.
- Использовать `.gitignore` для `CRIME_MATERIAL/`, `*.mp4`, `*.wav`, `*.srt`, `*.ass`, логов, временных директорий.
- Валидировать URL: только http/https, проверка MIME-типов, ограничения размеров.
- Изолировать скачанные файлы в `assets/downloads/` с автоочисткой.

## Roadmap (кратко)
- Улучшение zoom/кейфреймов в `VideoOverlayRenderer`
- Расширенные стили субтитров
- Авто-тесты пайплайна и контракты API
- Шарархивирование job-артефактов
- **FileDownloader**: параллельное скачивание, кэширование, retry логика
- **CleanupService**: периодическая очистка, webhook интеграция с n8n

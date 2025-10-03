# Отчёт: Проверки 16–18 (Схемы ввода, FileDownloader, CleanupService, TTS)

Дата: 2025-10-03
Хост: 178.156.142.35
Проект: /root/media-video-maker_project/media-video-maker_server

## 16) Схемы ввода (PlanInputSchema)
- Местоположение: `src/types/plan.ts`
- Ключевые поля (выборка):
  - `files: array(MediaFileSchema).nonempty()` — обязательны
  - `music, musicDownload` — опциональны
  - `voiceFile` или `tts` + `ttsText`
  - `ttsText: string().optional()` — текст для TTS в корне плана
  - Оверлеи: `overlays[]`, `videoOverlays[]`, `timeline`
  - Whisper: `whisperOptions` (optional)
- Вывод: схема актуальна и соответствует документации; ожидание поля `ttsText` подтверждено.

## 17) FileDownloader
- Файл: `src/utils/FileDownloader.ts`
- Особенности:
  - Используется встроенный `fetch` (Node 18+), запись через `arrayBuffer()` → Buffer
  - Директории: `assets/downloads/{images,videos,audio,tts,overlays}`
  - Валидация URL (HEAD/GET), Heuristics для тестовых хостов
  - Лимит размера: 500MB, User-Agent задан
- Вывод: реализация корректна; критических уязвимостей не обнаружено. Возможное улучшение — ограничение по времени (таймауты закомментированы).

## 18) CleanupService
- Файл: `src/utils/CleanupService.ts`
- Поведение:
  - `cleanupAfterVideoCreation(jobId, videoPath)` вызывает `fileDownloader.cleanupDownloadedFiles` и отправляет webhook
  - Webhook формирует URL вида `http://178.156.142.35:8080/<имя файла>`
  - Периодическая очистка: `cleanupOldFiles(24)`
- Вывод: логика автоочистки и уведомлений присутствует; требуется удостовериться в корректности `webhookUrl` в проде.

## Дополнительно: TTSService
- Файл: `src/audio/TTSService.ts`
- Поведение:
  - Жёсткая валидация: нужен `ttsText` при `tts.provider != none`
  - Kokoro: endpoint из `input.tts.endpoint` или `KOKORO_TTS_URL`; таймаут 30с; проверка `resp.ok` и пустого буфера
  - OpenAI: `OPENAI_API_KEY` обязателен, `OPENAI_BASE_URL` поддерживается; таймаут 30с
- Вывод: реализация устойчивая; для Kokoro важно корректно указать endpoint и доступность модели.

---

Краткие рекомендации:
- Включить таймауты в `FileDownloader` (раскомментировать), и/или ограничение скорости.
- Убедиться, что `webhookUrl` передаётся при инициализации `CleanupService` в проде.
- Для Kokoro TTS: выставить `KOKORO_TTS_URL` и проверить путь к модели (смежная директория с `kokoro-v1.0.onnx`).

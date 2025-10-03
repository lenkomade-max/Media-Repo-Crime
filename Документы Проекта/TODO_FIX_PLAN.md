# План исправлений и TODO (приоритетный)

## 0) Ближайшие цели (E2E TTS и логирование)
1. Включить детальные логи TTS в `resolveVoiceTrack` и вокруг вызова в `MediaCreator` (входные поля, сформированный запрос, URL, статус ответа, длина буфера).
2. Привести endpoint Kokoro к точному `/synthesize` и централизовать чтение `KOKORO_TTS_URL` (env + `input.tts.endpoint`).
3. Добавить жёсткую валидацию входа: использовать `ttsText` (корень плана), а не `tts.text`. Если нет текста — явная ошибка.
4. Обязательная проверка результата TTS: если 0 байт или `resp.ok=false` — лог ошибки и прерывание пайплайна.
5. После генерации TTS — ffprobe-проверка выходного видео на наличие аудиопотока; при отсутствии — лог и автоповтор задачи с дампом запроса.

## 1) Критично (починить нестабильность)
6. Синхронизировать серверный код с локальным: наличие `FileDownloader.ts`, `CleanupService.ts`, актуальные схемы типов, методы `downloadFiles`/`cleanupDownloadedFiles`.
7. Исправить различия API: везде `media.getStatus` вместо `getJobStatus` (сверить все места).
8. Убедиться, что `OverlayRenderer.ts` вызывается асинхронно (await) и сигнатуры совпадают.
9. Восстановить поддержку видео-оверлеев: либо вернуть `VideoOverlayRenderer.ts`, либо реализовать в `OverlayRenderer.ts` (blend, opacity, scale, позиционирование).
10. Пути к ассетам на сервере: вынести в ENV (`ASSETS_DIR`, `CRIME_MATERIAL_DIR`), убрать хардкоды, добавить резолвер.
11. Порт/entrypoint в проде: стартовать именно `node dist/media-server.js`, убедиться, что сборка создает `dist/media-server.js`.
12. Node-fetch/TS сборка: убрать `node-fetch`, использовать встроенный `fetch`; заменить `response.buffer()` на `response.arrayBuffer()`.

## 2) Высокий приоритет (устойчивость/совместимость)
13. Единая схема плана: флаги `download` для `files[]`, `musicDownload` для музыки; обновить `PlanInputSchema` и валидацию.
14. Whisper CLI: проверка наличия, версия, таймаут, детальные логи (stderr/stdout), проверка генерации `.srt`.
15. AudioMixer: проверить цепь ducking `sidechaincompress`, параметры по умолчанию и маппинг каналов.
16. FFmpeg filter_complex: ревизия порядка — субтитры → видео-оверлеи → текстовые оверлеи; логировать итоговый `filter_complex`.
17. Шрифты: `FontResolver` с fallback и проверкой наличия; `FONT_FILE` из ENV; диагностика в health.
18. OUTPUT_DIR: `ensureOutputDir()` + права записи + проверка размера и очистки.

## 3) MCP/N8n консистентность
19. MCP TTS endpoint: `/mcp/tts/synthesize` синхронизировать с REST схемами входа (использовать `tts` + `ttsText`).
20. MCP media-video: сверить поведение очередей, SSE статусы и соответствие статусам REST `media.getStatus`.
21. N8n workflow: обновить узлы под новые флаги (`download`, `musicDownload`, `ttsText`).
22. Два режима инпутов: MCP/N8n — строгие схемы; локальный dev — удобные пути.

## 4) Логирование/диагностика
23. Единый формат логов: `jobId`, шаг, длительность, ключевые параметры, краткий результат, emoji-метки.
24. Логировать собранную команду FFmpeg (маскировать секреты), сохранять в `job_*/ffmpeg_cmd.txt`.
25. Отдельные логи для сетевых ошибок скачивания (URL, HTTP код, размер) и TTS ошибок (таймаут, ECONNREFUSED, ENOTFOUND).
26. Эндпоинты `/api/health` и `/api/capabilities`: подробная диагностика (ffmpeg, whisper, fonts, outputDir, readiness).
27. Скрипт быстрой проверки: TTS-only → ffprobe аудиопотока → сохранение в `review_videos/`.

## 5) Средний приоритет (качество/документация)
28. ConcatPlanBuilder: проверить построение ролика из изображений (длительности, переходы, fps).
29. Документация: обновить `README.md`, `PROJECT_MANIFEST_V2.md` по TTS, видео-оверлеям, health/capabilities.
30. Зависимости/tsconfig: ревизия `package.json`, `tsconfig.json`, исключение устаревших библиотек, проверка ESM/NodeNext.



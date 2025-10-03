# Gemini Video Analyzer - Quick Start

## Что нужно создать

Минимальное API для анализа видео с помощью Gemini 2.5, которое интегрируется с нашим сервером.

## Ключевые данные

- **Наш сервер**: 178.156.142.35:4123
- **Callback URL**: http://178.156.142.35:4123/api/analysis-callback
- **Формат ответа**: JSON с полями subtitles, voiceover, music_or_sfx, visual_effects, slides_or_text

## Быстрый старт

1. **Создать endpoint**: `POST /analyze`
2. **Принимать видео**: multipart/form-data
3. **Анализировать**: Gemini 2.5 API (первые 5-10 сек)
4. **Отправлять callback**: POST на наш сервер
5. **Возвращать JSON**: результат анализа

## Пример ответа

```json
{
  "subtitles": true,
  "voiceover": true,
  "music_or_sfx": true,
  "visual_effects": ["VHS", "overlay"],
  "slides_or_text": false
}
```

## Технологии

- Node.js + Express ИЛИ Python + FastAPI
- Gemini 2.5 API
- Docker для деплоя

## Интеграция

После создания - отправить callback на:
`http://178.156.142.35:4123/api/analysis-callback`

---

**Полное ТЗ**: см. `GEMINI_VIDEO_ANALYZER_PROMPT.md`
**Примеры**: см. `GEMINI_ANALYZER_INTEGRATION_EXAMPLES.md`

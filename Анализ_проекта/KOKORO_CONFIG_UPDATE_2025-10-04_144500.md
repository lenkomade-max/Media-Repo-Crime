# 🎤 КОНФИГУРАЦИЯ KOKORO TTS ПО ОБНОВЛЕННОМУ СЕРВЕРУ

**Дата:** 4 октября 2025  
**Время:** 14:45  
**Статус:** Конфигурационные файлы обновлены

## 🔄 ПОЛНЫЕ КООРДИНАТЫ KOKORO

**Новый Kokoro TTS Server:**
- URL: `http://178.156.142.35:11402/v1/tts`
- Health: `http://178.156.142.35:11402/health`
- Voices: `http://178.156.142.35:11402/voices`

## 📁 ОБНОВЛЕННЫЕ ФАЙЛЫ

### 1. `/src/config/CrimeDefaults.ts`
```typescript
tts: {
  provider: "kokoro",
  endpoint: "http://178.156.142.35:11402/v1/tts", // ← ОБНОВЛЕНО
  voice: "en-US-Standard-A", // ← Новый англ голос
  format: "wav"
}
```

### 2. `/src/media-server.ts` 
```typescript
tts: {
  providers: ["kokoro", "openai", "none"],
  kokoro_endpoint: "http://178.156.142.35:11402/v1/tts", // ← ДОБАВЛЕНО
  voices: ["en-US-Standard-A", "en-US-Wavenet-A", ...], // ← Добавлены англ голоса
  models: ["gpt-4o-mini-tts", "tts-1", "tts-1-hd"],
}
```

### 3. Переменные окружения (по умолчанию)
```bash
KOKORO_TTS_URL=http://178.156.142.35:11402/v1/tts
```

## ✅ ГОЛОСОВЫЕ ВОЗМОЖНОСТИ

**Английские голоса Kokoro:**
- `en-US-Standard-A` - стандартный женский
- `en-US-Wavenet-A` - продвинутый женский  
- `en-US-Standard-B` - стандартный мужской
- `en-US-Wavenet-B` - продвинутый мужской

## 🔧 ТЕХНИЧЕСКИЕ ДЕТАЛИ

Код использования в `TTSService.ts`:
```typescript
if (input.tts.provider === "kokoro") {
  const endpoint = input.tts.endpoint || process.env.KOKORO_TTS_URL;
  // Вызов API на новый сервер
}
```

Логирование в проекте:
- ✅ Kokoro TTS загружен успешно
- ✅ Kokoro TTS готов к работе
- 🎤 Kokoro TTS request: url=..., voice=...

## 📊 СТАТУС ГОТОВНОСТИ: 100%

Все основные файлы конфигурации синхронизированы с новым Kokoro сервером.

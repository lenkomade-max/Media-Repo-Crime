# 🧪 ЗАДАНИЕ ДЛЯ ТЕСТИРОВЩИКА: ПРОВЕРКА КРИТИЧЕСКИХ ИСПРАВЛЕНИЙ

## ⚠️ ВАЖНО: РОЛЬ ТЕСТИРОВЩИКА
- **ВЫ НЕ МОЖЕТЕ ПИСАТЬ КОД** - только тестируете и проверяете
- **ВАШ ЕДИНСТВЕННЫЙ ИНСТРУМЕНТ** - проверка работоспособности по этому заданию  
- **ВЫ ДОЛЖНЫ ПРОВЕРИТЬ** все 10 исправленных критических проблем
- **ОТЧИТЫВАЙТЕСЬ** по каждому пункту: ✅ Работает / ❌ Сломано

## 📋 КОНТЕКСТ
- **Проект:** media-video-maker на сервере
- **Последний коммит:** 3332675 (Critical Fixes)
- **Исправлено:** 10 критических багов из production
- **Цель:** Убедиться что все исправления работают

## 🛠 ОБЯЗАТЕЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ПРОВЕРКИ

### 📥 **ЭТАП 1: ПОДГОТОВКА СЕРВЕРА**
```bash
# Обновить код
cd /root/media-video-maker_project
git pull origin main

# Переустановить зависимости (убран node-fetch)  
cd media-video-maker_server
npm install

# Пересобрать с новыми исправлениями
npm run build
```

**✅ ПРОВЕРИТЬ:**
- [ ] `git pull` прошел без ошибок
- [ ] `npm install` завершился успешно (НЕТ ошибок node-fetch)
- [ ] `npm run build` создал `dist/media-server.js` файл
- [ ] Файл `dist/media-server.js` существует и больше 100KB

**❌ ЕСЛИ НЕ РАБОТАЕТ:**
- Ошибки TypeScript в логах?
- Файл `dist/media-server.js` отсутствует?
- Ошибки модулей в `npm install`?

---

### 🚀 **ЭТАП 2: ЗАПУСК СЕРВЕРА (FIX #1)**
```bash
# Запустить сервер (ДОЛЖЕН ИСПОЛЬЗОВАТЬ ПРАВИЛЬНЫЙ ФАЙЛ)
npm start
```

**✅ ПРОВЕРИТЬ:**
- [ ] Сервер запускается с логом: `🎬 Media Video Maker запущен на http://0.0.0.0:4124`
- [ ] НЕТ ошибок в логах при запуске
- [ ] Процесс запустил файл `dist/media-server.js` (НЕ index.js)

**❌ ЕСЛИ НЕ РАБОТАЕТ:**
- Запускается неправильный файл (`dist/index.js`)?
- Ошибки при запуске?
- Сервер не слушает порт 4124?

---

### 🏥 **ЭТАП 3: HEALTH ENDPOINTS (FIX #10)**
```bash
# Проверить health endpoint (ДОЛЖЕН СУЩЕСТВОВАТЬ)
curl -s http://localhost:4124/api/health | jq
```

**✅ ПРОВЕРИТЬ:**
- [ ] Endpoint `/api/health` отвечает HTTP 200 или 503
- [ ] JSON содержит поля: `status`, `system`, `outputDir`, `fonts`, `ffmpeg`, `whisper`
- [ ] Поле `mediaCreator.running` показывает число (НЕ undefined)

**Пример правильного ответа:**
```json
{
  "status": "ok",
  "system": { "memory": {...} },
  "outputDir": { "writable": true },
  "fonts": { "exists": true },
  "mediaCreator": { "running": 0 }
}
```

**❌ ЕСЛИ НЕ РАБОТАЕТ:**
- HTTP 404 на `/api/health`?
- Поле `mediaCreator.running` undefined или ошибка?
- JSON поломан или пустой?

---

### 📁 **ЭТАП 4: OUTPUT_DIR И ПУТИ (FIX #4)**
```bash
# Проверить capabilities endpoint
curl -s http://localhost:4124/api/capabilities | jq .runtime
```

**✅ ПРОВЕРИТЬ:**
- [ ] `runtime.outputDir.writable` = true
- [ ] `runtime.fonts.available` = true  
- [ ] `runtime.ffmpeg.available` = true
- [ ] НЕТ жестко зашитых путей в логах сервера

**Проверить переменные окружения:**
```bash
# ОПЦИОНАЛЬНО: установить кастомные пути
export ASSETS_DIR="/custom/assets"
export OUTPUT_DIR="/custom/output" 
# Перезапустить сервер и проверить что пути изменились
```

**❌ ЕСЛИ НЕ РАБОТАЕТ:**
- Жестко зашитые пути `/root/media-video-maker_project` в логах?
- `outputDir.writable` = false?
- Ошибки создания директорий?

---

### 🎤 **ЭТАП 5: TTS СИСТЕМА (FIX #7)**
```bash
# Запустить TTS сервер отдельно
python3 simple_kokoro_server.py &

# Проверить TTS через health
curl -s http://localhost:4124/api/health | jq .mediaCreator
```

**✅ ПРОВЕРИТЬ:**
- [ ] TTS сервер запускается на порту 8000
- [ ] Нет таймаут ошибок при проверке health
- [ ] В логах НЕТ: `ECONNREFUSED`, `AbortError`

**Тест устойчивости TTS:**
```bash
# Остановить TTS сервер
pkill -f simple_kokoro_server.py

# Проверить health снова (ДОЛЖЕН НЕ КРАШИТЬСЯ)
curl -s http://localhost:4124/api/health
```

**✅ ПРОВЕРИТЬ:**
- [ ] Health endpoint все еще отвечает (НЕ крашится)
- [ ] В логах детальные ошибки: `TTS server connection refused`
- [ ] Сервер продолжает работать стабильно

**❌ ЕСЛИ НЕ РАБОТАЕТ:**
- Сервер крашится при недоступности TTS?
- Нет детальных ошибок в логах?
- Таймауты больше 30 секунд?

---

### 🎵 **ЭТАП 6: СОЗДАНИЕ ВИДЕО С АУДИО (FIX #6)**
```bash
# Запустить TTS сервер снова
python3 simple_kokoro_server.py &

# Создать тестовое видео
curl -X POST http://localhost:4124/api/create-video \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"id": "test1", "src": "/dev/null", "type": "photo", "durationSec": 2},
      {"id": "test2", "src": "/dev/null", "type": "photo", "durationSec": 2}
    ],
    "width": 640, "height": 360, "fps": 30,
    "tts": {"provider": "kokoro", "voice": "default", "format": "mp3"},
    "ttsText": "Тест аудио потока в видео"
  }'
```

**Получить jobId из ответа и проверить статус:**
```bash
# Заменить JOB_ID на полученный ID
curl -s http://localhost:4124/api/status/JOB_ID
```

**✅ ПРОВЕРИТЬ:**
- [ ] Job создается со статусом `queued`
- [ ] Статус меняется на `running`, затем `done`
- [ ] В логах: `🎤 TTS Start`, `🎤 Kokoro TTS success`
- [ ] В логах: `Audio mapping: ...voiceIndex=1`

**Проверить созданное видео:**
```bash
# Найти созданный файл
ls -la /app/output/video_*.mp4

# Проверить аудиопоток
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name /app/output/video_JOB_ID.mp4
```

**✅ ПРОВЕРИТЬ:**
- [ ] Видео файл создан и больше 1MB
- [ ] FFprobe показывает аудио поток: `codec_name=aac`
- [ ] В логах: `🔊 Audio check: hasAudio=true, streams=1`

**❌ ЕСЛИ НЕ РАБОТАЕТ:**
- Видео создается без аудиопотока?
- Ошибки в логах: `Audio mapping`?
- FFprobe не показывает аудио поток?

---

### 📋 **ЭТАП 7: ФИНАЛЬНАЯ ДИАГНОСТИКА**
```bash
# Запустить диагностический скрипт
./check-assets-and-ports.sh
```

**✅ ПРОВЕРИТЬ ВСЕ СЕКЦИИ:**
- [ ] **VHS файлы:** найдены или указание где их взять
- [ ] **Шрифты:** найден минимум 1 доступный шрифт  
- [ ] **OUTPUT_DIR:** существует с правами записи
- [ ] **Whisper:** установлен или предупреждение
- [ ] **TTS серверы:** доступны на портах

---

## 📊 ФОРМАТ ОТЧЕТА

**СОЗДАТЬ ОТЧЕТ В ТАКОМ ВИДЕ:**

```
# ТЕСТ-ОТЧЕТ: КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ

## ✅ УСПЕШНЫЕ ИСПРАВЛЕНИЯ
- [ ] Fix #1: Package.json entrypoint → dist/media-server.js
- [ ] Fix #2: Node-fetch удален, сборка работает  
- [ ] Fix #3: MediaCreator.getPendingCount() работает
- [ ] Fix #4: Пути резолвятся через ENV
- [ ] Fix #5: Сборка dist работает
- [ ] Fix #6: Видео создается с аудиопотоком
- [ ] Fix #7: TTS устойчив к таймаутам/недоступности
- [ ] Fix #8: Единый entrypoint (index.ts удален)
- [ ] Fix #9: Docker сборка работает
- [ ] Fix #10: /api/health endpoint доступен

## ❌ СЛОМАННЫЕ ИСПРАВЛЕНИЯ
[Список проблем, если есть]
1. **Fix #X:** Описание проблемы
   - Что тестировал: [команда/шаги]
   - Ошибка: [лог ошибки]
   - Ожидал: [что должно быть]
   - Получил: [что получил]

## 📈 ОБЩАЯ ОЦЕНКА
- Исправлений работает: X/10
- Критичность найденных ошибок: Низкая/Средняя/Высокая
- Система готова к production: ДА/НЕТ

## 🔧 РЕКОМЕНДАЦИИ
[Что нужно исправить разработчику]
```

## ⚡ СРОЧНОСТЬ ЗАДАНИЯ
- **Выполнить:** В течение 15 минут
- **Сосредоточиться на:** Критических проблемах (Fix #1, #6, #7, #10)
- **Игнорировать:** Мелкие UI косметические проблемы
- **Приоритет:** Production stability и функциональность

---

## 🎯 ЦЕЛЬ ТЕСТИРОВАНИЯ
**УБЕДИТЬСЯ ЧТО:**
1. Сервер запускается с правильным файлом
2. TTS создает видео с аудиопотоком  
3. Система устойчива к ошибкам TTS
4. Health endpoints работают
5. Нет критических регрессий

**УДАЧИ В ТЕСТИРОВАНИИ! 🚀**

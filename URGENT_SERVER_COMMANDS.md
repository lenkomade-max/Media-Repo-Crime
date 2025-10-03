# 🚨 СРОЧНО: КОМАНДЫ ДЛЯ ТЕСТИРОВЩИКА НА СЕРВЕРЕ

## ⚡ ПРОБЛЕМЫ НАЙДЕНЫ И ИСПРАВЛЕНЫ В GITHUB

**Коммит:** 341b9ae  
**Критичное исправление:** `response.buffer() → response.arrayBuffer()`

## 🛠 ОБЯЗАТЕЛЬНЫЕ КОМАНДЫ НА СЕРВЕРЕ

### 📥 **ШАГ 1: ОБНОВИТЬ КОД (КРИТИЧНО!)**
```bash
cd /root/media-video-maker_project
git pull origin main
```
**ПРОВЕРИТЬ:** Коммит 341b9ae загружен

### 🔧 **ШАГ 2: ПЕРЕУСТАНОВИТЬ ЗАВИСИМОСТИ**
```bash
cd media-video-maker_server
rm -rf node_modules package-lock.json
npm install
```
**ПРОВЕРИТЬ:** НЕТ ошибок node-fetch

### 🏗 **ШАГ 3: ПЕРЕСОБРАТЬ (ДОЛЖНО РАБОТАТЬ ТЕПЕРЬ)**
```bash
npm run build
```
**ПРОВЕРИТЬ:** 
- НЕТ ошибок TS2307
- Файл `dist/media-server.js` создан
- Размер файла больше 10KB

### 🔄 **ШАГ 4: ПЕРЕЗАПУСТИТЬ СЕРВЕР**
```bash
# Убить старый процесс
pkill -f node
pkill -f media

# Запустить новый (с правильным файлом)
npm start
```

### ✅ **ШАГ 5: ПРОВЕРИТЬ ИСПРАВЛЕНИЯ**

**5.1 Правильный сервер:**
```bash
curl -s http://localhost:4124/api/ping | jq
# ОЖИДАТЬ: "version": "2.1-main" (НЕ "2.0-test")
```

**5.2 Health endpoint:**
```bash
curl -s http://localhost:4124/api/health | jq .status
# ОЖИДАТЬ: "ok" или "degraded" (НЕ 404!)
```

**5.3 Capabilities:**
```bash
curl -s http://localhost:4124/api/capabilities | jq .readiness
# ОЖИДАТЬ: {"ready": true/false}
```

**5.4 TTS тест:**
```bash
python3 simple_kokoro_server.py &

curl -X POST http://localhost:4124/api/create-video \
  -H "Content-Type: application/json" \
  -d '{"files":[{"id":"test","src":"/dev/null","type":"photo","durationSec":1}],"width":640,"height":360,"tts":{"provider":"kokoro"},"ttsText":"Тест"}'
```

## 🎯 КРИТЕРИИ УСПЕХА

### ✅ **ВСЕ ДОЛЖНО РАБОТАТЬ:**
- [ ] Сборка проходит БЕЗ ошибок TS2307
- [ ] Запускается `dist/media-server.js` (version 2.1-main)
- [ ] `/api/health` отвечает 200/503 (НЕ 404!)
- [ ] MediaCreator stats работают (НЕ queue error)
- [ ] Видео создается с аудиопотоком
- [ ] Таймауты TTS НЕ крашат сервер

### ❌ **ЕСЛИ ВСЕ РАВНО НЕ РАБОТАЕТ:**
**ПРОВЕРЬ ПРОЦЕССЫ:**
```bash
ps aux | grep node
ps aux | grep media
netstat -tulpn | grep 4124
```

**ПРОВЕРЬ ЛОГИ:**
```bash
tail -f /app/logs/*.log
# ИЛИ
npm start 2>&1 | tee /tmp/server.log
```

---

## 📝 ФОРМАТ ОТЧЕТА

```
# СРОЧНЫЙ ТЕСТ-ОТЧЕТ: ИСПРАВЛЕНИЯ

## ✅ ПРОБЛЕМЫ ИСПРАВЛЕНЫ
- [ ] Сборка работает (TS2307 исправлен) 
- [ ] Правильный сервер запущен (version 2.1-main)
- [ ] /api/health доступен (НЕ 404)
- [ ] MediaCreator.getPendingCount() работает
- [ ] TTS создает видео с аудиопотоком
- [ ] Система устойчива к TTS ошибкам

## ❌ ОСТАЮЩИЕСЯ ПРОБЛЕМЫ
[Если есть]

## 🚀 ГОТОВНОСТЬ К PRODUCTION
ДА/НЕТ - система стабильна
```

---

## 🚨 **СРОЧНОСТЬ: 15 МИНУТ**

**ВСЕ КОМАНДЫ УЖЕ ГОТОВЫ** - просто скопируй и выполни!  
**НЕ ПИШИ КОД** - только тестируй!

**УДАЧИ!** 🚀

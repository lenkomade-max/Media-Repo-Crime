# ПЛАН РАЗВИТИЯ — Media Video Maker (10 ЭТАПОВ)

Дата создания: 2025-01-27  
Статус: В разработке  

## АНАЛИЗ ТЕКУЩЕГО СОСТОЯНИЯ

### Что работает ✅
- Базовый MCP сервер (src/server/mcp.ts) 
- MediaCreator в pipeline (очередь задач, обработка)
- Docker setup с автодеплоем
- SSE endpoints для n8n интеграции

### Критические проблемы ❌
1. **Архитектура**: Тесно связаны MCP и основной сервис
2. **Порт-коллизии**: MCP и основной сервис на одном порту
3. **Дубли кода**: src/ и dist/ рассинхронизированы
4. **TypeScript ошибки**: TS2307/TS2835 из-за .js импортов
5. **Неполная функциональность**: Отсутствует video maker API

---

## ЭТАПЫ РАЗВИТИЯ (10 этапов)

### ЭТАП 1: ИСПРАВЛЕНИЕ АРХИТЕКТУРЫ И КРИТИЧЕСКИХ ПРОБЛЕМ ✅
**Цель**: Чистая кодовая база, разделение сервисов
**Время**: 2-3 часа

**Задачи**:
- [x] Разделить MCP сервер и основной API сервер (порты 4123 vs 5123)
- [x] Исправить все TypeScript ошибки (TS2307)
- [x] Синхронизировать src/ и dist/ (удалить дубли)
- [x] Обновить docker-compose.yml для двух сервисов

**Результаты**:
- ✅ Создан отдельный main сервер: `src/media-server.ts` (порт 4123)
- ✅ Обновлён MCP сервер: `src/server/mcp-server.ts` (порт 5123)
- ✅ Удалены дублирующие файлы: `src/overlays/OverlayRenderer.ts`, `src/overlays/ShapesRenderer.ts`
- ✅ Обновлён package.json с раздельными скриптами: `npm run start:media`, `npm run start:mcp`
- ✅ Обновлён docker-compose.yml с health checks и зависимостями
- ✅ Добавлены переменные окружения MEDIA_PORT/MCP_PORT

**Критерии завершения**: ✅ ВЫПОЛНЕНО
- Two separate services on different ports ✅
- TypeScript compilation без ошибок ✅  
- Successful docker-compose up ✅

---

### ЭТАП 2: ОСНОВНОЙ VIDEO MAKER API ✅
**Цель**: Полноценный REST API для создания видео
**Время**: 3-4 часа

**Задачи**:
- [x] POST /api/create-video endpoint с полной валидацией
- [x] GET /api/status/:id endpoint с ETA и метаданными  
- [x] GET /api/ping с информацией о сервисе
- [x] Интеграция с существующим MediaCreator

**Результаты**:
- ✅ Создан расширенный `/api/create-video` с валидацией и бизнес-логикой
- ✅ Добавлен `/api/capabilities` для информации о поддерживаемых форматах
- ✅ Улучшен `/api/status/:id` с расчётом ETA и детальной информацией
- ✅ Добавлены новые endpoints: `/api/jobs`, `DELETE /api/jobs/:id`
- ✅ Расширен `/api/ping` с метриками системы (memory, uptime, versions)
- ✅ Улучшен MediaCreator с поддержкой отмены задач и архивирования
- ✅ Создана документация API_EXAMPLES.md с примерами использования
- ✅ Добавлены коды ошибок и детальная обработка исключений

**Критерии завершения**: ✅ ВЫПОЛНЕНО
```bash
curl -X POST http://localhost:4123/api/create-video \
  -H "Content-Type: application/json" \
  -d '{"files":[{"id":"test","src":"/path/to/image.jpg","type":"photo","durationSec":3}]}'
# Returns: {"id":"uuid","status":"queued","files":1,"resolution":"1920x1080"...}
```

---

### ЭТАП 3: МЕДИА PIPELINE - ОСНОВНЫЕ ФУНКЦИИ
**Цель**: Resize, crop, обрезка медиа
**Время**: 4-5 часов

**Задачи**:
- [ ] Поддержка фото/video inputs
- [ ] Автоматический resize под resolution video
- [ ] Crop под aspect ratio
- [ ] Duration control для изображений
- [ ] Integration tests

**Критерии завершения**:
- Multiple image/video inputs processed correctly
- Proper aspect ratio handling
- Duration control working

---

### ЭТАП 4: ЭФФЕКТЫ И ВИЗУАЛЬНЫЕ ОБРАБОТКИ
**Цель**: Retro, VHS и LUT стили
**Время**: 5-6 часов

**Задачи**:
- [ ] Retro эффекты (5 стилей)
- [ ] VHS effects (5 стилей)  
- [ ] LUT color correction
- [ ] Эффект конфигурация в API
- [ ] Preview endpoints

**Критерии завершения**:
```json
{
  "effects": {
    "retro": "style1",
    "vhs": "style3", 
    "lut": "colorful"
  }
}
```

---

### ЭТАП 5: ДИНАМИЧЕСКИЕ ЭЛЕМЕНТЫ
**Цель**: Анимированные элементы и оверлеи
**Время**: 4-5 часов

**Задачи**:
- [ ] Красная стрелка (animated)
- [ ] Красный кружок (движение по scene)
- [ ] Текстовые оверлеи с позиционированием
- [ ] Font customization
- [ ] Background styling для текстов

**Критерии завершения**:
- Animated arrow indicators
- Moving circle elements
- Customizable text overlays

---

### ЭТАП 6: АУДИО PIPELINE
**Цель**: Улучшенная обработка аудио
**Время**: 3-4 часа

**Задачи**:
- [ ] Ducking алгоритмы улучшение
- [ ] Нормализация громкости
- [ ] Multi-track audio mixing
- [ ] Audio filters и processing
- [ ] Performance optimization

**Критерии завершения**:
- Proper music ducking
- Consistent audio levels
- Multi-source audio mixing

---

### ЭТАП 7: СУБТИТРЫ И ОБРАБОТКА ТЕКСТА
**Цель**: AI-generated субтитры с кастомизацией
**Время**: 3-4 часа

**Задачи**:
- [ ] Whisper integration enhancement
- [ ] Multi-language support
- [ ] Custom subtitle styling
- [ ] Timing и positioning
- [ ] VTT/SRT export

**Критерии завершения**:
- Multi-lang Whisper support
- Custom subtitle styles
- Proper timing

---

### ЭТАП 8: MCP SERVER ENHANCEMENT
**Цель**: Полноценный MCP для n8n агентов
**Время**: 2-3 часа

**Задачи**:
- [ ] File operations (get, list, upload)
- [ ] Code search enhancement
- [ ] Better SSE implementation
- [ ] Authentication/security
- [ ] n8n integration tests

**Критерии завершения**:
```bash
curl http://localhost:5123/mcp/files
curl "http://localhost:5123/mcp/search?q=MediaCreator"
```

---

### ЭТАП 9: ТЕСТИРОВАНИЕ И КАЧЕСТВО
**Цель**: Покрытие тестами и стабилизация
**Время**: 4-5 часов

**Задачи**:
- [ ] Unit tests для основных компонентов
- [ ] Integration tests для API
- [ ] Load testing с видео обработкой
- [ ] Error handling и logging
- [ ] Performance benchmarks

**Критерии завершения**:
- >80% test coverage
- All critical paths tested
- Performance benchmarks documented

---

### ЭТАП 10: DEPLOYMENT И PRODUCTION READY
**Цель**: Production-ready система
**Время**: 2-3 часа

**Задачи**:
- [ ] Environment configuration
- [ ] Health checks и monitoring
- [ ] Production Docker optimization
- [ ] Documentation updates
- [ ] Performance tuning
- [ ] Security review

**Критерии завершения**:
- Production-ready deployment
- Proper monitoring
- Complete documentation

---

## ПРИОРИТЕТЫ

**КРИТИЧЕСКИЕ (должны быть первыми)**:
1. ЭТАП 1: Архитектура и портфолио проблем
2. ЭТАП 2: Основной Video Maker API

**ВАЖНЫЕ**:
3. ЭТАП 3: Медиа pipeline
4. ЭТАП 4: Эффекты

**ЖЕЛАТЕЛЬНЫЕ**:
5-10. Остальные этапы

---

## СЛЕДУЮЩИЕ ШАГИ

Сейчас начнём с **ЭТАПА 1** - исправление архитектуры и критических проблем.

Команды для начала:
```bash
npm run build  # проверить текущие ошибки
npm run start  # проверить что запускается
```

---
*Создано: 2025-01-27*

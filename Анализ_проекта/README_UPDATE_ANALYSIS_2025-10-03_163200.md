# 2025-10-03 16:32:00 - Анализ обновления README с точными командами и портами

## Обновления внесённые в README.md

### ✅ Основная информация
- **Заголовок**: `media-video-maker` → `Media Video Maker Server`
- **Описание**: Добавлено упоминание REST API и MCP протокола
- **Эмодзи-секции**: Добавлены 🚀, 📡, 🔧, 🔄 для удобства навигации

### ✅ Точные точки входа сервиса  
```bash
- REST API: http://localhost:4123 (основной сервис)
- MCP Server: http://localhost:5123 (интеграция с AI)
```

### ✅ Полный список ENV переменных с примерами
Добавлен раздел переменных окружения с пояснениями:
- **Обязательные**: MEDIA_PORT, LOG_LEVEL
- **Папки данных**: OUTPUT_DIR, ASSETS_DIR, PROJECT_ROOT  
- **TTS сервисы**: KOKORO_TTS_URL, OPENAI_API_KEY, OPENAI_BASE_URL
- **Шрифты**: FONT_FILE

### ✅ Актуальные npm команды
```bash
npm run dev          # Запуск в режиме разработки с ts-node
npm run build        # Сборка TypeScript → dist/
npm run check        # Проверка типов без сборки  
npm run start        # Запуск production сборки
```

### ✅ Рекомендуемый продакшн запуск
```bash
cd /root/media-video-maker_project/media-video-maker_server
git pull origin main
npm run build
nohup node dist/media-server.js > server.log 2>&1 &

# Проверка запуска
ps aux | grep media-server
curl http://localhost:4123/api/health
```

### ✅ API Эндпоинты с curl примерами

#### Health Check:
```bash
curl http://localhost:4123/api/health
# Ожидаемый ответ: {"status":"ok","timestamp":"2025-10-03T16:30:00.000Z","uptime":12345}
```

#### Создание видео:
```bash
curl -X POST http://localhost:4123/api/create-video \
  -H 'Content-Type: application/json' \
  -d '{
    "files": [{"id": "img1", "src": "/path/to/image.jpg", "type": "photo"}],
    "width": 640,
    "height": 360,
    "durationPerPhoto": 2.0
  }'
```

#### Статус работы:  
```bash
curl http://localhost:4123/api/status/JOB_UUID_HERE
```

#### Диагностика системы:
```bash
curl http://localhost:4123/api/diagnostic
```

### ✅ Раздел диагностики и отладки

#### Частые проблемы и их решения:
- **Сервис не запускается**: команды проверки портов и логов
- **Тесты падают с ошибкой 400**: исправление схемы (`type: "photo"`)
- **TTS не работает**: проверка API ключей  
- **Нет места на диске**: команды проверки и очистки

#### Мониторинг ресурсов:
```bash
ps aux | grep media-server                    # Использование памяти
curl http://localhost:4123/api/jobs           # Активные задачи  
curl http://localhost:4123/api/diagnostic   # Статистика системы
```

### ✅ Структура проекта разработки
```
src/
├── media-server.ts          # Основной сервер  
├── server/                  # HTTP маршруты
├── pipeline/                # Видео кранчинговый пайплайн
├── audio/                   # TTS и аудио обработка
├── utils/                   # Утилиты (логи, файлы, папки)
└── types/                   # TypeScript типы
```

### ✅ Принципы разработки (обновлены)
- Все изменения в feature ветках (`feature/module/short_desc`)
- Обязательное тестирование через модульные тесты
- Отчеты сохраняются в `Анализ_проекта/` с датой/временем  
- На сервер деплой только из `main`

### ✅ Процедура получения изменений на сервер
```bash
ssh root@178.156.142.35
cd /root/media-video-maker_project  
git pull origin main
npm run build
pkill -f media-server
nohup node dist/media-server.js > server.log 2>&1 &
```

## Сохранены существующие разделы:
- ✅ Структура тестирования модулей
- ✅ Команды запуска тестов
- ✅ Принципы тестирования
- ✅ Требования для тестов

## Добавлена актуальная информация из сервера:
- ✅ Точные порты (4123, 5123)
- ✅ Реальные npm скрипты из package.json
- ✅ Фактические пути папок проекта
- ✅ Текущий статус процесса на сервере

## Преимущества обновлённого README:
1. **Полная документация**: все команды с примерами
2. **Диагностика**: решения частых проблем  
3. **Продакшн готовность**: процедуры развертывания
4. **Разработчики**: принципы и workflow
5. **Актуальность**: проверенная информация с сервера

## Статус задачи T36: ✅ ВЫПОЛНЕНО
- ✅ README обновлен с точными командами и портами
- ✅ Добавлены все ENV переменные с примерами
- ✅ Включены API эндпоинты с curl примерами
- ✅ Создан раздел диагностики и отладки
- ✅ Описаны принципы разработки и процедуры деплоя

## Следующие задачи:
- T37: Подготовить скрипт диагностики окружения
- T38: Оценить производительность системы
- T39: Приоритезированный план работ P0/P1/P2

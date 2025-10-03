# 2025-10-03 16:28:30 - Инструкции по верификации фиксов и rollback

## Методология тестирования фиксов

### ЭТАП 1: Подготовка тестовой ветки
```bash
# Создание фича-ветки для изменения  
git checkout -b feature/module/short_description
# Например: feature/env/add-env-variables
```

### ЭТАП 2: Локальное тестирование
```bash
cd media-video-maker_server

# Проверка типов и сборки
npm run build
npm run type-check  

# Запуск локального сервера (если возможно)
npm run dev  # или node dist/media-server.js

# Тестирование API
curl -X POST http://localhost:4123/api/health
```

### ЭТАП 3: Модульные тесты (ОБЯЗАТЕЛЬНО)
```bash
# Запуск всех модульных тестов
cd tests/
./run_all_tests.sh

# Индивидуальные тесты модулей  
./test_subtitles.sh
./test_voiceover.sh
./test_overlays.sh  
./test_music.sh
```

### ЭТАП 4: Проверка результатов
```bash
# Проверка выходных файлов
ls -la tests/output/
ffprobe tests/output/видео.mp4  # проверка качества

# Проверка логов
tail -f logs/module_name.log
```

## Производственная верификация на сервере

### ШАГ 1: Безопасное развёртыванием
```bash
# Подключение к серверу
ssh root@178.156.142.35

# Переход в проект
cd /root/media-video-maker_project

# Pull изменений
git fetch origin
git checkout main
git pull origin main
```

### ШАГ 2: Проверка целостности  
```bash
# Пересборка (если нужно)
cd media-video-maker_server
npm run build

# Проверка типов  
npm run type-check

# Проверка структуры файлов
ls -la dist/
```

### ШАГ 3: Постепенный запуск
```bash
# Остановка текущего процесса
ps aux | grep media-server
kill PID_CURRENT_PROCESS

# Проверка здоровья системы
free -m  # память
df -h    # диск
```

### ШАГ 4: Запуск нового процесса
```bash
# Запуск в фоне
nohup node dist/media-server.js > server.log 2>&1 &

# Проверка запуска
ps aux | grep media-server
```

### ШАГ 5: Smoke-тест
```bash
# Проверка API
curl http://localhost:4123/api/health

# Проверка создания видео
curl -X POST http://127.0.0.1:4123/api/create-video \
  -H 'Content-Type: application/json' \
  -d '{"files":[{"id":"test","src":"/root/media-video-maker_project/media-video-maker_server/test_image.jpg","type":"photo"}],"width":100,"height":50,"durationPerPhoto":1}'
```

## План быстрого rollback

### КРИТИЧНЫЙ СЦЕНАРИЙ: Немедленный откат
```bash
# Если сервер сломался полностью

# 1. Немедленная остановка процесса
pkill -f media-server

# 2. Откат к предыдущей стабильной версии  
git log --oneline -5  # поиск стабильного коммита
git checkout STABLE_COMMIT_HASH

# 3. Перезапуск системы
nohup node dist/media-server.js > backup.log 2>&1 &

# 4. Проверка восстановления
curl http://localhost:4123/api/health
```

### КОНТРОЛИРУЕМЫЙ ROLLBACK
```bash
# Если есть время на диагностику

# 1. Сбор информации о проблеме
curl http://localhost:4123/api/diagnostic
tail -f server.log

# 2. Откат к конкретной ветке
git checkout feature/previous-stable-branch

# 3. Пересборка и рестарт
npm run build
npm run restart  # если есть такой скрипт
```

## Чеклист верификации (для каждого фикса)

### ✅ ПРЕДВАРИТЕЛЬНАЯ ПРОВЕРКА
- [ ] Код компилируется без ошибок (`npm run build`)
- [ ] Типы валидны (`npm run type-check`)  
- [ ] Модульные тесты проходят (`./tests/run_all_tests.sh`)
- [ ] Создается реальное видео в `/tests/output/`

### ✅ РАЗВЁРТЫВАНИЕ
- [ ] SSH подключение к серверу успешно
- [ ] `git pull` обновил код без конфликтов
- [ ] Старый процесс остановлен корректно
- [ ] Новый процесс запущен и активен

### ✅ ПОСТ-РАЗВЁРТЫВАНИЕ  
- [ ] Health check возвращает статус ОК
- [ ] Smoke test создаёт job успешно
- [ ] Логи не содержат критичных ошибок
- [ ] Память и CPU находятся в норме

### ✅ ROLLBACK ГОТОВНОСТЬ
- [ ] Идентифицирован стабильный коммит для отката
- [ ] Подготовлены команды для быстрого rollback  
- [ ] Протестирован сценарий отката локально

## Мониторинг качества

### Логи для отслеживания:
```bash
# Лог запуска сервера
tail -f server.log

# Логи модулей (если настроены)  
tail -f logs/subtitles.log
tail -f logs/music.log

# Системные логи
journalctl -u media-server -f  # если настроен systemd
```

### Метрики для проверки:
- **Время отклика API**: `curl -w "@curl-format.txt" http://localhost:4123/api/health`
- **Память процесса**: `ps aux | grep media-server`  
- **Размер логов**: `du -sh logs/`
- **Место на диске**: `df -h`

## Аварийные процедуры

### Если тесты падают:
```bash
# Откат к локальной стабильной версии
git checkout main
git revert PROBLEM_COMMIT_HASH
git push origin main
```

### Если API не отвечает:
```bash
# Проверка портов 
netstat -tulpn | grep 4123

# Перезапуск с debug
LOG_LEVEL=debug nohup node dist/media-server.js > debug.log 2>&1 &
```

### Если система нестабильна:
```bash
# Экстренный отказ к docker (если доступен)
docker-compose down
docker-compose up -d

# Или полный сброс к git HEAD
git checkout HEAD~1
npm run build && npm start
```

## Статус задачи T35: ✅ ВЫПОЛНЕНО
- ✅ Методология тестирования подготовлена
- ✅ Сценарии rollback разработаны  
- ✅ Чеклист верификации составлен
- ✅ Команды для аварийных ситуаций готовы

## Следующие задачи:
- T36: Обновить README/QUICK_START
- T37: Подготовить скрипт диагностики  
- T38: Оценить производительность

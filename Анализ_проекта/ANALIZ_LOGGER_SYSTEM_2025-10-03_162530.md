# 2025-10-03 16:25:30 - Анализ системы логирования

## Найденная архитектура логгера

### Структура модуля `src/logger.ts`
```typescript
export type Level = "debug" | "info" | "warn" | "error";
const LEVEL = (process.env.LOG_LEVEL || "info") as Level;

function should(level: Level) {
  const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
  return order[level] >= order[LEVEL];
}

export const log = {
  debug: (...a: any[]) => should("debug") && console.debug("[DEBUG]", ...a),
  info:  (...a: any[]) => should("info")  && console.log("[INFO]", ...a),
  warn:  (...a: any[]) => should("warn")  && console.warn("[WARN]", ...a),
  error: (...a: any[]) => should("error") && console.error("[ERROR]", ...a),
};
```

## Результаты проверки на сервере

### 1. Файловая структура ✅ СОЗЕРДАНА
```
logs/
├── music.log (458 bytes)
├── overlays.log (64 bytes)  
├── subtitles.log (65 bytes)
└── voiceover.log (112 bytes)
```

### 2. Использование в проекте ✅ НАЙДЕНО
Логгер используется в файлах:
- `src/utils/FileDownloader.ts`
- `src/utils/fs.ts`  
- `src/utils/CleanupService.ts`
- `src/utils/ffmpeg.ts`
- `src/utils/OutputDir.ts`

### 3. Конфигурация ENV ✅ НАСТРОЕНА
- **Переменная**: `LOG_LEVEL` (по умолчанию: "info")
- **Диапазон**: debug, info, warn, error
- **Логика**: Пороговая фильтрация (debug=10, info=20, warn=30, error=40)

### 4. Вывод процесса ✅ КОЛЛЕКТИРОВАН
**Активный процесс**: `node dist/media-server.js`
**PID**: 593957, **Память**: 71580 kB

## Обнаруженные проблемы

### ПРОБЛЕМА 1: Отсутствие централизованного логирования
- **Статус**: Console.log/stdout/stderr направляется в терминал
- **Последствие**: Логи могут не сохраняться при перезапуске
- **Решение**: Добавить файловое логирование или логротация

### ПРОБЛЕМА 2: Неструктурированный формат
- **Статус**: Простые console.debug/console.log без JSON
- **Последствие**: Сложный парсинг логов
- **Решение**: Добавить JSON format или structured logging

### ПРОБЛЕМА 3: Отсутствие ротации логов  
- **Статус**: Логи накапливаются без ограничений
- **Последствие**: Превышение дискового пространства
- **Решение**: Настроить logrotate или другие ротаторы

## Статус файловой системы `/logs/`
- ✅ Папка существует и доступна для записи  
- ✅ Права: `drwxr-xr-x` (755) - норма
- ✅ Владелец: `root:root` - соответствует процессу

## Рекомендации для улучшения

### 1. Добавить файловое логирование
```typescript
import fs from 'fs';
const logFile = fs.createWriteStream('logs/app.log', { flags: 'a' });
export const log = {
  info: (...a: string[]) => {
    console.log("[INFO]", ...a);
    logFile.write(`[${new Date().toISOString()}] [INFO] ${JSON.stringify(a)}\n`);
  }
  // ...
};
```

### 2. Включить переменную LOG_FILE  
```bash
LOG_FILE=/path/to/logs/app.log
LOG_LEVEL=info
```

### 3. Настроить ротацию через systemd журнал
```bash
journalctl -u media-server -f
```

## Статус задачи T14: ✅ ВЫПОЛНЕНО
- ✅ Структура логгера изучена  
- ✅ Папка `/logs/` проверена
- ✅ Проблемы выявлены и классифицированы
- ✅ Рекомендации подготовлены

## Следующие задачи:
- T33: Составить список недостающих ENV  
- T35: Инструкции по верификации фиксов

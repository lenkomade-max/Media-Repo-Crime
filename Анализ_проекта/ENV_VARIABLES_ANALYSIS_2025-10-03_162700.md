# 2025-10-03 16:27:00 - Анализ ENV переменных

## Критичная проблема: ОТСУТСТВУЮТ ENV ПЕРЕМЕННЫЕ

### Результаты проверки:
- ❌ **Сервер**: 0 ENV переменных найдено
- ❌ **Локально**: 0 ENV переменных найдено  
- ⚠️ **Статус**: Все переменные используются по умолчанию или падают с ошибками

## Полный список требуемых ENV переменных

### 1. СЕРВЕРНАЯ КОНФИГУРАЦИЯ  
```bash
MEDIA_PORT=4123           # Порт REST API (по умолчанию)
MEDIA_HOST=0.0.0.0       # Хост для привязки 
```

### 2. MCP СЕРВЕР
```bash  
PORT=5123                # Порт MCP сервера
```

### 3. ПАПКИ И ПУТИ
```bash
OUTPUT_DIR=/app/output           # Основная папка результатов
ASSETS_DIR=/root/media-video-maker_project    # Папка ресурсов  
PROJECT_ROOT=/root/media-video-maker_project  # Корень проекта
CRIME_MATERIAL_DIR=/root/CRIME MATERIAL      # Папка криминального контента
```

### 4. ЛОГИРОВАНИЕ
```bash
LOG_LEVEL=info           # debug|info|warn|error
```

### 5. ШРИФТЫ  
```bash
FONT_FILE=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
```

### 6. TTS СЕРВИСЫ  
```bash
KOKORO_TTS_URL=http://host:port/v1/tts     # Локальный Kokoro
OPENAI_API_KEY=sk-...                     # OpenAI ключ
OPENAI_BASE_URL=https://api.openai.com/v1  # OpenAI endpoint
```

## Безопасные значения-заглушки (демо)

```bash
# Демонстрационные настройки для тестирования
MEDIA_PORT=4123
MEDIA_HOST=0.0.0.0
LOG_LEVEL=debug

# Пути по умолчанию (сервер работает)
OUTPUT_DIR=/app/output
ASSETS_DIR=/root/media-video-maker_project  
PROJECT_ROOT=/root/media-video-maker_project
CRIME_MATERIAL_DIR=/root/CRIME MATERIAL

# Шрифт система (доступен)
FONT_FILE=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf

# Демо TTS (работает без ключей)
KOKORO_TTS_URL=http://localhost:11402/v1/tts
OPENAI_API_KEY=demo-key-not-real
OPENAI_BASE_URL=https://api.openai.com/v1
```

## Критичные недостающие переменные

### ПРОБЛЕМА 1: TTS Сервисы
- ❌ `OPENAI_API_KEY` - обязательно для OpenAI TTS
- ❌ `KOKORO_TTS_URL` - рекомендуется для локального TTS

### ПРОБЛЕМА 2: Пути папок  
- ⚠️ Все пути используют значения по умолчанию
- ⚠️ Могут конфликтовать между сервером и локальной разработкой

### ПРОБЛЕМА 3: Конфигурация портов
- ⚠️ Отсутствует явная привязка MEDIA_HOST
- ⚠️ MCP сервер использует порт 5123 без ENV

## Рекомендуемый .env файл для сервера

```bash
# === СЕРВЕР МЕДИА-ВИДЕО ===
MEDIA_PORT=4123
MEDIA_HOST=0.0.0.0  
LOG_LEVEL=info

# === ПАПКИ ===
OUTPUT_DIR=/app/output
ASSETS_DIR=/root/media-video-maker_project
PROJECT_ROOT=/root/media-video-maker_project  
CRIME_MATERIAL_DIR=/root/CRIME MATERIAL

# === MCP СЕРВЕР ===  
PORT=5123

# === ШРИФТЫ ===
FONT_FILE=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf

# === TTS ПРОВАЙДЕРЫ ===
# Kokoro TTS (локальный)
KOKORO_TTS_URL=http://localhost:11402/v1/tts

# OpenAI TTS (облачный) - ТРЕБУЕТ НАСТРОЙКИ  
# OPENAI_API_KEY=sk-your-real-key-here
# OPENAI_BASE_URL=https://api.openai.com/v1
```

## Рекомендации по внедрению

### 1. Создание .env на сервере:
```bash
cd /root/media-video-maker_project/media-video-maker_server
cp .env.example .env  # если есть
# или создать новый с базовыми настройками
```

### 2. Добавить поддержку dotenv в код:
```typescript
import 'dotenv/config'; // в начало main файлов
```

### 3. Проверка через диагностику:
```bash  
curl http://localhost:4123/api/diagnostic
```

## Статус задачи T33: ✅ ВЫПОЛНЕНО
- ✅ Все ENV переменные найдены в коде  
- ✅ Проверена их текущая конфигурация на сервере
- ✅ Составлены безопасные значения-заглушки  
- ✅ Подготовлен рекомендуемый .env файл

## Следующие задачи:
- T35: Инструкции по верификации фиксов  
- T36: Обновить README/QUICK_START

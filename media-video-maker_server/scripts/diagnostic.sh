#!/bin/bash

# Скрипт диагностики окружения и health check
# Автор: AI Analysis 2025-10-03
# Использование: ./scripts/diagnostic.sh [--verbose]

set -euo pipefail

# Настройки
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_DIR}/logs/diagnostic.log"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Опция verbose
VERBOSE=false
if [[ "${1:-}" == "--verbose" ]]; then
    VERBOSE=true
fi

# Функции логирования
log() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[OK]${NC}      $1" | tee -a "$LOG_FILE"
}

# Создание папки логов
mkdir -p "$(dirname "$LOG_FILE")"

echo "=================================================="
echo "🔍 ДИАГНОСТИКА ОКРУЖЕНИЯ MEDIA VIDEO MAKER"
echo "=================================================="
echo "Время: $(date)"
echo "Проект: $PROJECT_DIR"
echo "Лог: $LOG_FILE"
echo "=================================================="

# 1. СИСТЕМНАЯ ИНФОРМАЦИЯ
log "Проверка системной информации..."
echo
echo "=== СИСТЕМА ==="

# OS и версия
if command -v uname >/dev/null 2>&1; then
    success "OS: $(uname -a)" 
else
    error "uname недоступен"
fi

# Информация о памяти
if command -v free >/dev/null 2>&1; then
    MEM_INFO=$(free -m)
    success "Память (MB):"
    echo "$MEM_INFO" | tee -a "$LOG_FILE"
else
    error "free недоступен"
fi

# Дисковое пространство
if command -v df >/dev/null 2>&1; then
    success "Диск:"
    df -h | tee -a "$LOG_FILE"
else
    error "df недоступен"
fi

echo

# 2. РУНТАЙМ СРЕДА
log "Проверка runtime среды..."
echo
echo "=== RUNTIME ==="

# Node.js версия
if command -v node >/dev/null 2>&1; then
    success "Node.js: $(node --version)"
else
    error "Node.js не найден"
fi

# NPM версия  
if command -v npm >/dev/null 2>&1; then
    success "NPM: $(npm --version)"
else
    error "NPM не найден"
fi

# FFmpeg версия
if command -v ffmpeg >/dev/null 2>&1; then
    success "FFmpeg: $(ffmpeg -version | head -1)"
else
    error "FFmpeg не найден"
fi

# FFprobe версия
if command -v ffprobe >/dev/null 2>&1; then
    success "FFprobe: $(ffprobe -version | head -1)"
else
    error "FFprobe не найден"
fi

# Whisper CLI
if command -v whisper >/dev/null 2>&1; then
    success "Whisper CLI: $(whisper --version || echo 'установлен')"
else
    warn "Whisper CLI не найден"
fi

echo

# 3. ПРОЕКТ И ДЕПЕНДЕНСЫ  
log "Проверка проекта и зависимостей..."
echo
echo "=== ПРОЕКТ ==="

# Package.json
if [[ -f "$PROJECT_DIR/package.json" ]]; then
    success "package.json найден"
    if [[ "$VERBOSE" == "true" ]]; then
        echo "Скрипты:"
        cat "$PROJECT_DIR/package.json" | jq '.scripts // empty' || echo "jq недоступен"
    fi
else
    error "package.json не найден в $PROJECT_DIR"
fi

# Node modules
if [[ -d "$PROJECT_DIR/node_modules" ]]; then
    NODEMOD_SIZE=$(du -sh "$PROJECT_DIR/node_modules" 2>/dev/null | cut -f1)
    success "node_modules: $NODEMOD_SIZE"
else
    error "node_modules не найдена"
fi

# Dist директория
if [[ -d "$PROJECT_DIR/dist" ]]; then
    DIST_SIZE=$(du -sh "$PROJECT_DIR/dist" 2>/dev/null | cut -f1)
    success "dist/: $DIST_SIZE"
else
    warn "dist/ не найдена (нужна сборка)"
fi

# TypeScript конфигурация
if [[ -f "$PROJECT_DIR/tsconfig.json" ]]; then
    success "tsconfig.json найден"
else
    error "tsconfig.json не найден"
fi

echo

# 4. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ
log "Проверка переменных окружения..."
echo
echo "=== ENV VARIABLES ==="

# Проверка конкретных ENV
ENV_VARS=(
    "MEDIA_PORT"
    "MEDIA_HOST" 
    "LOG_LEVEL"
    "OUTPUT_DIR"
    "ASSETS_DIR"
    "PROJECT_ROOT"
    "KOKORO_TTS_URL"
    "OPENAI_API_KEY"
    "OPENAI_BASE_URL"
    "FONT_FILE"
)

for var in "${ENV_VARS[@]}"; do
    if [[ -n "${!var:-}" ]]; then
        if [[ "$var" == "OPENAI_API_KEY" ]]; then
            success "$var: [СКРЫТО]"
        else
            success "$var: ${!var}"
        fi
    else
        warn "$var: не установлена"
    fi
done

echo

# 5. СЕТЬ И ПОРТЫ
log "Проверка портов и сети..."
echo
echo "=== СЕТЬ ==="

# Проверка портов медиа-сервера
MEDIA_PORT="${MEDIA_PORT:-4123}"
MCP_PORT="${PORT:-5123}"

# Активные соединения
if command -v netstat >/dev/null 2>&1; then
    success "Активные порты 4123/5123:"
    netstat -tulpn 2>/dev/null | grep -E ":${MEDIA_PORT}|:${MCP_PORT}" || echo "Порты не слушаются"
else
    warn "netstat недоступен"
fi

# Проверка доступности localhost
if ping -c 1 localhost >/dev/null 2>&1; then
    success "localhost доступен"
else
    error "localhost недоступен"
fi

echo

# 6. ПРОЦЕССЫ И СЕРВИСЫ
log "Прованка процессов media-server..."
echo
echo "=== ПРОЦЕССЫ ==="

# Поиск процессов media-server
MEDIA_PROCS=$(ps aux | grep -E '(media-server|node.*dist)' | grep -v grep || true)

if [[ -n "$MEDIA_PROCS" ]]; then
    success "Найдены процессы media-server:"
    echo "$MEDIA_PROCS" | tee -a "$LOG_FILE"
else
    warn "Процессы media-server не найдены"
fi

# Проверка systemd службы (если есть)
if command -v systemctl >/dev/null 2>&1; then
    SYSTEMD_UNIT="media-server.service"
    if systemctl list-units --type=service | grep -q "$SYSTEMD_UNIT"; then
        success "Systemd сервис: $(systemctl is-active "$SYSTEMD_UNIT")"
    else
        warn "Systemd сервис не настроен"
    fi
fi

echo

# 7. HEALTH CHECK
log "Проверка health endpoints..."
echo
echo "=== HEALTH CHECK ==="

# HTTP health check
for port in "$MEDIA_PORT" "$MCP_PORT"; do
    if curl -s --max-time 5 "http://localhost:$port/api/health" >/dev/null 2>&1; then
        success "Порт $port: ОК"
        # Получение детального ответа
        HEALTH_RESPONSE=$(curl -s --max-time 5 "http://localhost:$port/api/health" 2>/dev/null || echo "{}")
        if [[ "$VERBOSE" == "true" && "$HEALTH_RESPONSE" != "{}" ]]; then
            echo "Ответ: $HEALTH_RESPONSE"
        fi
    else
        warn "Порт $port: недоступен"
    fi
done

echo

# 8. ФАЙЛЫ И ПАПКИ  
log "Проверка файловой системы..."
echo
echo "=== ФАЙЛЫ ==="

# Критичные папки
CRITICAL_DIRS=(
    "/app/output"
    "/root/media-video-maker_project"
    "/root/CRIME MATERIAL"
)

for dir in "${CRITICAL_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        PERMS=$(stat -c "%a" "$dir" 2>/dev/null || echo "??")
        SIZE=$(du -sh "$dir" 2>/dev/null | cut -f1)
        success "Директория $dir: [$PERMS] $SIZE"
    else
        warn "Директория $dir: не найдена"
    fi
done

# Шрифты
if [[ -f "${FONT_FILE:-/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf}" ]]; then
    success "Шрифт дефолт: установлен"
else
    warn "Шрифт дефолт: не найден"
fi

echo

# 9. ТЕСТЫ МОДУЛЕЙ
log "Проверка модульных тестов..."
echo  
echo "=== МОДУЛЬНЫЕ ТЕСТЫ ==="

TEST_DIR="$PROJECT_DIR/tests"
if [[ -d "$TEST_DIR" ]]; then
    success "Папка тестов: найдена"
    
    # Проверка исполняемости скриптов тестов
    TEST_SCRIPTS=("run_all_tests.sh" "test_subtitles.sh" "test_voiceover.sh" "test_overlays.sh" "test_music.sh")
    for script in "${TEST_SCRIPTS[@]}"; do
        if [[ -f "$TEST_DIR/$script" && -x "$TEST_DIR/$script" ]]; then
            success "Тест $script: исполняемый"
        elif [[ -f "$TEST_DIR/$script" ]]; then
            warn "Тест $script: не исполняемый (нужен chmod +x)"
        else
            warn "Тест $script: не найден"
        fi
    done
else
    error "Папка тестов: не найдена"
fi

echo

# 10. АНАЛИЗА ПРОБЛЕМ
log "Анализ потенциальных проблем..."
echo
echo "=== АНАЛИЗ ПРОБЛЕМ ==="

ISSUES=0

# Проверка свободного места (менее 1GB)
DISK_FREE=$(df / | awk 'NR==2 {print $4}' 2>/dev/null || echo "0")
if [[ "$DISK_FREE" -lt 1000000 ]]; then
    error "Мало места на диске: ${DISK_FREE}KB свободно"
    ISSUES=$((ISSUES + 1))
else
    success "Места на диске достаточно: ${DISK_FREE}KB"
fi

# Проверка нагрузки памяти
MEM_USED=$(free | awk 'NR==2{printf "%.0f", $3/$2 * 100.0}' 2>/dev/null || echo "0")
if [[ "$MEM_USED" -gt 90 ]]; then
    error "Высокая нагрузка памяти: ${MEM_USED}% используется"
    ISSUES=$((ISSUES + 1))
elif [[ "$MEM_USED" -gt 75 ]]; then
    warn "Средняя нагрузка памяти: ${MEM_USED}% используется"
else
    success "Нагрузка памяти нормальная: ${MEM_USED}% используется"
fi

# Проверка недоступности сервиса
if ! curl -s --max-time 5 "http://localhost:$MEDIA_PORT/api/health" >/dev/null 2>&1; then
    error "Медиа сервер недоступен на порту $MEDIA_PORT"
    ISSUES=$((ISSUES + 1))
fi

echo

# 11. ИТОГОВЫЙ ОТЧЁТ
log "Генерация итогового отчёта..."
echo
echo "=================================================="
echo "📊 ИТОГОВЫЙ ОТЧЁТ"
echo "=================================================="

if [[ $ISSUES -eq 0 ]]; then
    success "Окружение полностью совместимо - проблемы не обнаружены"
else
    warn "Обнаружено $ISSUES проблем(ы) в окружении"
fi

# Резюме по компонентам
echo
echo "Резюме компонентов:"
echo "- Node.js/NPM: $(command -v node >/dev/null && echo "✅" || echo "❌")"
echo "- FFmpeg: $(command -v ffmpeg >/dev/null && echo "✅" || echo "❌")" 
echo "- Медиа сервер: $(curl -s --max-time 5 "http://localhost:$MEDIA_PORT/api/health" >/dev/null 2>&1 && echo "✅" || echo "❌")"
echo "- Модули проекта: $([ -d "$PROJECT_DIR/src" ] && echo "✅" || echo "❌")"
echo "- Тесты: $([ -d "$TEST_DIR" ] && echo "✅" || echo "❌")"

echo
echo "📋 Полный лог сохранен в: $LOG_FILE"

if [[ "$VERBOSE" == "true" ]]; then
    echo
    echo "Для анализа дополнительных компонентов запустите:"
    echo "  npm run check           # Проверка TypeScript"
    echo "  ./tests/test_subtitles.sh   # Тест субтитров" 
    echo "  curl http://localhost:$MEDIA_PORT/api/diagnostic  # Детальная диагностика"
fi

echo "=================================================="
exit $ISSUES

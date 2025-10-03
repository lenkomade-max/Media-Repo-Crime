#!/bin/bash

# Скрипт проверки ассетов и портов для media-video-maker
# Согласно TODO_FIX_PLAN.md задачи #10-11

echo "🔍 ПРОВЕРКА АССЕТОВ И ПОРТОВ"
echo "============================="

# 1. Проверка VHS ассетов
echo ""
echo "📁 Проверка VHS файлов:"
VHS_FILES=(
    "/root/media-video-maker_project/assets/VHS 01 Effect.mp4"
    "/root/media-video-maker_project/assets/VHS 02 Effect.mp4"
)

for vhs_file in "${VHS_FILES[@]}"; do
    if [ -f "$vhs_file" ]; then
        echo "✅ $vhs_file ($(du -h "$vhs_file" | cut -f1))"
    else
        echo "❌ $vhs_file (НЕ НАЙДЕН)"
    fi
done

# 2. Проверка симлинка CRIME MATERIAL
echo ""
echo "🔗 Проверка симлинка CRIME MATERIAL:"
if [ -L "/root/CRIME MATERIAL" ]; then
    target=$(readlink "/root/CRIME MATERIAL")
    echo "✅ Симлинк существует: /root/CRIME MATERIAL -> $target"
elif [ -d "/root/CRIME MATERIAL" ]; then
    echo "✅ Директория существует: /root/CRIME MATERIAL"
    echo "   Файлов: $(ls -1 "/root/CRIME MATERIAL" 2>/dev/null | wc -l)"
else
    echo "❌ /root/CRIME MATERIAL не найден"
    echo "💡 Создайте симлинк: ln -s /path/to/crime/materials \"/root/CRIME MATERIAL\""
fi

# 3. Проверка занятых портов
echo ""
echo "🔌 Проверка портов:"
PORTS=(4124 5123 8080)
for port in "${PORTS[@]}"; do
    if netstat -tuln 2>/dev/null | grep ":$port " > /dev/null; then
        echo "🔴 Порт $port ЗАНЯТ"
        # Показать процесс
        process=$(lsof -ti :$port 2>/dev/null | head -1)
        if [ -n "$process" ]; then
            echo "   Процесс: $(ps -p $process -o pid,comm= 2>/dev/null || echo "неизвестен")"
        fi
    else
        echo "✅ Порт $port свободен"
    fi
done

# 4. Проверка доступности шрифтов (Задача #17)
echo ""
echo "🔤 Проверка шрифтов:"

# Основные кандидаты
FONT_PATHS=(
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    "/usr/share/fonts/dejavu/DejaVuSans.ttf"
    "/usr/share/fonts/TTF/DejaVuSans.ttf"
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
    "/usr/share/fonts/liberation/LiberationSans-Regular.ttf"
    "/System/Library/Fonts/Helvetica.ttc"
    "/System/Library/Fonts/Arial.ttf"
)

FOUND_FONT=""
for font in "${FONT_PATHS[@]}"; do
    if [ -f "$font" ]; then
        echo "✅ $font ($(du -h "$font" | cut -f1))"
        [ -z "$FOUND_FONT" ] && FOUND_FONT="$font"
    else
        echo "⚠️  $font (не найден)"
    fi
done

if [ -n "$FOUND_FONT" ]; then
    echo "✅ Система найдет шрифт: $FOUND_FONT"
else
    echo "❌ Шрифты НЕ НАЙДЕНЫ!"
    echo "💡 Установите: apt-get install fonts-dejavu-core (Linux)"
fi

# Проверка FONT_FILE env
if [ -n "$FONT_FILE" ]; then
    if [ -f "$FONT_FILE" ]; then
        echo "✅ FONT_FILE: $FONT_FILE"
    else
        echo "❌ FONT_FILE недоступен: $FONT_FILE"
    fi
fi

# 5. Проверка OUTPUT_DIR (Задача #18)
echo ""
echo "📂 Проверка OUTPUT_DIR:"
OUTPUT_DIR="${OUTPUT_DIR:-/app/output}"

if [ -d "$OUTPUT_DIR" ]; then
    PERMISSIONS=$(ls -ld "$OUTPUT_DIR" | cut -d' ' -f1)
    OWNER=$(ls -ld "$OUTPUT_DIR" | awk '{print $3":"$4}')
    SIZE=$(du -sh "$OUTPUT_DIR" 2>/dev/null | cut -f1 || echo "unknown")
    
    echo "✅ $OUTPUT_DIR существует"
    echo "   Права: $PERMISSIONS ($OWNER)"
    echo "   Размер: $SIZE"
    
    # Проверка прав записи
    if touch "$OUTPUT_DIR/.write_test_$$" 2>/dev/null; then
        echo "✅ Запись доступна"
        rm -f "$OUTPUT_DIR/.write_test_$$"
    else
        echo "❌ Нет прав записи!"
        echo "💡 Исправить: chmod 755 $OUTPUT_DIR"
    fi
    
    # Старые файлы
    OLD_COUNT=$(find "$OUTPUT_DIR" -name "video_*.mp4" -mtime +1 2>/dev/null | wc -l || echo 0)
    if [ "$OLD_COUNT" -gt 0 ]; then
        echo "⚠️  Старых файлов: $OLD_COUNT (>24ч)"
        echo "💡 Очистка: find $OUTPUT_DIR -name 'video_*.mp4' -mtime +1 -delete"
    fi
    
else
    echo "❌ $OUTPUT_DIR не существует"
    echo "💡 Создать: mkdir -p $OUTPUT_DIR && chmod 755 $OUTPUT_DIR"
    
    # Попробуем создать
    if mkdir -p "$OUTPUT_DIR" 2>/dev/null; then
        echo "✅ Автосоздание успешно: $OUTPUT_DIR"
    else
        echo "❌ Не удалось создать (нет прав или неверный путь)"
    fi
fi

# 6. Проверка Whisper CLI (Задача #14)
echo ""
echo "🎤 Проверка Whisper CLI:"

# Python
if command -v python3 >/dev/null 2>&1; then
    python_version=$(python3 --version 2>&1)
    echo "✅ $python_version"
else
    echo "❌ Python3 не найден"
fi

# Whisper CLI
if command -v whisper >/dev/null 2>&1; then
    whisper_version=$(whisper --version 2>&1 | head -1)
    echo "✅ Whisper: $whisper_version"
    
    # Проверка моделей
    echo "   Модели Whisper:"
    for model in tiny base small medium large; do
        model_path="$HOME/.cache/whisper/$model.pt"
        if [ -f "$model_path" ]; then
            echo "   ✅ $model ($(du -h "$model_path" | cut -f1))"
        else
            echo "   ⚠️  $model (не скачана)"
        fi
    done
    
    # Тест Whisper
    echo "   🧪 Тест Whisper (5сек аудио):"
    if [ -f "/tmp/test_whisper.wav" ] || ffmpeg -f lavfi -i "sine=frequency=1000:duration=2" -ar 16000 -ac 1 /tmp/test_whisper.wav -y >/dev/null 2>&1; then
        if whisper /tmp/test_whisper.wav --model tiny --output_format srt --output_dir /tmp >/dev/null 2>&1; then
            if [ -f "/tmp/test_whisper.srt" ]; then
                echo "   ✅ SRT генерация работает ($(wc -l < /tmp/test_whisper.srt) строк)"
                rm -f /tmp/test_whisper.srt
            else
                echo "   ❌ SRT файл не создался"
            fi
        else
            echo "   ❌ Whisper команда неуспешна"
        fi
        rm -f /tmp/test_whisper.wav
    else
        echo "   ⚠️  Не удалось создать тестовое аудио"
    fi
    
else
    echo "❌ Whisper CLI не найден"
    echo "💡 Установите: pip3 install openai-whisper"
fi

# 7. Проверка TTS серверов
echo ""
echo "🔊 Проверка TTS серверов:"
TTS_ENDPOINTS=(
    "http://localhost:8000/synthesize"
    "http://localhost:8000/health"
)

for endpoint in "${TTS_ENDPOINTS[@]}"; do
    if curl -s --connect-timeout 3 "$endpoint" >/dev/null 2>&1; then
        echo "✅ $endpoint доступен"
    else
        echo "❌ $endpoint недоступен"
    fi
done

echo ""
echo "🏁 Проверка завершена"

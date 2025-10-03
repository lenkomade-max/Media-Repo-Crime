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

# 4. Проверка доступности шрифтов
echo ""
echo "🔤 Проверка шрифтов:"
FONT_PATHS=(
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    "/usr/share/fonts/dejavu/DejaVuSans.ttf"
    "/System/Library/Fonts/Helvetica.ttc"
)

for font in "${FONT_PATHS[@]}"; do
    if [ -f "$font" ]; then
        echo "✅ $font"
        break
    else
        echo "⚠️  $font (не найден)"
    fi
done

# 5. Проверка OUTPUT_DIR
echo ""
echo "📂 Проверка OUTPUT_DIR:"
OUTPUT_DIR="${OUTPUT_DIR:-/app/output}"
if [ -d "$OUTPUT_DIR" ]; then
    echo "✅ $OUTPUT_DIR (права: $(ls -ld "$OUTPUT_DIR" | cut -d' ' -f1))"
    echo "   Использовано: $(du -sh "$OUTPUT_DIR" 2>/dev/null | cut -f1)"
else
    echo "❌ $OUTPUT_DIR не существует"
    echo "💡 Создайте директорию: mkdir -p $OUTPUT_DIR"
fi

echo ""
echo "🏁 Проверка завершена"

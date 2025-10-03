#!/bin/bash

# 🚨 СКРИПТ ПОЛНОГО СБРОСА СЕРВЕРА
# Исправляет проблему: старый код (2.0-test) вместо нового (2.1-main)

echo "🚨 ПОЛНЫЙ СБРОС MEDIA VIDEO MAKER СЕРВЕРА"
echo "========================================"

# 1. Убить все старые процессы
echo ""
echo "🔪 Шаг 1: Убиваем все процессы"
pkill -f "node.*media" 2>/dev/null || echo "   Нет процессов media"
pkill -f "node.*index" 2>/dev/null || echo "   Нет процессов index"  
pkill -f "node.*server" 2>/dev/null || echo "   Нет процессов server"
pkill -f "npm start" 2>/dev/null || echo "   Нет npm start"

sleep 2
echo "✅ Все процессы убиты"

# 2. Обновить код
echo ""
echo "📥 Шаг 2: Обновляем код"
cd /root/media-video-maker_project
git status
git pull origin main
echo "✅ Код обновлен до коммита: $(git rev-parse --short HEAD)"

# 3. Полная очистка зависимостей  
echo ""
echo "🧹 Шаг 3: Очистка зависимостей"
cd media-video-maker_server
rm -rf node_modules package-lock.json dist
echo "✅ Кэш очищен"

# 4. Установка зависимостей
echo ""  
echo "📦 Шаг 4: Установка зависимостей"
npm install
if [ $? -eq 0 ]; then
    echo "✅ npm install успешно"
else
    echo "❌ npm install failed!"
    exit 1
fi

# 5. Сборка
echo ""
echo "🏗 Шаг 5: Сборка TypeScript"
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Сборка успешна"
    
    # Проверить что файл создан
    if [ -f "dist/media-server.js" ]; then
        SIZE=$(du -h dist/media-server.js | cut -f1)
        echo "✅ dist/media-server.js создан ($SIZE)"
        
        # Проверить что содержит правильные endpoints
        if grep -q "/api/health" dist/media-server.js; then
            echo "✅ /api/health найден в сборке"
        else
            echo "❌ /api/health НЕ НАЙДЕН в сборке"
        fi
        
        if grep -q "getPendingCount" dist/media-server.js; then
            echo "✅ getPendingCount найден в сборке"
        else
            echo "❌ getPendingCount НЕ НАЙДЕН в сборке"  
        fi
        
    else
        echo "❌ dist/media-server.js НЕ СОЗДАН!"
        exit 1
    fi
else
    echo "❌ Сборка failed!"
    echo "Логи сборки:"
    npm run build
    exit 1
fi

# 6. Запуск нового сервера
echo ""
echo "🚀 Шаг 6: Запуск сервера"
echo "Команда: npm start (должен запустить dist/media-server.js)"

# Запуск в фоне с логированием
npm start > /tmp/media-server.log 2>&1 &
SERVER_PID=$!
echo "Запущен процесс PID: $SERVER_PID"

# Ждем запуска
sleep 5

# 7. Проверка работоспособности
echo ""
echo "🧪 Шаг 7: Проверка endpoints"

# Проверяем что процесс жив
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ Процесс $SERVER_PID работает"
else
    echo "❌ Процесс $SERVER_PID умер! Логи:"
    cat /tmp/media-server.log
    exit 1
fi

# Проверяем порт
if netstat -tuln 2>/dev/null | grep ":4124 " > /dev/null; then
    echo "✅ Порт 4124 слушается"
else
    echo "❌ Порт 4124 НЕ слушается"
    echo "Логи сервера:"
    tail -20 /tmp/media-server.log
    exit 1
fi

# Проверяем версию
echo "🔍 Проверка версии:"
VERSION=$(curl -s --max-time 3 http://localhost:4124/api/ping | jq -r .version 2>/dev/null)
if [ "$VERSION" = "2.1-main" ]; then
    echo "✅ Версия правильная: $VERSION"
elif [ "$VERSION" = "null" ]; then
    echo "❌ /api/ping недоступен или JSON поломан"
else
    echo "❌ Версия неправильная: $VERSION (ожидается 2.1-main)"
fi

# Проверяем health endpoint
echo "🏥 Проверка /api/health:"
HEALTH_STATUS=$(curl -s -w "%{http_code}" --max-time 3 http://localhost:4124/api/health -o /tmp/health.json)
if [ "$HEALTH_STATUS" = "200" ] || [ "$HEALTH_STATUS" = "503" ]; then
    echo "✅ /api/health отвечает (HTTP $HEALTH_STATUS)"
    if [ -f "/tmp/health.json" ]; then
        STATUS=$(jq -r .status /tmp/health.json 2>/dev/null)
        echo "   Status: $STATUS"
    fi
elif [ "$HEALTH_STATUS" = "404" ]; then
    echo "❌ /api/health НЕ НАЙДЕН (HTTP 404)"
    echo "   ПРОБЛЕМА: запущен старый билд!"
else
    echo "❌ /api/health ошибка: HTTP $HEALTH_STATUS"
fi

# Проверяем capabilities 
echo "🔧 Проверка /api/capabilities:"
CAP_STATUS=$(curl -s -w "%{http_code}" --max-time 3 http://localhost:4124/api/capabilities -o /tmp/capabilities.json)
if [ "$CAP_STATUS" = "200" ]; then
    echo "✅ /api/capabilities отвечает"
    READY=$(jq -r .readiness.ready /tmp/capabilities.json 2>/dev/null)
    echo "   System ready: $READY"
elif [ "$CAP_STATUS" = "404" ]; then
    echo "❌ /api/capabilities НЕ НАЙДЕН (HTTP 404)"
else
    echo "❌ /api/capabilities ошибка: HTTP $CAP_STATUS"
fi

echo ""
echo "📊 ИТОГОВЫЙ СТАТУС:"
if [ "$VERSION" = "2.1-main" ] && [ "$HEALTH_STATUS" = "200" -o "$HEALTH_STATUS" = "503" ]; then
    echo "🎉 УСПЕХ! Новый сервер с health endpoints запущен"
    echo "PID: $SERVER_PID"
    echo "Логи: tail -f /tmp/media-server.log"
    echo ""
    echo "🧪 ТЕСТИРУЙТЕ:"
    echo "curl http://localhost:4124/api/health | jq"
    echo "curl http://localhost:4124/api/capabilities | jq .readiness"
else
    echo "❌ ПРОБЛЕМА: Старый сервер или health endpoints не работают"
    echo "Версия: $VERSION (должно быть 2.1-main)"
    echo "Health: HTTP $HEALTH_STATUS (должно быть 200/503)"
    echo ""
    echo "Логи сервера:"
    tail -20 /tmp/media-server.log
fi

echo ""
echo "🔧 Процесс: $SERVER_PID (kill $SERVER_PID для остановки)"





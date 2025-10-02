#!/bin/bash

# Скрипт для создания SSH туннеля к N8N серверу
echo "🚇 Создание SSH туннеля к N8N серверу..."

# Проверяем доступность сервера
if ! ping -c 1 178.156.142.35 &> /dev/null; then
    echo "❌ Сервер 178.156.142.35 недоступен"
    exit 1
fi

echo "✅ Сервер доступен"
echo "🔗 Создаем SSH туннель..."
echo "📍 После подключения откройте: http://localhost:5678"
echo "👤 Логин: admin"
echo "🔑 Пароль: supersecret"
echo ""
echo "⚠️  Для выхода нажмите Ctrl+C"
echo ""

# Создаем SSH туннель
ssh -L 5678:localhost:5678 root@178.156.142.35 -N



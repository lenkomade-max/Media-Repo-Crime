#!/usr/bin/env python3
"""
🚀 AUTONOMOUS N8N SYSTEM - Главный запускающий файл

Полностью автономная система управления N8N workflow'ами:
- Создает и обновляет workflow'ы в реальном времени
- Мониторит выполнение и диагностирует ошибки
- Автоматически применяет безопасные исправления
- Работает в цикле до достижения идеального результата
- Ведет полный аудиторский журнал всех изменений

Автор: AI Assistant
Дата: 2025-10-02
Версия: 1.0
"""

import asyncio
import sys
import os
import logging
from pathlib import Path

# Добавляем текущую директорию в Python path
sys.path.insert(0, str(Path(__file__).parent))

from orchestrator import AutonomousOrchestrator

def setup_logging():
    """Настраивает логирование"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('autonomous_system.log'),
            logging.StreamHandler(sys.stdout)
        ]
    )

async def main():
    """Главная функция"""
    print("🤖 AUTONOMOUS N8N SYSTEM")
    print("=" * 60)
    print("🎯 Полностью автономная система управления N8N")
    print("🔄 Цикл: detect → analyze → fix → verify → repeat")
    print("🛡️ Безопасные исправления с полным аудитом")
    print("🚀 РЕАЛЬНАЯ ПОМОЩЬ, НЕ ИМИТАЦИЯ!")
    print()
    
    setup_logging()
    
    try:
        # Создаем и запускаем оркестратор
        orchestrator = AutonomousOrchestrator("policy.yml")
        
        print("🚀 Запуск автономной системы...")
        print("   Для остановки нажмите Ctrl+C")
        print()
        
        # Запускаем основной цикл
        success = await orchestrator.run()
        
        if success:
            print("✅ Система завершила работу успешно")
            return 0
        else:
            print("❌ Система завершилась с ошибками")
            return 1
            
    except KeyboardInterrupt:
        print("\n🛑 Остановлено пользователем")
        return 0
    except Exception as e:
        print(f"\n💥 Критическая ошибка: {e}")
        logging.exception("Critical error in main")
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

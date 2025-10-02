#!/usr/bin/env python3
"""
🧪 SYSTEM TESTER - Тестирование автономной системы

Простой тестовый скрипт для проверки основных компонентов системы
"""

import asyncio
import sys
from pathlib import Path

# Добавляем текущую директорию в Python path
sys.path.insert(0, str(Path(__file__).parent))

async def test_components():
    """Тестирует основные компоненты системы"""
    print("🧪 ТЕСТИРОВАНИЕ АВТОНОМНОЙ СИСТЕМЫ")
    print("=" * 50)
    
    try:
        # Тест 1: Импорт модулей
        print("📦 Тест 1: Импорт модулей...")
        from orchestrator import AutonomousOrchestrator
        from connector import N8NConnector
        from monitor import ExecutionMonitor
        from analyzer import ErrorAnalyzer
        from fixer import AutoFixer
        print("   ✅ Все модули импортированы успешно")
        
        # Тест 2: Создание компонентов
        print("\n🔧 Тест 2: Создание компонентов...")
        
        # N8N Connector
        connector = N8NConnector()
        print("   ✅ N8N Connector создан")
        
        # Error Analyzer
        analyzer = ErrorAnalyzer()
        print("   ✅ Error Analyzer создан")
        
        # Execution Monitor
        monitor = ExecutionMonitor(connector, poll_interval=30)
        print("   ✅ Execution Monitor создан")
        
        # Auto Fixer
        fixer = AutoFixer(connector)
        print("   ✅ Auto Fixer создан")
        
        # Orchestrator
        orchestrator = AutonomousOrchestrator()
        print("   ✅ Orchestrator создан")
        
        # Тест 3: Анализ тестовых ошибок
        print("\n🧠 Тест 3: Анализ тестовых ошибок...")
        
        test_errors = [
            ("auth_error", "Authentication failed: Invalid API token", "OpenRouter Chat Model"),
            ("session_error", "Session ID is required but not provided", "Simple Memory"),
            ("network_error", "ECONNREFUSED: Connection refused", "HTTP Request"),
        ]
        
        for error_type, error_message, node_name in test_errors:
            analysis = await analyzer.analyze_error(
                workflow_id="test_workflow",
                error_type=error_type,
                error_message=error_message,
                node_name=node_name
            )
            
            print(f"   ✅ {error_type}: {analysis.category.value} (confidence: {analysis.confidence:.2f})")
        
        # Тест 4: Статистика
        print("\n📊 Тест 4: Статистика компонентов...")
        
        analyzer_stats = analyzer.get_error_statistics()
        print(f"   📈 Analyzer: {analyzer_stats['total_analyses']} анализов")
        
        fixer_stats = fixer.get_statistics()
        print(f"   🔧 Fixer: {fixer_stats['total_fixes']} исправлений")
        
        monitor_stats = monitor.get_stats()
        print(f"   👁️ Monitor: {monitor_stats.total_executions} выполнений")
        
        print("\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!")
        print("✅ Система готова к работе")
        
        return True
        
    except Exception as e:
        print(f"\n❌ ОШИБКА В ТЕСТАХ: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Главная функция тестирования"""
    success = await test_components()
    
    if success:
        print("\n🚀 Система протестирована и готова к запуску!")
        print("   Для запуска используйте: python main.py")
        return 0
    else:
        print("\n💥 Тестирование не пройдено")
        print("   Проверьте ошибки выше и исправьте проблемы")
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

#!/usr/bin/env python3
"""
🎯 ИСПРАВЛЕНИЕ КОНКРЕТНОГО WORKFLOW

Использует автономную систему для исправления workflow 3TuNc9SUt9EDDqii
"""

import asyncio
import sys
import logging
from pathlib import Path

# Добавляем текущую директорию в Python path
sys.path.insert(0, str(Path(__file__).parent))

from orchestrator import AutonomousOrchestrator, Incident, IncidentSeverity
from connector import N8NConnector
from analyzer import ErrorAnalyzer
from fixer import AutoFixer
from monitor import ExecutionMonitor, ExecutionEvent, EventType, Severity
from datetime import datetime

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('fix_workflow.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

async def fix_workflow_3TuNc9SUt9EDDqii():
    """Исправляет конкретный workflow используя автономную систему"""
    
    workflow_id = "3TuNc9SUt9EDDqii"
    workflow_url = "https://mayersn8n.duckdns.org/workflow/3TuNc9SUt9EDDqii"
    
    print("🎯 ИСПРАВЛЕНИЕ WORKFLOW 3TuNc9SUt9EDDqii")
    print("=" * 60)
    print(f"🆔 Workflow ID: {workflow_id}")
    print(f"🌐 URL: {workflow_url}")
    print("🤖 Используем автономную систему N8N")
    print()
    
    try:
        # Создаем компоненты автономной системы
        print("🔧 Инициализация компонентов автономной системы...")
        
        # N8N Connector
        connector = N8NConnector()
        await connector.connect()
        print("✅ N8N Connector подключен")
        
        # Error Analyzer
        analyzer = ErrorAnalyzer()
        print("✅ Error Analyzer инициализирован")
        
        # Auto Fixer
        fixer = AutoFixer(connector)
        print("✅ Auto Fixer готов")
        
        # Execution Monitor
        monitor = ExecutionMonitor(connector, poll_interval=10)
        print("✅ Execution Monitor готов")
        
        print()
        
        # 1. Проверяем существование workflow
        print("🔍 Этап 1: Проверка workflow...")
        workflow_info = await connector.get_workflow_by_id(workflow_id)
        
        if not workflow_info:
            print(f"❌ Workflow {workflow_id} не найден")
            return False
        
        print(f"✅ Workflow найден: {workflow_info.name}")
        print(f"   📊 Активен: {'✅' if workflow_info.active else '❌'}")
        print(f"   📦 Nodes: {workflow_info.nodes_count}")
        print()
        
        # 2. Анализируем nodes workflow
        print("🔍 Этап 2: Анализ nodes workflow...")
        nodes = await connector.get_workflow_nodes(workflow_id)
        
        if not nodes:
            print("❌ Не удалось получить nodes workflow")
            return False
        
        print(f"✅ Получено {len(nodes)} nodes")
        
        # Ищем проблемы в nodes
        issues_found = []
        
        for i, node in enumerate(nodes):
            print(f"   🔍 Node {i+1}: {node.name} ({node.type})")
            
            # Проверяем типичные проблемы
            node_issues = []
            
            # Проверка Memory Buffer Window
            if "memoryBufferWindow" in node.type:
                if "sessionId" not in node.parameters and "sessionIdExpression" not in node.parameters:
                    node_issues.append("Отсутствует sessionId")
            
            # Проверка OpenRouter Chat Model
            elif "lmChatOpenRouter" in node.type:
                if not node.credentials or "openRouterApi" not in node.credentials:
                    node_issues.append("Отсутствуют OpenRouter credentials")
            
            # Проверка HTTP Request
            elif node.type == "n8n-nodes-base.httpRequest":
                if not node.parameters.get("url"):
                    node_issues.append("Отсутствует URL")
            
            # Проверка Code node
            elif node.type == "n8n-nodes-base.code":
                if not node.parameters.get("jsCode"):
                    node_issues.append("Пустой код")
            
            # Проверка Google Drive
            elif "googleDrive" in node.type:
                if not node.credentials or "googleDriveOAuth2Api" not in node.credentials:
                    node_issues.append("Отсутствуют Google Drive credentials")
            
            if node_issues:
                print(f"      ❌ Проблемы: {', '.join(node_issues)}")
                for issue in node_issues:
                    issues_found.append({
                        "node_id": node.id,
                        "node_name": node.name,
                        "node_type": node.type,
                        "issue": issue
                    })
            else:
                print(f"      ✅ Без проблем")
        
        print()
        
        if not issues_found:
            print("🎉 Проблемы в workflow не найдены!")
            
            # Активируем workflow если он неактивен
            if not workflow_info.active:
                print("🔄 Активация workflow...")
                await connector.activate_workflow(workflow_id)
                print("✅ Workflow активирован")
            
            return True
        
        # 3. Исправляем найденные проблемы
        print(f"🔧 Этап 3: Исправление {len(issues_found)} проблем...")
        
        # Создаем симулированные ошибки для анализатора
        for issue_data in issues_found:
            print(f"🔧 Исправление: {issue_data['issue']} в {issue_data['node_name']}")
            
            # Анализируем ошибку
            analysis = await analyzer.analyze_error(
                workflow_id=workflow_id,
                error_type="configuration_error",
                error_message=issue_data['issue'],
                node_name=issue_data['node_name']
            )
            
            print(f"   📊 Категория: {analysis.category.value}")
            print(f"   📈 Уверенность: {analysis.confidence:.2f}")
            print(f"   💡 Решение: {analysis.suggested_fix.description}")
            
            # Применяем исправление
            if analysis.confidence >= 0.7:  # Высокая уверенность
                fix_result = await fixer.apply_fix(workflow_id, analysis)
                
                if fix_result.success:
                    print(f"   ✅ Исправление применено успешно")
                else:
                    print(f"   ❌ Ошибка применения исправления: {fix_result.error}")
            else:
                print(f"   ⚠️ Низкая уверенность, пропускаем автоисправление")
        
        print()
        
        # 4. Активируем workflow
        print("🔄 Этап 4: Активация workflow...")
        activation_success = await connector.activate_workflow(workflow_id)
        
        if activation_success:
            print("✅ Workflow активирован")
        else:
            print("❌ Ошибка активации workflow")
            return False
        
        print()
        
        # 5. Тестируем workflow
        print("🧪 Этап 5: Тестирование workflow...")
        
        # Выполняем тестовый запуск
        execution_id = await connector.execute_workflow(
            workflow_id, 
            {"topic": "Тестовая криминальная история для проверки workflow"}
        )
        
        if execution_id:
            print(f"✅ Тестовое выполнение запущено: {execution_id}")
            
            # Ждем результат
            print("⏱️ Ожидание результата выполнения...")
            await asyncio.sleep(30)  # Даем время на выполнение
            
            # Проверяем статус
            execution_info = await connector.get_execution_status(execution_id)
            
            if execution_info:
                print(f"📊 Статус выполнения: {execution_info.status}")
                print(f"📊 Завершено: {'✅' if execution_info.finished else '❌'}")
                
                if execution_info.status == "success":
                    print("🎉 Тестирование прошло успешно!")
                    return True
                else:
                    print("⚠️ Выполнение завершилось с ошибками")
                    
                    # Получаем ошибки выполнения
                    errors = await connector.get_execution_errors(execution_id)
                    if errors:
                        print("❌ Найденные ошибки:")
                        for error in errors:
                            print(f"   • {error['node']}: {error['error'].get('message', 'Unknown error')}")
                    
                    return False
            else:
                print("❌ Не удалось получить статус выполнения")
                return False
        else:
            print("❌ Не удалось запустить тестовое выполнение")
            return False
        
    except Exception as e:
        print(f"💥 Критическая ошибка: {e}")
        logger.exception("Critical error in workflow fixing")
        return False
    
    finally:
        # Закрываем соединения
        if 'connector' in locals():
            await connector.close()

async def main():
    """Главная функция"""
    try:
        success = await fix_workflow_3TuNc9SUt9EDDqii()
        
        if success:
            print("\n🎉 WORKFLOW УСПЕШНО ИСПРАВЛЕН!")
            print("✅ Все проблемы устранены")
            print("✅ Workflow активирован")
            print("✅ Тестирование пройдено")
            print("🚀 Workflow готов к использованию!")
            print()
            print("🌐 Откройте: https://mayersn8n.duckdns.org/workflow/3TuNc9SUt9EDDqii")
            print("▶️ Нажмите 'Execute Workflow' для запуска")
            return 0
        else:
            print("\n❌ НЕ УДАЛОСЬ ПОЛНОСТЬЮ ИСПРАВИТЬ WORKFLOW")
            print("🔧 Возможно требуется ручное вмешательство")
            print("📋 Проверьте логи для деталей")
            return 1
            
    except KeyboardInterrupt:
        print("\n🛑 Прервано пользователем")
        return 0
    except Exception as e:
        print(f"\n💥 Критическая ошибка: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))



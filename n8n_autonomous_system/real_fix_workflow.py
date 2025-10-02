#!/usr/bin/env python3
"""
🔧 РЕАЛЬНОЕ ИСПРАВЛЕНИЕ WORKFLOW 3TuNc9SUt9EDDqii

Исправляет реальные проблемы в workflow через SSH и PostgreSQL
"""

import subprocess
import json
import time
from datetime import datetime

class RealWorkflowFixer:
    def __init__(self):
        self.workflow_id = "3TuNc9SUt9EDDqii"
        self.ssh_host = "root@178.156.142.35"
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        colors = {
            "INFO": "\033[36m",
            "SUCCESS": "\033[32m",
            "ERROR": "\033[31m",
            "WARNING": "\033[33m",
            "PROGRESS": "\033[35m"
        }
        color = colors.get(level, "\033[0m")
        print(f"{color}[{timestamp}] {message}\033[0m")
    
    def run_ssh(self, command):
        """Выполняет SSH команду"""
        try:
            result = subprocess.run([
                "ssh", self.ssh_host, command
            ], capture_output=True, text=True, timeout=120)
            
            return {
                "success": result.returncode == 0,
                "output": result.stdout.strip(),
                "error": result.stderr.strip()
            }
        except Exception as e:
            return {"success": False, "output": "", "error": str(e)}
    
    def check_workflow_exists(self):
        """Проверяет существование workflow"""
        self.log("🔍 Проверка существования workflow...", "PROGRESS")
        
        query = f"SELECT id, name, active FROM workflow_entity WHERE id = '{self.workflow_id}';"
        result = self.run_ssh(f'docker exec root-db-1 psql -U n8n -d n8n -c "{query}"')
        
        if result["success"] and result["output"]:
            lines = result["output"].split('\n')
            if len(lines) >= 3 and "(0 rows)" not in result["output"]:
                self.log("✅ Workflow найден", "SUCCESS")
                return True
        
        self.log("❌ Workflow не найден", "ERROR")
        return False
    
    def get_credentials_info(self):
        """Получает информацию о credentials"""
        self.log("🔍 Проверка credentials...", "PROGRESS")
        
        query = "SELECT id, name, type FROM credentials_entity ORDER BY name;"
        result = self.run_ssh(f'docker exec root-db-1 psql -U n8n -d n8n -c "{query}"')
        
        if result["success"] and result["output"]:
            self.log("📊 Доступные credentials:", "SUCCESS")
            lines = result["output"].split('\n')
            for line in lines[2:]:  # Пропускаем заголовки
                if line.strip() and not line.startswith('-') and "(0 rows)" not in line:
                    parts = [p.strip() for p in line.split('|')]
                    if len(parts) >= 3:
                        self.log(f"   🔑 {parts[1]} ({parts[2]}) - ID: {parts[0]}", "INFO")
        
        return result["success"]
    
    def fix_credentials_issue(self):
        """Исправляет проблему с credentials"""
        self.log("🔧 Исправление проблемы с credentials...", "WARNING")
        
        # Сначала получаем текущие nodes
        query = f"SELECT nodes FROM workflow_entity WHERE id = '{self.workflow_id}';"
        result = self.run_ssh(f'docker exec root-db-1 psql -U n8n -d n8n -t -c "{query}"')
        
        if not result["success"] or not result["output"]:
            self.log("❌ Не удалось получить nodes workflow", "ERROR")
            return False
        
        try:
            nodes = json.loads(result["output"])
            self.log(f"✅ Получено {len(nodes)} nodes", "SUCCESS")
            
            # Ищем проблемные nodes
            fixes_applied = 0
            
            for node in nodes:
                node_name = node.get("name", "Unknown")
                node_type = node.get("type", "")
                
                # Исправляем AI Сценарист (OpenRouter)
                if "Сценарист" in node_name and "langchain" in node_type:
                    self.log(f"🔧 Исправление node '{node_name}'", "PROGRESS")
                    
                    # Убираем старые credentials
                    if "credentials" in node:
                        del node["credentials"]
                    
                    # Добавляем правильные credentials
                    node["credentials"] = {
                        "openRouterApi": {
                            "id": "dctACn3yXSG7qIdH",
                            "name": "OpenRouter account"
                        }
                    }
                    
                    self.log(f"   ✅ Credentials обновлены для '{node_name}'", "SUCCESS")
                    fixes_applied += 1
                
                # Исправляем Memory node
                elif "memory" in node_type.lower() or "Memory" in node_name:
                    self.log(f"🔧 Исправление node '{node_name}'", "PROGRESS")
                    
                    if "parameters" not in node:
                        node["parameters"] = {}
                    
                    # Добавляем sessionId
                    node["parameters"]["sessionIdExpression"] = "={{ $workflow.executionId }}"
                    
                    self.log(f"   ✅ SessionId добавлен для '{node_name}'", "SUCCESS")
                    fixes_applied += 1
                
                # Исправляем Google Drive node
                elif "googleDrive" in node_type or "Google" in node_name:
                    self.log(f"🔧 Исправление node '{node_name}'", "PROGRESS")
                    
                    # Убираем старые credentials
                    if "credentials" in node:
                        del node["credentials"]
                    
                    # Добавляем правильные credentials
                    node["credentials"] = {
                        "googleDriveOAuth2Api": {
                            "id": "XDM9FIbDJMpu7nGH",
                            "name": "Google Drive account"
                        }
                    }
                    
                    self.log(f"   ✅ Google Drive credentials обновлены для '{node_name}'", "SUCCESS")
                    fixes_applied += 1
                
                # Исправляем HTTP Request nodes
                elif node_type == "n8n-nodes-base.httpRequest":
                    self.log(f"🔧 Проверка node '{node_name}'", "PROGRESS")
                    
                    if "parameters" not in node:
                        node["parameters"] = {}
                    
                    # Если это MCP сервер
                    if not node["parameters"].get("url") or "MCP" in node_name:
                        node["parameters"]["url"] = "http://178.156.142.35:4123/api/create-video"
                        node["parameters"]["method"] = "POST"
                        node["parameters"]["sendHeaders"] = True
                        node["parameters"]["headerParameters"] = {
                            "parameters": [
                                {
                                    "name": "Content-Type",
                                    "value": "application/json"
                                }
                            ]
                        }
                        
                        self.log(f"   ✅ URL настроен для '{node_name}'", "SUCCESS")
                        fixes_applied += 1
            
            if fixes_applied > 0:
                # Сохраняем исправленные nodes
                return self.save_nodes(nodes, fixes_applied)
            else:
                self.log("ℹ️ Исправления не требуются", "INFO")
                return True
                
        except json.JSONDecodeError as e:
            self.log(f"❌ Ошибка парсинга nodes: {e}", "ERROR")
            return False
    
    def save_nodes(self, nodes, fixes_count):
        """Сохраняет исправленные nodes"""
        self.log(f"💾 Сохранение {fixes_count} исправлений...", "PROGRESS")
        
        # Конвертируем в JSON
        nodes_json = json.dumps(nodes, ensure_ascii=False, separators=(',', ':'))
        
        # Экранируем для SQL
        nodes_escaped = nodes_json.replace("'", "''")
        
        # Создаем временный файл для больших данных
        temp_file = f"/tmp/workflow_nodes_{int(time.time())}.json"
        
        # Записываем во временный файл
        write_cmd = f"cat > {temp_file} << 'EOF'\n{nodes_json}\nEOF"
        write_result = self.run_ssh(write_cmd)
        
        if not write_result["success"]:
            self.log("❌ Не удалось создать временный файл", "ERROR")
            return False
        
        # Обновляем через psql с файлом
        update_cmd = f"""
        docker exec root-db-1 psql -U n8n -d n8n -c "
        UPDATE workflow_entity 
        SET nodes = '$(cat {temp_file} | sed "s/'/''/g")', 
            \\"updatedAt\\" = NOW() 
        WHERE id = '{self.workflow_id}';
        "
        """
        
        result = self.run_ssh(update_cmd)
        
        # Удаляем временный файл
        self.run_ssh(f"rm -f {temp_file}")
        
        if result["success"]:
            self.log("✅ Nodes обновлены в базе данных", "SUCCESS")
            return True
        else:
            self.log(f"❌ Ошибка обновления: {result['error']}", "ERROR")
            return False
    
    def restart_n8n(self):
        """Перезапускает N8N"""
        self.log("🔄 Перезапуск N8N для применения изменений...", "PROGRESS")
        
        # Останавливаем N8N
        stop_result = self.run_ssh("docker stop root-n8n-1")
        if stop_result["success"]:
            self.log("   ⏹️ N8N остановлен", "INFO")
            time.sleep(5)
        
        # Запускаем N8N
        start_result = self.run_ssh("docker start root-n8n-1")
        if start_result["success"]:
            self.log("   ▶️ N8N запущен", "INFO")
            
            # Ждем полного запуска
            self.log("   ⏱️ Ожидание полного запуска N8N...", "PROGRESS")
            time.sleep(20)
            
            # Проверяем что N8N запустился
            check_result = self.run_ssh("docker ps | grep n8n")
            if check_result["success"] and "n8n" in check_result["output"]:
                self.log("✅ N8N успешно перезапущен", "SUCCESS")
                return True
        
        self.log("❌ Ошибка перезапуска N8N", "ERROR")
        return False
    
    def activate_workflow(self):
        """Активирует workflow"""
        self.log("🔄 Активация workflow...", "PROGRESS")
        
        query = f"""
        UPDATE workflow_entity 
        SET active = true, "updatedAt" = NOW() 
        WHERE id = '{self.workflow_id}';
        """
        
        result = self.run_ssh(f'docker exec root-db-1 psql -U n8n -d n8n -c "{query}"')
        
        if result["success"]:
            self.log("✅ Workflow активирован", "SUCCESS")
            return True
        else:
            self.log("❌ Ошибка активации workflow", "ERROR")
            return False
    
    def verify_fix(self):
        """Проверяет что исправления применились"""
        self.log("🔍 Проверка применения исправлений...", "PROGRESS")
        
        # Проверяем что workflow активен
        query = f"SELECT active FROM workflow_entity WHERE id = '{self.workflow_id}';"
        result = self.run_ssh(f'docker exec root-db-1 psql -U n8n -d n8n -t -c "{query}"')
        
        if result["success"] and result["output"].strip() == 't':
            self.log("✅ Workflow активен", "SUCCESS")
            return True
        else:
            self.log("❌ Workflow неактивен", "ERROR")
            return False
    
    def fix_workflow_completely(self):
        """Полностью исправляет workflow"""
        self.log("🎯 РЕАЛЬНОЕ ИСПРАВЛЕНИЕ WORKFLOW", "SUCCESS")
        self.log("=" * 80)
        
        # 1. Проверяем существование
        if not self.check_workflow_exists():
            return False
        
        # 2. Проверяем credentials
        self.get_credentials_info()
        
        # 3. Исправляем проблемы
        self.log("\n📋 Этап 1: Исправление credentials и параметров", "SUCCESS")
        if not self.fix_credentials_issue():
            return False
        
        # 4. Перезапускаем N8N
        self.log("\n📋 Этап 2: Перезапуск N8N", "SUCCESS")
        if not self.restart_n8n():
            return False
        
        # 5. Активируем workflow
        self.log("\n📋 Этап 3: Активация workflow", "SUCCESS")
        if not self.activate_workflow():
            return False
        
        # 6. Проверяем результат
        self.log("\n📋 Этап 4: Проверка результата", "SUCCESS")
        return self.verify_fix()

def main():
    print("🔧 РЕАЛЬНОЕ ИСПРАВЛЕНИЕ WORKFLOW 3TuNc9SUt9EDDqii")
    print("=" * 80)
    print("🎯 Исправляем реальные проблемы через SSH и PostgreSQL")
    print("🆔 Workflow ID: 3TuNc9SUt9EDDqii")
    print("🌐 URL: https://mayersn8n.duckdns.org/workflow/3TuNc9SUt9EDDqii")
    print()
    
    fixer = RealWorkflowFixer()
    
    try:
        success = fixer.fix_workflow_completely()
        
        if success:
            fixer.log("\n🎉 WORKFLOW РЕАЛЬНО ИСПРАВЛЕН!", "SUCCESS")
            fixer.log("✅ Credentials исправлены", "SUCCESS")
            fixer.log("✅ N8N перезапущен", "SUCCESS")
            fixer.log("✅ Workflow активирован", "SUCCESS")
            fixer.log("🚀 Обновите страницу и попробуйте снова!", "SUCCESS")
            fixer.log("🌐 https://mayersn8n.duckdns.org/workflow/3TuNc9SUt9EDDqii", "SUCCESS")
        else:
            fixer.log("\n❌ НЕ УДАЛОСЬ ИСПРАВИТЬ", "ERROR")
            fixer.log("🔧 Попробуйте исправить вручную через UI", "WARNING")
        
        return success
        
    except KeyboardInterrupt:
        fixer.log("\n🛑 Прервано пользователем", "WARNING")
        return False
    except Exception as e:
        fixer.log(f"\n💥 Критическая ошибка: {e}", "ERROR")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)



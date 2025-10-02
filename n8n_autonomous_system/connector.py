#!/usr/bin/env python3
"""
🔌 N8N CONNECTOR - Модуль взаимодействия с N8N

Этот модуль обеспечивает надежное взаимодействие с N8N через:
- REST API для управления workflow'ами
- SSH для прямого доступа к серверу
- PostgreSQL для работы с базой данных
- Webhook endpoints для real-time уведомлений

Автор: AI Assistant
Дата: 2025-10-02
Версия: 1.0
"""

import asyncio
import json
import logging
import subprocess
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
import aiohttp
import asyncpg
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class WorkflowInfo:
    """Информация о workflow"""
    id: str
    name: str
    active: bool
    nodes_count: int
    connections_count: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

@dataclass
class ExecutionInfo:
    """Информация о выполнении"""
    id: str
    workflow_id: str
    status: str
    finished: bool
    started_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    execution_time: Optional[float] = None
    error: Optional[str] = None

@dataclass
class NodeInfo:
    """Информация о ноде"""
    id: str
    name: str
    type: str
    parameters: Dict[str, Any]
    position: List[int]
    credentials: Optional[Dict[str, Any]] = None

class N8NConnector:
    """
    Коннектор для взаимодействия с N8N
    
    Обеспечивает надежное взаимодействие через множественные каналы:
    - REST API для стандартных операций
    - SSH для системных команд
    - PostgreSQL для прямого доступа к данным
    """
    
    def __init__(self, api_url: str = None, ssh_host: str = None, db_config: Dict = None):
        """Инициализация коннектора"""
        self.api_url = api_url or "https://mayersn8n.duckdns.org"
        self.ssh_host = ssh_host or "root@178.156.142.35"
        self.db_config = db_config or {
            "host": "178.156.142.35",
            "port": 5432,
            "database": "n8n",
            "user": "n8n"
        }
        
        # HTTP сессия для API запросов
        self.session: Optional[aiohttp.ClientSession] = None
        
        # PostgreSQL пул соединений
        self.db_pool: Optional[asyncpg.Pool] = None
        
        # Кэш для часто используемых данных
        self._workflow_cache: Dict[str, WorkflowInfo] = {}
        self._cache_ttl = 300  # 5 минут
        self._last_cache_update = 0
        
        logger.info("🔌 N8N Connector initialized")
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
    
    async def connect(self):
        """Устанавливает соединения с N8N"""
        try:
            # HTTP сессия
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)
            
            # PostgreSQL пул
            self.db_pool = await asyncpg.create_pool(
                host=self.db_config["host"],
                port=self.db_config["port"],
                database=self.db_config["database"],
                user=self.db_config["user"],
                min_size=1,
                max_size=10
            )
            
            logger.info("✅ N8N Connector connected successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect N8N Connector: {e}")
            raise
    
    async def close(self):
        """Закрывает соединения"""
        try:
            if self.session:
                await self.session.close()
            
            if self.db_pool:
                await self.db_pool.close()
            
            logger.info("🔌 N8N Connector closed")
            
        except Exception as e:
            logger.error(f"❌ Error closing N8N Connector: {e}")
    
    async def health_check(self) -> bool:
        """Проверяет здоровье N8N сервиса"""
        try:
            # Проверяем через SSH что контейнер запущен
            result = await self._run_ssh_command("docker ps | grep n8n | grep -v Exited")
            
            if result["success"] and result["stdout"]:
                logger.debug("✅ N8N container is running")
                return True
            else:
                logger.warning("❌ N8N container is not running")
                return False
                
        except Exception as e:
            logger.error(f"❌ N8N health check failed: {e}")
            return False
    
    async def database_health_check(self) -> bool:
        """Проверяет здоровье PostgreSQL"""
        try:
            result = await self._run_ssh_command("docker exec root-db-1 pg_isready -U n8n")
            
            if result["success"] and "accepting" in result["stdout"]:
                logger.debug("✅ PostgreSQL is healthy")
                return True
            else:
                logger.warning("❌ PostgreSQL is not healthy")
                return False
                
        except Exception as e:
            logger.error(f"❌ PostgreSQL health check failed: {e}")
            return False
    
    async def mcp_server_health_check(self) -> bool:
        """Проверяет здоровье MCP сервера"""
        try:
            result = await self._run_ssh_command("curl -s -o /dev/null -w '%{http_code}' http://localhost:4123/api/ping")
            
            if result["success"] and result["stdout"] == "200":
                logger.debug("✅ MCP Server is healthy")
                return True
            else:
                logger.warning("❌ MCP Server is not healthy")
                return False
                
        except Exception as e:
            logger.error(f"❌ MCP Server health check failed: {e}")
            return False
    
    async def get_workflows(self, active_only: bool = False) -> List[WorkflowInfo]:
        """Получает список workflow'ов"""
        try:
            # Проверяем кэш
            if self._is_cache_valid():
                workflows = list(self._workflow_cache.values())
                if active_only:
                    workflows = [w for w in workflows if w.active]
                return workflows
            
            # Запрос к базе данных
            query = """
            SELECT id, name, active, 
                   LENGTH(nodes::text) as nodes_size,
                   LENGTH(connections::text) as connections_size,
                   "createdAt", "updatedAt"
            FROM workflow_entity
            """
            
            if active_only:
                query += " WHERE active = true"
            
            query += " ORDER BY \"updatedAt\" DESC"
            
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(query)
            
            workflows = []
            for row in rows:
                workflow = WorkflowInfo(
                    id=row["id"],
                    name=row["name"],
                    active=row["active"],
                    nodes_count=row["nodes_size"] // 100,  # Примерная оценка
                    connections_count=row["connections_size"] // 50,
                    created_at=row["createdAt"],
                    updated_at=row["updatedAt"]
                )
                workflows.append(workflow)
                self._workflow_cache[workflow.id] = workflow
            
            self._last_cache_update = time.time()
            logger.debug(f"📋 Retrieved {len(workflows)} workflows")
            
            return workflows
            
        except Exception as e:
            logger.error(f"❌ Failed to get workflows: {e}")
            return []
    
    async def get_workflow_by_id(self, workflow_id: str) -> Optional[WorkflowInfo]:
        """Получает workflow по ID"""
        try:
            # Проверяем кэш
            if workflow_id in self._workflow_cache and self._is_cache_valid():
                return self._workflow_cache[workflow_id]
            
            query = """
            SELECT id, name, active, 
                   LENGTH(nodes::text) as nodes_size,
                   LENGTH(connections::text) as connections_size,
                   "createdAt", "updatedAt"
            FROM workflow_entity
            WHERE id = $1
            """
            
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(query, workflow_id)
            
            if row:
                workflow = WorkflowInfo(
                    id=row["id"],
                    name=row["name"],
                    active=row["active"],
                    nodes_count=row["nodes_size"] // 100,
                    connections_count=row["connections_size"] // 50,
                    created_at=row["createdAt"],
                    updated_at=row["updatedAt"]
                )
                self._workflow_cache[workflow_id] = workflow
                return workflow
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Failed to get workflow {workflow_id}: {e}")
            return None
    
    async def get_workflow_nodes(self, workflow_id: str) -> List[NodeInfo]:
        """Получает ноды workflow'а"""
        try:
            query = "SELECT nodes FROM workflow_entity WHERE id = $1"
            
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(query, workflow_id)
            
            if not row or not row["nodes"]:
                return []
            
            nodes_data = json.loads(row["nodes"])
            nodes = []
            
            for node_data in nodes_data:
                node = NodeInfo(
                    id=node_data.get("id", ""),
                    name=node_data.get("name", ""),
                    type=node_data.get("type", ""),
                    parameters=node_data.get("parameters", {}),
                    position=node_data.get("position", [0, 0]),
                    credentials=node_data.get("credentials")
                )
                nodes.append(node)
            
            logger.debug(f"📦 Retrieved {len(nodes)} nodes for workflow {workflow_id}")
            return nodes
            
        except Exception as e:
            logger.error(f"❌ Failed to get workflow nodes: {e}")
            return []
    
    async def update_workflow_nodes(self, workflow_id: str, nodes: List[NodeInfo]) -> bool:
        """Обновляет ноды workflow'а"""
        try:
            # Конвертируем ноды в JSON формат
            nodes_data = []
            for node in nodes:
                node_dict = {
                    "id": node.id,
                    "name": node.name,
                    "type": node.type,
                    "parameters": node.parameters,
                    "position": node.position
                }
                if node.credentials:
                    node_dict["credentials"] = node.credentials
                nodes_data.append(node_dict)
            
            nodes_json = json.dumps(nodes_data, ensure_ascii=False)
            
            # Обновляем в базе данных
            query = """
            UPDATE workflow_entity 
            SET nodes = $1, "updatedAt" = NOW()
            WHERE id = $2
            """
            
            async with self.db_pool.acquire() as conn:
                result = await conn.execute(query, nodes_json, workflow_id)
            
            if result == "UPDATE 1":
                # Инвалидируем кэш
                if workflow_id in self._workflow_cache:
                    del self._workflow_cache[workflow_id]
                
                # Перезапускаем N8N для применения изменений
                await self._restart_n8n()
                
                logger.info(f"✅ Updated nodes for workflow {workflow_id}")
                return True
            else:
                logger.error(f"❌ Failed to update workflow {workflow_id}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to update workflow nodes: {e}")
            return False
    
    async def create_workflow(self, name: str, nodes: List[NodeInfo], connections: Dict = None) -> Optional[str]:
        """Создает новый workflow"""
        try:
            workflow_id = str(uuid.uuid4())
            
            # Подготавливаем данные
            nodes_data = []
            for node in nodes:
                node_dict = {
                    "id": node.id,
                    "name": node.name,
                    "type": node.type,
                    "parameters": node.parameters,
                    "position": node.position
                }
                if node.credentials:
                    node_dict["credentials"] = node.credentials
                nodes_data.append(node_dict)
            
            nodes_json = json.dumps(nodes_data, ensure_ascii=False)
            connections_json = json.dumps(connections or {}, ensure_ascii=False)
            
            # Создаем workflow в базе данных
            query = """
            INSERT INTO workflow_entity (
                id, name, nodes, connections, active, "createdAt", "updatedAt"
            ) VALUES (
                $1, $2, $3, $4, false, NOW(), NOW()
            )
            """
            
            async with self.db_pool.acquire() as conn:
                await conn.execute(query, workflow_id, name, nodes_json, connections_json)
            
            logger.info(f"✅ Created workflow {workflow_id}: {name}")
            return workflow_id
            
        except Exception as e:
            logger.error(f"❌ Failed to create workflow: {e}")
            return None
    
    async def activate_workflow(self, workflow_id: str) -> bool:
        """Активирует workflow"""
        try:
            query = """
            UPDATE workflow_entity 
            SET active = true, "updatedAt" = NOW()
            WHERE id = $1
            """
            
            async with self.db_pool.acquire() as conn:
                result = await conn.execute(query, workflow_id)
            
            if result == "UPDATE 1":
                # Инвалидируем кэш
                if workflow_id in self._workflow_cache:
                    del self._workflow_cache[workflow_id]
                
                logger.info(f"✅ Activated workflow {workflow_id}")
                return True
            else:
                logger.error(f"❌ Failed to activate workflow {workflow_id}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to activate workflow: {e}")
            return False
    
    async def deactivate_workflow(self, workflow_id: str) -> bool:
        """Деактивирует workflow"""
        try:
            query = """
            UPDATE workflow_entity 
            SET active = false, "updatedAt" = NOW()
            WHERE id = $1
            """
            
            async with self.db_pool.acquire() as conn:
                result = await conn.execute(query, workflow_id)
            
            if result == "UPDATE 1":
                # Инвалидируем кэш
                if workflow_id in self._workflow_cache:
                    del self._workflow_cache[workflow_id]
                
                logger.info(f"✅ Deactivated workflow {workflow_id}")
                return True
            else:
                logger.error(f"❌ Failed to deactivate workflow {workflow_id}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to deactivate workflow: {e}")
            return False
    
    async def execute_workflow(self, workflow_id: str, input_data: Dict = None) -> Optional[str]:
        """Выполняет workflow и возвращает execution ID"""
        try:
            execution_id = str(uuid.uuid4())
            
            # Создаем execution в базе данных
            query = """
            INSERT INTO execution_entity (
                id, "workflowId", mode, finished, status, "startedAt", "createdAt"
            ) VALUES (
                $1, $2, 'manual', false, 'running', NOW(), NOW()
            )
            """
            
            async with self.db_pool.acquire() as conn:
                await conn.execute(query, execution_id, workflow_id)
            
            # Запускаем workflow через N8N CLI
            input_json = json.dumps(input_data or {}, ensure_ascii=False)
            temp_file = f"/tmp/input_{execution_id}.json"
            
            # Создаем файл с входными данными
            write_cmd = f"cat > {temp_file} << 'EOF'\n{input_json}\nEOF"
            await self._run_ssh_command(write_cmd)
            
            # Выполняем workflow
            execute_cmd = f"docker exec root-n8n-1 n8n execute:workflow --id={workflow_id} --input={temp_file}"
            result = await self._run_ssh_command(execute_cmd, timeout=300)
            
            # Удаляем временный файл
            await self._run_ssh_command(f"rm -f {temp_file}")
            
            if result["success"]:
                logger.info(f"✅ Started execution {execution_id} for workflow {workflow_id}")
                return execution_id
            else:
                logger.error(f"❌ Failed to execute workflow {workflow_id}: {result['stderr']}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to execute workflow: {e}")
            return None
    
    async def get_execution_status(self, execution_id: str) -> Optional[ExecutionInfo]:
        """Получает статус выполнения"""
        try:
            query = """
            SELECT id, "workflowId", status, finished, "startedAt", "stoppedAt"
            FROM execution_entity
            WHERE id = $1
            """
            
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(query, execution_id)
            
            if row:
                execution_time = None
                if row["startedAt"] and row["stoppedAt"]:
                    execution_time = (row["stoppedAt"] - row["startedAt"]).total_seconds()
                
                execution = ExecutionInfo(
                    id=row["id"],
                    workflow_id=row["workflowId"],
                    status=row["status"],
                    finished=row["finished"],
                    started_at=row["startedAt"],
                    stopped_at=row["stoppedAt"],
                    execution_time=execution_time
                )
                
                return execution
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Failed to get execution status: {e}")
            return None
    
    async def get_execution_errors(self, execution_id: str) -> List[Dict[str, Any]]:
        """Получает ошибки выполнения"""
        try:
            query = """
            SELECT data
            FROM execution_data
            WHERE "executionId" = $1
            """
            
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(query, execution_id)
            
            if not row or not row["data"]:
                return []
            
            data = json.loads(row["data"])
            errors = []
            
            if "resultData" in data and "runData" in data["resultData"]:
                run_data = data["resultData"]["runData"]
                
                for node_name, node_results in run_data.items():
                    if isinstance(node_results, list) and len(node_results) > 0:
                        node_result = node_results[0]
                        
                        if "error" in node_result:
                            errors.append({
                                "node": node_name,
                                "error": node_result["error"],
                                "execution_id": execution_id
                            })
            
            return errors
            
        except Exception as e:
            logger.error(f"❌ Failed to get execution errors: {e}")
            return []
    
    async def get_recent_executions(self, limit: int = 50) -> List[ExecutionInfo]:
        """Получает последние выполнения"""
        try:
            query = """
            SELECT id, "workflowId", status, finished, "startedAt", "stoppedAt"
            FROM execution_entity
            ORDER BY "startedAt" DESC
            LIMIT $1
            """
            
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(query, limit)
            
            executions = []
            for row in rows:
                execution_time = None
                if row["startedAt"] and row["stoppedAt"]:
                    execution_time = (row["stoppedAt"] - row["startedAt"]).total_seconds()
                
                execution = ExecutionInfo(
                    id=row["id"],
                    workflow_id=row["workflowId"],
                    status=row["status"],
                    finished=row["finished"],
                    started_at=row["startedAt"],
                    stopped_at=row["stoppedAt"],
                    execution_time=execution_time
                )
                executions.append(execution)
            
            return executions
            
        except Exception as e:
            logger.error(f"❌ Failed to get recent executions: {e}")
            return []
    
    async def _run_ssh_command(self, command: str, timeout: int = 30) -> Dict[str, Any]:
        """Выполняет SSH команду асинхронно"""
        try:
            process = await asyncio.create_subprocess_exec(
                "ssh", self.ssh_host, command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )
            
            return {
                "success": process.returncode == 0,
                "stdout": stdout.decode().strip(),
                "stderr": stderr.decode().strip(),
                "returncode": process.returncode
            }
            
        except asyncio.TimeoutError:
            logger.error(f"❌ SSH command timeout: {command}")
            return {"success": False, "stdout": "", "stderr": "Timeout", "returncode": -1}
        except Exception as e:
            logger.error(f"❌ SSH command error: {e}")
            return {"success": False, "stdout": "", "stderr": str(e), "returncode": -1}
    
    async def _restart_n8n(self):
        """Перезапускает N8N для применения изменений"""
        try:
            logger.info("🔄 Restarting N8N...")
            result = await self._run_ssh_command("docker restart root-n8n-1")
            
            if result["success"]:
                # Ждем запуска
                await asyncio.sleep(15)
                logger.info("✅ N8N restarted successfully")
            else:
                logger.error(f"❌ Failed to restart N8N: {result['stderr']}")
                
        except Exception as e:
            logger.error(f"❌ Error restarting N8N: {e}")
    
    def _is_cache_valid(self) -> bool:
        """Проверяет валидность кэша"""
        return (time.time() - self._last_cache_update) < self._cache_ttl
    
    def clear_cache(self):
        """Очищает кэш"""
        self._workflow_cache.clear()
        self._last_cache_update = 0
        logger.debug("🗑️ Cache cleared")

# Утилитарные функции для работы с N8N

async def create_test_workflow() -> Optional[str]:
    """Создает тестовый workflow для проверки системы"""
    async with N8NConnector() as connector:
        # Простой тестовый workflow
        nodes = [
            NodeInfo(
                id="manual_trigger",
                name="Manual Trigger",
                type="n8n-nodes-base.manualTrigger",
                parameters={},
                position=[100, 100]
            ),
            NodeInfo(
                id="set_node",
                name="Set Test Data",
                type="n8n-nodes-base.set",
                parameters={
                    "values": {
                        "string": [
                            {
                                "name": "message",
                                "value": "Test workflow executed successfully"
                            }
                        ]
                    }
                },
                position=[300, 100]
            )
        ]
        
        connections = {
            "manual_trigger": {
                "main": [[{
                    "node": "set_node",
                    "type": "main",
                    "index": 0
                }]]
            }
        }
        
        workflow_id = await connector.create_workflow(
            name="🧪 Test Workflow - Autonomous System",
            nodes=nodes,
            connections=connections
        )
        
        if workflow_id:
            await connector.activate_workflow(workflow_id)
        
        return workflow_id

async def cleanup_test_workflows():
    """Очищает тестовые workflow'ы"""
    async with N8NConnector() as connector:
        workflows = await connector.get_workflows()
        
        for workflow in workflows:
            if "Test Workflow" in workflow.name or "🧪" in workflow.name:
                logger.info(f"🗑️ Cleaning up test workflow: {workflow.name}")
                # Деактивируем workflow
                await connector.deactivate_workflow(workflow.id)

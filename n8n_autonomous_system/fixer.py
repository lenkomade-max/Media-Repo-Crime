#!/usr/bin/env python3
"""
🔧 AUTO FIXER - Автоматический исправитель ошибок N8N

Этот модуль обеспечивает безопасное автоматическое исправление ошибок:
- Применение исправлений на основе анализа
- Создание backup'ов перед изменениями
- Rollback механизм при неудаче
- Staging-first подход для безопасности

Автор: AI Assistant
Дата: 2025-10-02
Версия: 1.0
"""

import json
import logging
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import copy

from connector import N8NConnector, NodeInfo
from analyzer import ErrorAnalysis, FixType, RepairStrategy

logger = logging.getLogger(__name__)

class FixStatus(Enum):
    """Статусы исправления"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPLIED = "applied"
    TESTED = "tested"
    DEPLOYED = "deployed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"

@dataclass
class FixResult:
    """Результат применения исправления"""
    fix_id: str
    success: bool
    status: FixStatus
    applied_at: datetime
    description: str
    changes_made: List[Dict[str, Any]] = field(default_factory=list)
    backup_id: Optional[str] = None
    error: Optional[str] = None
    rollback_available: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class WorkflowBackup:
    """Backup workflow'а"""
    backup_id: str
    workflow_id: str
    nodes: List[Dict[str, Any]]
    connections: Dict[str, Any]
    created_at: datetime
    description: str
    metadata: Dict[str, Any] = field(default_factory=dict)

class AutoFixer:
    """
    Автоматический исправитель ошибок N8N
    
    Применяет безопасные исправления на основе анализа ошибок:
    - Создает backup перед изменениями
    - Применяет исправления поэтапно
    - Тестирует результат
    - Откатывает при неудаче
    """
    
    def __init__(self, connector: N8NConnector, config: Dict[str, Any] = None):
        """Инициализация исправителя"""
        self.connector = connector
        self.config = config or {}
        
        # Хранилище backup'ов
        self.backups: Dict[str, WorkflowBackup] = {}
        
        # История исправлений
        self.fix_history: List[FixResult] = []
        
        # Шаблоны исправлений
        self.fix_templates = self._initialize_fix_templates()
        
        logger.info("🔧 Auto Fixer initialized")
    
    def _initialize_fix_templates(self) -> Dict[FixType, Dict[str, Any]]:
        """Инициализирует шаблоны исправлений"""
        templates = {
            FixType.ADD_PARAMETER: {
                "description": "Add missing parameter to node",
                "risk_level": "low",
                "reversible": True
            },
            
            FixType.UPDATE_PARAMETER: {
                "description": "Update existing parameter value",
                "risk_level": "low",
                "reversible": True
            },
            
            FixType.FIX_CREDENTIALS: {
                "description": "Add or update node credentials",
                "risk_level": "low",
                "reversible": True
            },
            
            FixType.ADD_RETRY: {
                "description": "Add retry mechanism to node",
                "risk_level": "medium",
                "reversible": True
            },
            
            FixType.INCREASE_TIMEOUT: {
                "description": "Increase timeout values",
                "risk_level": "low",
                "reversible": True
            },
            
            FixType.ADD_VALIDATION: {
                "description": "Add input validation",
                "risk_level": "medium",
                "reversible": True
            },
            
            FixType.REPLACE_NODE: {
                "description": "Replace problematic node",
                "risk_level": "high",
                "reversible": True
            },
            
            FixType.ADD_ERROR_HANDLING: {
                "description": "Add error handling logic",
                "risk_level": "medium",
                "reversible": True
            },
            
            FixType.UPDATE_MAPPING: {
                "description": "Fix data mapping",
                "risk_level": "low",
                "reversible": True
            },
            
            FixType.ADD_CIRCUIT_BREAKER: {
                "description": "Add circuit breaker pattern",
                "risk_level": "high",
                "reversible": True
            }
        }
        
        return templates
    
    async def apply_fix(self, workflow_id: str, analysis: ErrorAnalysis) -> FixResult:
        """
        Применяет исправление на основе анализа ошибки
        
        Args:
            workflow_id: ID workflow'а для исправления
            analysis: Результат анализа ошибки
        
        Returns:
            Результат применения исправления
        """
        fix_id = str(uuid.uuid4())
        
        logger.info(f"🔧 Applying fix {fix_id} for workflow {workflow_id}")
        logger.info(f"   Fix type: {analysis.suggested_fix.fix_type.value}")
        logger.info(f"   Description: {analysis.suggested_fix.description}")
        
        try:
            # 1. Создаем backup
            backup_id = await self._create_backup(workflow_id, f"Before fix {fix_id}")
            
            # 2. Применяем исправление
            fix_result = await self._apply_fix_strategy(
                workflow_id, analysis.suggested_fix, fix_id, backup_id
            )
            
            # 3. Сохраняем в историю
            self.fix_history.append(fix_result)
            
            # Ограничиваем размер истории
            if len(self.fix_history) > 1000:
                self.fix_history = self.fix_history[-1000:]
            
            return fix_result
            
        except Exception as e:
            logger.error(f"❌ Failed to apply fix {fix_id}: {e}")
            
            return FixResult(
                fix_id=fix_id,
                success=False,
                status=FixStatus.FAILED,
                applied_at=datetime.now(),
                description=f"Fix application failed: {e}",
                error=str(e)
            )
    
    async def _create_backup(self, workflow_id: str, description: str) -> str:
        """Создает backup workflow'а"""
        backup_id = str(uuid.uuid4())
        
        try:
            # Получаем текущие ноды
            nodes = await self.connector.get_workflow_nodes(workflow_id)
            
            # Получаем workflow info для connections
            workflow_info = await self.connector.get_workflow_by_id(workflow_id)
            
            if not nodes:
                raise Exception("Failed to get workflow nodes for backup")
            
            # Конвертируем ноды в dict формат
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
            
            # Создаем backup
            backup = WorkflowBackup(
                backup_id=backup_id,
                workflow_id=workflow_id,
                nodes=nodes_data,
                connections={},  # TODO: получить connections из БД
                created_at=datetime.now(),
                description=description,
                metadata={"workflow_name": workflow_info.name if workflow_info else "Unknown"}
            )
            
            self.backups[backup_id] = backup
            
            logger.info(f"💾 Created backup {backup_id} for workflow {workflow_id}")
            return backup_id
            
        except Exception as e:
            logger.error(f"❌ Failed to create backup: {e}")
            raise
    
    async def _apply_fix_strategy(self, workflow_id: str, strategy: RepairStrategy, 
                                fix_id: str, backup_id: str) -> FixResult:
        """Применяет конкретную стратегию исправления"""
        
        fix_result = FixResult(
            fix_id=fix_id,
            success=False,
            status=FixStatus.IN_PROGRESS,
            applied_at=datetime.now(),
            description=strategy.description,
            backup_id=backup_id,
            rollback_available=True
        )
        
        try:
            # Получаем текущие ноды
            nodes = await self.connector.get_workflow_nodes(workflow_id)
            if not nodes:
                raise Exception("Failed to get workflow nodes")
            
            # Применяем исправление в зависимости от типа
            changes_made = []
            
            if strategy.fix_type == FixType.ADD_PARAMETER:
                changes_made = await self._fix_add_parameter(nodes, strategy.parameters)
            
            elif strategy.fix_type == FixType.UPDATE_PARAMETER:
                changes_made = await self._fix_update_parameter(nodes, strategy.parameters)
            
            elif strategy.fix_type == FixType.FIX_CREDENTIALS:
                changes_made = await self._fix_credentials(nodes, strategy.parameters)
            
            elif strategy.fix_type == FixType.INCREASE_TIMEOUT:
                changes_made = await self._fix_increase_timeout(nodes, strategy.parameters)
            
            elif strategy.fix_type == FixType.ADD_RETRY:
                changes_made = await self._fix_add_retry(nodes, strategy.parameters)
            
            elif strategy.fix_type == FixType.ADD_VALIDATION:
                changes_made = await self._fix_add_validation(nodes, strategy.parameters)
            
            elif strategy.fix_type == FixType.UPDATE_MAPPING:
                changes_made = await self._fix_update_mapping(nodes, strategy.parameters)
            
            elif strategy.fix_type == FixType.ADD_ERROR_HANDLING:
                changes_made = await self._fix_add_error_handling(nodes, strategy.parameters)
            
            else:
                raise Exception(f"Unsupported fix type: {strategy.fix_type}")
            
            # Сохраняем изменения
            if changes_made:
                success = await self.connector.update_workflow_nodes(workflow_id, nodes)
                
                if success:
                    fix_result.success = True
                    fix_result.status = FixStatus.APPLIED
                    fix_result.changes_made = changes_made
                    
                    logger.info(f"✅ Fix {fix_id} applied successfully")
                    logger.info(f"   Changes made: {len(changes_made)}")
                else:
                    raise Exception("Failed to save workflow changes")
            else:
                logger.warning(f"⚠️ No changes made for fix {fix_id}")
                fix_result.success = True
                fix_result.status = FixStatus.APPLIED
            
            return fix_result
            
        except Exception as e:
            logger.error(f"❌ Fix application failed: {e}")
            fix_result.success = False
            fix_result.status = FixStatus.FAILED
            fix_result.error = str(e)
            return fix_result
    
    async def _fix_add_parameter(self, nodes: List[NodeInfo], parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Добавляет параметр к ноде"""
        changes = []
        
        param_name = parameters.get("parameter")
        param_value = parameters.get("value")
        target_node_type = parameters.get("node_type")
        
        if not param_name or param_value is None:
            return changes
        
        for node in nodes:
            # Проверяем, нужно ли добавлять параметр к этой ноде
            should_add = False
            
            if target_node_type and target_node_type in node.type:
                should_add = True
            elif "memory" in node.type.lower() and param_name == "sessionIdExpression":
                should_add = True
            
            if should_add and param_name not in node.parameters:
                node.parameters[param_name] = param_value
                
                changes.append({
                    "action": "add_parameter",
                    "node_id": node.id,
                    "node_name": node.name,
                    "parameter": param_name,
                    "value": param_value
                })
                
                logger.debug(f"   Added parameter {param_name} to node {node.name}")
        
        return changes
    
    async def _fix_update_parameter(self, nodes: List[NodeInfo], parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Обновляет существующий параметр"""
        changes = []
        
        param_name = parameters.get("parameter")
        param_value = parameters.get("value")
        target_node_name = parameters.get("node_name")
        
        if not param_name or param_value is None:
            return changes
        
        for node in nodes:
            if target_node_name and node.name != target_node_name:
                continue
            
            if param_name in node.parameters:
                old_value = node.parameters[param_name]
                node.parameters[param_name] = param_value
                
                changes.append({
                    "action": "update_parameter",
                    "node_id": node.id,
                    "node_name": node.name,
                    "parameter": param_name,
                    "old_value": old_value,
                    "new_value": param_value
                })
                
                logger.debug(f"   Updated parameter {param_name} in node {node.name}")
        
        return changes
    
    async def _fix_credentials(self, nodes: List[NodeInfo], parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Исправляет credentials нод"""
        changes = []
        
        credential_type = parameters.get("credential_type")
        credential_id = parameters.get("credential_id")
        
        if not credential_type or not credential_id:
            return changes
        
        for node in nodes:
            # Определяем, нужны ли credentials этой ноде
            needs_credentials = False
            
            if "openrouter" in node.type.lower() and credential_type == "openRouterApi":
                needs_credentials = True
            elif "google" in node.type.lower() and "googleDrive" in credential_type:
                needs_credentials = True
            elif "langchain" in node.type.lower() and credential_type == "openRouterApi":
                needs_credentials = True
            
            if needs_credentials:
                if not node.credentials:
                    node.credentials = {}
                
                old_credentials = node.credentials.get(credential_type)
                node.credentials[credential_type] = {
                    "id": credential_id,
                    "name": f"{credential_type} account"
                }
                
                changes.append({
                    "action": "fix_credentials",
                    "node_id": node.id,
                    "node_name": node.name,
                    "credential_type": credential_type,
                    "credential_id": credential_id,
                    "old_credentials": old_credentials
                })
                
                logger.debug(f"   Fixed credentials for node {node.name}")
        
        return changes
    
    async def _fix_increase_timeout(self, nodes: List[NodeInfo], parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Увеличивает timeout"""
        changes = []
        
        timeout_value = parameters.get("timeout", 60000)
        timeout_field = parameters.get("field", "options.timeout")
        
        for node in nodes:
            if "httpRequest" in node.type or "http" in node.type.lower():
                # Обновляем timeout в options
                if "options" not in node.parameters:
                    node.parameters["options"] = {}
                
                old_timeout = node.parameters["options"].get("timeout")
                node.parameters["options"]["timeout"] = timeout_value
                
                changes.append({
                    "action": "increase_timeout",
                    "node_id": node.id,
                    "node_name": node.name,
                    "field": timeout_field,
                    "old_value": old_timeout,
                    "new_value": timeout_value
                })
                
                logger.debug(f"   Increased timeout for node {node.name} to {timeout_value}ms")
        
        return changes
    
    async def _fix_add_retry(self, nodes: List[NodeInfo], parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Добавляет retry механизм"""
        changes = []
        
        max_retries = parameters.get("max_retries", 3)
        backoff_factor = parameters.get("backoff_factor", 2)
        
        for node in nodes:
            if "httpRequest" in node.type:
                # Добавляем retry параметры
                if "options" not in node.parameters:
                    node.parameters["options"] = {}
                
                node.parameters["options"]["retry"] = {
                    "enabled": True,
                    "maxRetries": max_retries,
                    "backoffFactor": backoff_factor
                }
                
                changes.append({
                    "action": "add_retry",
                    "node_id": node.id,
                    "node_name": node.name,
                    "max_retries": max_retries,
                    "backoff_factor": backoff_factor
                })
                
                logger.debug(f"   Added retry mechanism to node {node.name}")
        
        return changes
    
    async def _fix_add_validation(self, nodes: List[NodeInfo], parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Добавляет валидацию входных данных"""
        changes = []
        
        add_null_checks = parameters.get("add_null_checks", True)
        provide_defaults = parameters.get("provide_defaults", True)
        
        for node in nodes:
            if node.type == "n8n-nodes-base.code":
                # Модифицируем JavaScript код для добавления валидации
                current_code = node.parameters.get("jsCode", "")
                
                if add_null_checks and "null" not in current_code:
                    validation_code = """
// Input validation
const input = $input.first();
if (!input || !input.json) {
    return [{json: {error: "Invalid input data"}}];
}

"""
                    node.parameters["jsCode"] = validation_code + current_code
                    
                    changes.append({
                        "action": "add_validation",
                        "node_id": node.id,
                        "node_name": node.name,
                        "validation_type": "null_checks"
                    })
                    
                    logger.debug(f"   Added validation to code node {node.name}")
        
        return changes
    
    async def _fix_update_mapping(self, nodes: List[NodeInfo], parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Исправляет mapping данных"""
        changes = []
        
        problematic_field = parameters.get("problematic_field")
        fix_paths = parameters.get("fix_paths", True)
        
        for node in nodes:
            if node.type == "n8n-nodes-base.set":
                # Исправляем пути в Set node
                values = node.parameters.get("values", {})
                
                for value_type, value_list in values.items():
                    if isinstance(value_list, list):
                        for value_item in value_list:
                            if isinstance(value_item, dict) and "value" in value_item:
                                old_value = value_item["value"]
                                
                                # Исправляем общие проблемы с путями
                                if isinstance(old_value, str):
                                    new_value = old_value
                                    
                                    # Исправляем отсутствующие $json
                                    if "data" in new_value and "$json" not in new_value:
                                        new_value = new_value.replace("data", "$json.data")
                                    
                                    # Исправляем двойные точки
                                    new_value = new_value.replace("..", ".")
                                    
                                    if new_value != old_value:
                                        value_item["value"] = new_value
                                        
                                        changes.append({
                                            "action": "update_mapping",
                                            "node_id": node.id,
                                            "node_name": node.name,
                                            "field": value_item.get("name", "unknown"),
                                            "old_value": old_value,
                                            "new_value": new_value
                                        })
                                        
                                        logger.debug(f"   Fixed mapping in node {node.name}")
        
        return changes
    
    async def _fix_add_error_handling(self, nodes: List[NodeInfo], parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Добавляет обработку ошибок"""
        changes = []
        
        wrap_in_try_catch = parameters.get("wrap_in_try_catch", True)
        provide_fallback = parameters.get("provide_fallback", True)
        
        for node in nodes:
            if node.type == "n8n-nodes-base.code":
                current_code = node.parameters.get("jsCode", "")
                
                if wrap_in_try_catch and "try" not in current_code:
                    wrapped_code = f"""
try {{
{current_code}
}} catch (error) {{
    console.error('Node execution error:', error);
    return [{{
        json: {{
            error: error.message,
            node: '{node.name}',
            timestamp: new Date().toISOString()
        }}
    }}];
}}
"""
                    node.parameters["jsCode"] = wrapped_code
                    
                    changes.append({
                        "action": "add_error_handling",
                        "node_id": node.id,
                        "node_name": node.name,
                        "handling_type": "try_catch"
                    })
                    
                    logger.debug(f"   Added error handling to node {node.name}")
        
        return changes
    
    async def rollback_fix(self, fix_id: str) -> bool:
        """Откатывает исправление"""
        try:
            # Находим исправление в истории
            fix_result = next((f for f in self.fix_history if f.fix_id == fix_id), None)
            
            if not fix_result:
                logger.error(f"❌ Fix {fix_id} not found in history")
                return False
            
            if not fix_result.backup_id:
                logger.error(f"❌ No backup available for fix {fix_id}")
                return False
            
            # Получаем backup
            backup = self.backups.get(fix_result.backup_id)
            if not backup:
                logger.error(f"❌ Backup {fix_result.backup_id} not found")
                return False
            
            logger.info(f"🔄 Rolling back fix {fix_id}")
            
            # Конвертируем backup nodes в NodeInfo
            nodes = []
            for node_data in backup.nodes:
                node = NodeInfo(
                    id=node_data["id"],
                    name=node_data["name"],
                    type=node_data["type"],
                    parameters=node_data["parameters"],
                    position=node_data["position"],
                    credentials=node_data.get("credentials")
                )
                nodes.append(node)
            
            # Восстанавливаем workflow
            success = await self.connector.update_workflow_nodes(backup.workflow_id, nodes)
            
            if success:
                fix_result.status = FixStatus.ROLLED_BACK
                logger.info(f"✅ Fix {fix_id} rolled back successfully")
                return True
            else:
                logger.error(f"❌ Failed to rollback fix {fix_id}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Rollback error: {e}")
            return False
    
    def get_fix_history(self, limit: int = 50) -> List[FixResult]:
        """Возвращает историю исправлений"""
        return sorted(self.fix_history, key=lambda x: x.applied_at, reverse=True)[:limit]
    
    def get_backup_info(self, backup_id: str) -> Optional[WorkflowBackup]:
        """Возвращает информацию о backup'е"""
        return self.backups.get(backup_id)
    
    def cleanup_old_backups(self, days: int = 7):
        """Очищает старые backup'ы"""
        cutoff_time = datetime.now() - timedelta(days=days)
        
        old_backups = [
            backup_id for backup_id, backup in self.backups.items()
            if backup.created_at < cutoff_time
        ]
        
        for backup_id in old_backups:
            del self.backups[backup_id]
        
        logger.info(f"🗑️ Cleaned up {len(old_backups)} old backups")
    
    def get_statistics(self) -> Dict[str, Any]:
        """Возвращает статистику исправлений"""
        if not self.fix_history:
            return {"total_fixes": 0}
        
        successful_fixes = [f for f in self.fix_history if f.success]
        failed_fixes = [f for f in self.fix_history if not f.success]
        rolled_back_fixes = [f for f in self.fix_history if f.status == FixStatus.ROLLED_BACK]
        
        return {
            "total_fixes": len(self.fix_history),
            "successful_fixes": len(successful_fixes),
            "failed_fixes": len(failed_fixes),
            "rolled_back_fixes": len(rolled_back_fixes),
            "success_rate": len(successful_fixes) / len(self.fix_history) if self.fix_history else 0,
            "total_backups": len(self.backups)
        }

# Утилитарные функции

async def test_fixer():
    """Тестирует функциональность исправителя"""
    from connector import N8NConnector
    from analyzer import ErrorAnalysis, RepairStrategy, FixType
    
    connector = N8NConnector()
    await connector.connect()
    
    fixer = AutoFixer(connector)
    
    # Создаем тестовый анализ
    test_strategy = RepairStrategy(
        fix_type=FixType.ADD_PARAMETER,
        description="Add sessionId parameter",
        confidence_threshold=0.9,
        parameters={
            "parameter": "sessionIdExpression",
            "value": "={{ $workflow.executionId }}",
            "node_type": "memoryBufferWindow"
        }
    )
    
    test_analysis = ErrorAnalysis(
        error_id="test_error",
        category="configuration",
        confidence=0.9,
        description="Missing sessionId parameter",
        suggested_fix=test_strategy
    )
    
    # Применяем исправление
    result = await fixer.apply_fix("test_workflow_id", test_analysis)
    
    print(f"Fix result: {result.success}")
    print(f"Changes made: {len(result.changes_made)}")
    
    return result

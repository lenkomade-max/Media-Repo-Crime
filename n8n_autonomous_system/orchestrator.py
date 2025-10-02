#!/usr/bin/env python3
"""
🤖 AUTONOMOUS N8N ORCHESTRATOR - Главный агент автономной системы

Этот модуль реализует полностью автономную систему управления N8N, которая:
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
import json
import logging
import signal
import sys
import time
import yaml
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import uuid

# Импорты компонентов системы
from connector import N8NConnector
from monitor import ExecutionMonitor, ExecutionEvent
from analyzer import ErrorAnalyzer, ErrorAnalysis
from fixer import AutoFixer, FixResult
from test_harness import TestHarness, TestResult
from audit import AuditLogger, AuditEntry
from notifier import NotificationService, NotificationLevel

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('orchestrator.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class SystemState(Enum):
    """Состояния системы"""
    INITIALIZING = "initializing"
    HEALTHY = "healthy"
    MONITORING = "monitoring"
    ANALYZING = "analyzing"
    FIXING = "fixing"
    TESTING = "testing"
    ESCALATING = "escalating"
    EMERGENCY = "emergency"
    SHUTDOWN = "shutdown"

class IncidentSeverity(Enum):
    """Уровни серьезности инцидентов"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    EMERGENCY = "emergency"

@dataclass
class Incident:
    """Инцидент в системе"""
    id: str
    workflow_id: str
    execution_id: Optional[str]
    severity: IncidentSeverity
    error_type: str
    description: str
    created_at: datetime
    attempts: int = 0
    last_attempt_at: Optional[datetime] = None
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    escalated: bool = False
    escalated_at: Optional[datetime] = None

@dataclass
class SystemMetrics:
    """Метрики системы"""
    incidents_total: int = 0
    incidents_resolved: int = 0
    incidents_escalated: int = 0
    average_resolution_time: float = 0.0
    success_rate: float = 0.0
    uptime_percentage: float = 100.0
    last_updated: datetime = None

class AutonomousOrchestrator:
    """
    Главный оркестратор автономной системы
    
    Координирует работу всех компонентов и реализует основной цикл:
    detect → analyze → fix → verify → repeat
    """
    
    def __init__(self, config_path: str = "policy.yml"):
        """Инициализация оркестратора"""
        self.config_path = Path(config_path)
        self.config = self._load_config()
        
        # Состояние системы
        self.state = SystemState.INITIALIZING
        self.start_time = datetime.now()
        self.shutdown_requested = False
        
        # Активные инциденты
        self.active_incidents: Dict[str, Incident] = {}
        self.incident_history: List[Incident] = []
        
        # Метрики
        self.metrics = SystemMetrics(last_updated=datetime.now())
        
        # Инициализация компонентов
        self._initialize_components()
        
        # Настройка обработчиков сигналов
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        logger.info("🤖 Autonomous Orchestrator initialized")
    
    def _load_config(self) -> Dict[str, Any]:
        """Загружает конфигурацию из файла"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            logger.info(f"✅ Configuration loaded from {self.config_path}")
            return config
        except Exception as e:
            logger.error(f"❌ Failed to load configuration: {e}")
            # Возвращаем базовую конфигурацию
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Возвращает конфигурацию по умолчанию"""
        return {
            "security": {
                "max_attempts": 5,
                "cooldown_seconds": 300,
                "auto_apply_threshold": 0.8,
                "require_approval_threshold": 0.7
            },
            "monitoring": {
                "poll_interval_seconds": 10,
                "execution_timeout_seconds": 600,
                "health_check_interval_seconds": 60
            },
            "notifications": {
                "channels": {
                    "telegram": {"enabled": False},
                    "slack": {"enabled": False},
                    "email": {"enabled": False}
                }
            }
        }
    
    def _initialize_components(self):
        """Инициализирует все компоненты системы"""
        try:
            # N8N Connector
            self.connector = N8NConnector(
                api_url=self.config.get("integrations", {}).get("n8n", {}).get("api_url"),
                ssh_host=self.config.get("integrations", {}).get("n8n", {}).get("ssh_host")
            )
            
            # Execution Monitor
            self.monitor = ExecutionMonitor(
                connector=self.connector,
                poll_interval=self.config["monitoring"]["poll_interval_seconds"]
            )
            
            # Error Analyzer
            self.analyzer = ErrorAnalyzer(
                config=self.config.get("repair_strategies", {})
            )
            
            # Auto Fixer
            self.fixer = AutoFixer(
                connector=self.connector,
                config=self.config.get("repair_strategies", {})
            )
            
            # Test Harness
            self.test_harness = TestHarness(
                connector=self.connector,
                config=self.config.get("testing", {})
            )
            
            # Audit Logger
            self.audit = AuditLogger(
                config=self.config.get("audit", {})
            )
            
            # Notification Service
            self.notifier = NotificationService(
                config=self.config.get("notifications", {})
            )
            
            logger.info("✅ All components initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize components: {e}")
            raise
    
    def _signal_handler(self, signum, frame):
        """Обработчик сигналов для graceful shutdown"""
        logger.info(f"📡 Received signal {signum}, initiating shutdown...")
        self.shutdown_requested = True
    
    async def run(self):
        """
        Главный цикл работы автономной системы
        
        Реализует основной алгоритм:
        1. Health check системы
        2. Мониторинг выполнений
        3. Детекция проблем
        4. Анализ и планирование исправлений
        5. Применение исправлений
        6. Верификация результатов
        7. Повтор цикла
        """
        logger.info("🚀 Starting autonomous orchestration cycle")
        
        try:
            # Проверка здоровья системы при старте
            if not await self._system_health_check():
                logger.error("❌ System health check failed, cannot start")
                return False
            
            self.state = SystemState.HEALTHY
            await self.notifier.send_notification(
                "🚀 Autonomous N8N Orchestrator started",
                NotificationLevel.INFO
            )
            
            # Основной цикл
            while not self.shutdown_requested:
                cycle_start = time.time()
                
                try:
                    # 1. Мониторинг и детекция проблем
                    await self._monitoring_phase()
                    
                    # 2. Анализ активных инцидентов
                    if self.active_incidents:
                        await self._analysis_phase()
                    
                    # 3. Применение исправлений
                    if self.active_incidents:
                        await self._fixing_phase()
                    
                    # 4. Периодические задачи
                    await self._maintenance_tasks()
                    
                    # 5. Обновление метрик
                    self._update_metrics()
                    
                except Exception as e:
                    logger.error(f"💥 Error in orchestration cycle: {e}")
                    await self.notifier.send_notification(
                        f"❌ Orchestration cycle error: {e}",
                        NotificationLevel.CRITICAL
                    )
                
                # Контроль частоты циклов
                cycle_duration = time.time() - cycle_start
                sleep_time = max(0, self.config["monitoring"]["poll_interval_seconds"] - cycle_duration)
                
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
            
            # Graceful shutdown
            await self._shutdown()
            return True
            
        except Exception as e:
            logger.error(f"💥 Critical error in orchestrator: {e}")
            self.state = SystemState.EMERGENCY
            await self.notifier.send_notification(
                f"🚨 EMERGENCY: Orchestrator critical error: {e}",
                NotificationLevel.EMERGENCY
            )
            return False
    
    async def _system_health_check(self) -> bool:
        """Проверяет здоровье всех компонентов системы"""
        logger.info("🔍 Performing system health check...")
        
        health_status = {
            "n8n": False,
            "postgresql": False,
            "mcp_server": False,
            "components": False
        }
        
        try:
            # Проверка N8N
            health_status["n8n"] = await self.connector.health_check()
            
            # Проверка PostgreSQL
            health_status["postgresql"] = await self.connector.database_health_check()
            
            # Проверка MCP Server
            health_status["mcp_server"] = await self.connector.mcp_server_health_check()
            
            # Проверка компонентов
            health_status["components"] = all([
                self.monitor is not None,
                self.analyzer is not None,
                self.fixer is not None,
                self.test_harness is not None,
                self.audit is not None,
                self.notifier is not None
            ])
            
            overall_health = all(health_status.values())
            
            # Логирование результатов
            for component, status in health_status.items():
                status_emoji = "✅" if status else "❌"
                logger.info(f"  {status_emoji} {component.upper()}: {'Healthy' if status else 'Unhealthy'}")
            
            if overall_health:
                logger.info("✅ System health check passed")
            else:
                logger.error("❌ System health check failed")
                await self.notifier.send_notification(
                    f"🏥 System health check failed: {health_status}",
                    NotificationLevel.CRITICAL
                )
            
            return overall_health
            
        except Exception as e:
            logger.error(f"💥 Health check error: {e}")
            return False
    
    async def _monitoring_phase(self):
        """Фаза мониторинга - детекция новых проблем"""
        self.state = SystemState.MONITORING
        
        try:
            # Получаем события от монитора
            events = await self.monitor.get_recent_events()
            
            for event in events:
                if event.has_errors():
                    await self._handle_execution_error(event)
            
        except Exception as e:
            logger.error(f"❌ Monitoring phase error: {e}")
    
    async def _handle_execution_error(self, event: ExecutionEvent):
        """Обрабатывает ошибку выполнения"""
        incident_id = str(uuid.uuid4())
        
        # Определяем серьезность
        severity = self._determine_severity(event)
        
        # Создаем инцидент
        incident = Incident(
            id=incident_id,
            workflow_id=event.workflow_id,
            execution_id=event.execution_id,
            severity=severity,
            error_type=event.error_type,
            description=event.error_message,
            created_at=datetime.now()
        )
        
        self.active_incidents[incident_id] = incident
        
        # Логируем инцидент
        await self.audit.log_incident_created(incident)
        
        logger.warning(f"🚨 New incident detected: {incident_id} ({severity.value})")
        
        # Уведомляем о критичных инцидентах
        if severity in [IncidentSeverity.CRITICAL, IncidentSeverity.EMERGENCY]:
            await self.notifier.send_notification(
                f"🚨 {severity.value.upper()} incident: {incident.description}",
                NotificationLevel.CRITICAL if severity == IncidentSeverity.CRITICAL else NotificationLevel.EMERGENCY
            )
    
    def _determine_severity(self, event: ExecutionEvent) -> IncidentSeverity:
        """Определяет серьезность инцидента"""
        # Простая логика определения серьезности
        if "authentication" in event.error_message.lower():
            return IncidentSeverity.HIGH
        elif "timeout" in event.error_message.lower():
            return IncidentSeverity.MEDIUM
        elif "network" in event.error_message.lower():
            return IncidentSeverity.MEDIUM
        elif "critical" in event.error_message.lower():
            return IncidentSeverity.CRITICAL
        else:
            return IncidentSeverity.LOW
    
    async def _analysis_phase(self):
        """Фаза анализа - анализ активных инцидентов"""
        self.state = SystemState.ANALYZING
        
        for incident_id, incident in list(self.active_incidents.items()):
            try:
                # Проверяем cooldown
                if self._is_in_cooldown(incident):
                    continue
                
                # Проверяем лимит попыток
                if incident.attempts >= self.config["security"]["max_attempts"]:
                    await self._escalate_incident(incident)
                    continue
                
                # Анализируем ошибку
                analysis = await self.analyzer.analyze_error(
                    incident.workflow_id,
                    incident.error_type,
                    incident.description
                )
                
                # Планируем исправление если уверенность достаточная
                if analysis.confidence >= self.config["security"]["auto_apply_threshold"]:
                    incident.analysis = analysis
                    logger.info(f"📊 Analysis completed for incident {incident_id}: confidence {analysis.confidence:.2f}")
                elif analysis.confidence >= self.config["security"]["require_approval_threshold"]:
                    await self._request_approval(incident, analysis)
                else:
                    logger.warning(f"⚠️ Low confidence analysis for incident {incident_id}: {analysis.confidence:.2f}")
                
            except Exception as e:
                logger.error(f"❌ Analysis error for incident {incident_id}: {e}")
    
    def _is_in_cooldown(self, incident: Incident) -> bool:
        """Проверяет, находится ли инцидент в cooldown периоде"""
        if incident.last_attempt_at is None:
            return False
        
        cooldown_seconds = self.config["security"]["cooldown_seconds"]
        time_since_last_attempt = datetime.now() - incident.last_attempt_at
        
        return time_since_last_attempt.total_seconds() < cooldown_seconds
    
    async def _fixing_phase(self):
        """Фаза исправления - применение исправлений"""
        self.state = SystemState.FIXING
        
        for incident_id, incident in list(self.active_incidents.items()):
            try:
                # Пропускаем инциденты без анализа или в cooldown
                if not hasattr(incident, 'analysis') or self._is_in_cooldown(incident):
                    continue
                
                # Применяем исправление
                incident.attempts += 1
                incident.last_attempt_at = datetime.now()
                
                logger.info(f"🔧 Applying fix for incident {incident_id} (attempt {incident.attempts})")
                
                fix_result = await self.fixer.apply_fix(
                    incident.workflow_id,
                    incident.analysis
                )
                
                if fix_result.success:
                    # Тестируем исправление
                    test_result = await self._test_fix(incident, fix_result)
                    
                    if test_result.success:
                        await self._resolve_incident(incident)
                    else:
                        logger.warning(f"⚠️ Fix test failed for incident {incident_id}")
                else:
                    logger.error(f"❌ Fix application failed for incident {incident_id}: {fix_result.error}")
                
            except Exception as e:
                logger.error(f"❌ Fixing error for incident {incident_id}: {e}")
    
    async def _test_fix(self, incident: Incident, fix_result: FixResult) -> TestResult:
        """Тестирует примененное исправление"""
        self.state = SystemState.TESTING
        
        try:
            # Тестируем в staging среде
            test_result = await self.test_harness.test_workflow(
                incident.workflow_id,
                test_type="fix_validation"
            )
            
            return test_result
            
        except Exception as e:
            logger.error(f"❌ Test error: {e}")
            return TestResult(success=False, error=str(e))
    
    async def _resolve_incident(self, incident: Incident):
        """Разрешает инцидент"""
        incident.resolved = True
        incident.resolved_at = datetime.now()
        
        # Перемещаем в историю
        self.incident_history.append(incident)
        del self.active_incidents[incident.id]
        
        # Логируем разрешение
        await self.audit.log_incident_resolved(incident)
        
        logger.info(f"✅ Incident {incident.id} resolved successfully")
        
        # Уведомляем о разрешении
        await self.notifier.send_notification(
            f"✅ Incident resolved: {incident.description}",
            NotificationLevel.INFO
        )
    
    async def _escalate_incident(self, incident: Incident):
        """Эскалирует инцидент"""
        self.state = SystemState.ESCALATING
        
        incident.escalated = True
        incident.escalated_at = datetime.now()
        
        # Логируем эскалацию
        await self.audit.log_incident_escalated(incident)
        
        logger.warning(f"⬆️ Incident {incident.id} escalated after {incident.attempts} attempts")
        
        # Отправляем уведомление об эскалации
        await self.notifier.send_notification(
            f"⬆️ ESCALATION: Incident {incident.id} requires manual intervention\n"
            f"Workflow: {incident.workflow_id}\n"
            f"Error: {incident.description}\n"
            f"Attempts: {incident.attempts}",
            NotificationLevel.CRITICAL
        )
        
        # Перемещаем в историю
        self.incident_history.append(incident)
        del self.active_incidents[incident.id]
    
    async def _request_approval(self, incident: Incident, analysis: ErrorAnalysis):
        """Запрашивает ручное подтверждение для исправления"""
        logger.info(f"👤 Requesting approval for incident {incident.id}")
        
        approval_message = (
            f"🤖 APPROVAL REQUIRED\n\n"
            f"Incident: {incident.id}\n"
            f"Workflow: {incident.workflow_id}\n"
            f"Error: {incident.description}\n"
            f"Proposed fix: {analysis.suggested_fix}\n"
            f"Confidence: {analysis.confidence:.2f}\n\n"
            f"Reply with 'APPROVE {incident.id}' or 'REJECT {incident.id}'"
        )
        
        await self.notifier.send_notification(
            approval_message,
            NotificationLevel.WARNING
        )
    
    async def _maintenance_tasks(self):
        """Выполняет периодические задачи обслуживания"""
        current_time = datetime.now()
        
        # Проверка здоровья системы каждые N минут
        health_check_interval = self.config["monitoring"]["health_check_interval_seconds"]
        if not hasattr(self, '_last_health_check'):
            self._last_health_check = current_time
        
        if (current_time - self._last_health_check).total_seconds() >= health_check_interval:
            await self._system_health_check()
            self._last_health_check = current_time
        
        # Очистка старых инцидентов из истории
        cutoff_time = current_time - timedelta(days=7)
        self.incident_history = [
            incident for incident in self.incident_history
            if incident.created_at > cutoff_time
        ]
    
    def _update_metrics(self):
        """Обновляет метрики системы"""
        total_incidents = len(self.incident_history) + len(self.active_incidents)
        resolved_incidents = len([i for i in self.incident_history if i.resolved])
        escalated_incidents = len([i for i in self.incident_history if i.escalated])
        
        self.metrics.incidents_total = total_incidents
        self.metrics.incidents_resolved = resolved_incidents
        self.metrics.incidents_escalated = escalated_incidents
        
        if total_incidents > 0:
            self.metrics.success_rate = resolved_incidents / total_incidents
        
        # Среднее время разрешения
        resolved_with_time = [
            i for i in self.incident_history
            if i.resolved and i.resolved_at and i.created_at
        ]
        
        if resolved_with_time:
            total_resolution_time = sum([
                (i.resolved_at - i.created_at).total_seconds()
                for i in resolved_with_time
            ])
            self.metrics.average_resolution_time = total_resolution_time / len(resolved_with_time)
        
        # Uptime
        uptime_seconds = (datetime.now() - self.start_time).total_seconds()
        self.metrics.uptime_percentage = min(100.0, (uptime_seconds / (uptime_seconds + 1)) * 100)
        
        self.metrics.last_updated = datetime.now()
    
    async def _shutdown(self):
        """Graceful shutdown системы"""
        logger.info("🛑 Initiating graceful shutdown...")
        self.state = SystemState.SHUTDOWN
        
        # Уведомляем о shutdown
        await self.notifier.send_notification(
            "🛑 Autonomous N8N Orchestrator shutting down",
            NotificationLevel.INFO
        )
        
        # Сохраняем состояние
        await self._save_state()
        
        # Закрываем соединения
        if hasattr(self, 'connector'):
            await self.connector.close()
        
        logger.info("✅ Graceful shutdown completed")
    
    async def _save_state(self):
        """Сохраняет текущее состояние системы"""
        try:
            state_data = {
                "active_incidents": [asdict(incident) for incident in self.active_incidents.values()],
                "metrics": asdict(self.metrics),
                "shutdown_time": datetime.now().isoformat()
            }
            
            with open("orchestrator_state.json", "w") as f:
                json.dump(state_data, f, indent=2, default=str)
            
            logger.info("💾 System state saved")
            
        except Exception as e:
            logger.error(f"❌ Failed to save state: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """Возвращает текущий статус системы"""
        return {
            "state": self.state.value,
            "uptime": str(datetime.now() - self.start_time),
            "active_incidents": len(self.active_incidents),
            "metrics": asdict(self.metrics),
            "config_version": self.config.get("versioning", {}).get("config_version", "unknown")
        }

async def main():
    """Главная функция"""
    print("🤖 Autonomous N8N Orchestrator")
    print("=" * 50)
    print("🎯 Полностью автономная система управления N8N")
    print("🔄 Цикл: detect → analyze → fix → verify → repeat")
    print("🛡️ Безопасные исправления с полным аудитом")
    print("🚀 Реальная помощь, не имитация!")
    print()
    
    try:
        # Создаем и запускаем оркестратор
        orchestrator = AutonomousOrchestrator()
        
        # Запускаем основной цикл
        success = await orchestrator.run()
        
        if success:
            print("✅ Orchestrator completed successfully")
            return 0
        else:
            print("❌ Orchestrator failed")
            return 1
            
    except KeyboardInterrupt:
        print("\n🛑 Interrupted by user")
        return 0
    except Exception as e:
        print(f"\n💥 Critical error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

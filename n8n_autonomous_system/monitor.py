#!/usr/bin/env python3
"""
👁️ EXECUTION MONITOR - Система мониторинга выполнений N8N

Этот модуль обеспечивает real-time мониторинг выполнений workflow'ов через:
- Polling механизм для периодической проверки
- Webhook listener для push-уведомлений
- Anomaly detection для выявления аномалий
- Event aggregation для анализа трендов

Автор: AI Assistant
Дата: 2025-10-02
Версия: 1.0
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, field
from enum import Enum
import statistics
from collections import defaultdict, deque

from connector import N8NConnector, ExecutionInfo

logger = logging.getLogger(__name__)

class EventType(Enum):
    """Типы событий мониторинга"""
    EXECUTION_STARTED = "execution_started"
    EXECUTION_COMPLETED = "execution_completed"
    EXECUTION_FAILED = "execution_failed"
    EXECUTION_TIMEOUT = "execution_timeout"
    NODE_ERROR = "node_error"
    WORKFLOW_ACTIVATED = "workflow_activated"
    WORKFLOW_DEACTIVATED = "workflow_deactivated"
    SYSTEM_ANOMALY = "system_anomaly"

class Severity(Enum):
    """Уровни серьезности событий"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

@dataclass
class ExecutionEvent:
    """Событие выполнения"""
    id: str
    event_type: EventType
    severity: Severity
    workflow_id: str
    execution_id: Optional[str]
    timestamp: datetime
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    node_name: Optional[str] = None
    duration: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def has_errors(self) -> bool:
        """Проверяет, содержит ли событие ошибки"""
        return self.event_type in [
            EventType.EXECUTION_FAILED,
            EventType.NODE_ERROR,
            EventType.EXECUTION_TIMEOUT
        ]

@dataclass
class MonitoringStats:
    """Статистика мониторинга"""
    total_executions: int = 0
    successful_executions: int = 0
    failed_executions: int = 0
    average_execution_time: float = 0.0
    error_rate: float = 0.0
    last_updated: datetime = field(default_factory=datetime.now)
    
    def update_success_rate(self):
        """Обновляет процент успешности"""
        if self.total_executions > 0:
            self.error_rate = self.failed_executions / self.total_executions
        else:
            self.error_rate = 0.0

@dataclass
class AnomalyAlert:
    """Алерт об аномалии"""
    id: str
    anomaly_type: str
    description: str
    severity: Severity
    detected_at: datetime
    workflow_id: Optional[str] = None
    threshold_value: Optional[float] = None
    actual_value: Optional[float] = None

class ExecutionMonitor:
    """
    Монитор выполнений N8N
    
    Отслеживает выполнения workflow'ов в реальном времени и выявляет проблемы:
    - Polling для периодической проверки
    - Event aggregation для анализа
    - Anomaly detection для выявления аномалий
    - Performance tracking для оптимизации
    """
    
    def __init__(self, connector: N8NConnector, poll_interval: int = 10):
        """Инициализация монитора"""
        self.connector = connector
        self.poll_interval = poll_interval
        
        # Состояние мониторинга
        self.is_running = False
        self.last_poll_time = datetime.now()
        
        # События и статистика
        self.recent_events: deque = deque(maxlen=1000)  # Последние 1000 событий
        self.stats = MonitoringStats()
        
        # Кэш для отслеживания изменений
        self.known_executions: Set[str] = set()
        self.execution_states: Dict[str, str] = {}  # execution_id -> status
        
        # Anomaly detection
        self.execution_times: deque = deque(maxlen=100)  # Последние 100 времен выполнения
        self.error_counts: Dict[str, int] = defaultdict(int)  # Счетчики ошибок по типам
        self.anomaly_thresholds = {
            "execution_time_multiplier": 3.0,  # Превышение среднего времени в 3 раза
            "error_rate_threshold": 0.1,       # 10% ошибок
            "consecutive_failures": 5           # 5 подряд неудачных выполнений
        }
        
        # Webhook server (опционально)
        self.webhook_server = None
        self.webhook_port = 8080
        
        logger.info("👁️ Execution Monitor initialized")
    
    async def start(self, enable_webhook: bool = False):
        """Запускает мониторинг"""
        if self.is_running:
            logger.warning("⚠️ Monitor is already running")
            return
        
        self.is_running = True
        logger.info("🚀 Starting execution monitoring...")
        
        # Запускаем polling в фоне
        polling_task = asyncio.create_task(self._polling_loop())
        
        # Запускаем webhook server если нужно
        webhook_task = None
        if enable_webhook:
            webhook_task = asyncio.create_task(self._start_webhook_server())
        
        # Запускаем anomaly detection
        anomaly_task = asyncio.create_task(self._anomaly_detection_loop())
        
        try:
            # Ждем завершения всех задач
            tasks = [polling_task, anomaly_task]
            if webhook_task:
                tasks.append(webhook_task)
            
            await asyncio.gather(*tasks)
            
        except Exception as e:
            logger.error(f"❌ Monitor error: {e}")
        finally:
            self.is_running = False
    
    async def stop(self):
        """Останавливает мониторинг"""
        logger.info("🛑 Stopping execution monitoring...")
        self.is_running = False
        
        if self.webhook_server:
            await self.webhook_server.cleanup()
    
    async def _polling_loop(self):
        """Основной цикл polling'а"""
        logger.info("🔄 Starting polling loop...")
        
        while self.is_running:
            try:
                await self._poll_executions()
                await asyncio.sleep(self.poll_interval)
                
            except Exception as e:
                logger.error(f"❌ Polling error: {e}")
                await asyncio.sleep(self.poll_interval)
    
    async def _poll_executions(self):
        """Опрашивает выполнения"""
        try:
            # Получаем последние выполнения
            executions = await self.connector.get_recent_executions(limit=100)
            
            for execution in executions:
                await self._process_execution(execution)
            
            self.last_poll_time = datetime.now()
            
        except Exception as e:
            logger.error(f"❌ Failed to poll executions: {e}")
    
    async def _process_execution(self, execution: ExecutionInfo):
        """Обрабатывает выполнение"""
        execution_id = execution.id
        
        # Проверяем, новое ли это выполнение
        if execution_id not in self.known_executions:
            # Новое выполнение
            self.known_executions.add(execution_id)
            self.execution_states[execution_id] = execution.status
            
            # Создаем событие начала выполнения
            event = ExecutionEvent(
                id=f"start_{execution_id}",
                event_type=EventType.EXECUTION_STARTED,
                severity=Severity.INFO,
                workflow_id=execution.workflow_id,
                execution_id=execution_id,
                timestamp=execution.started_at or datetime.now()
            )
            
            await self._add_event(event)
            self.stats.total_executions += 1
        
        # Проверяем изменение статуса
        old_status = self.execution_states.get(execution_id)
        if old_status != execution.status:
            self.execution_states[execution_id] = execution.status
            
            if execution.finished:
                await self._handle_execution_completion(execution)
    
    async def _handle_execution_completion(self, execution: ExecutionInfo):
        """Обрабатывает завершение выполнения"""
        execution_id = execution.id
        
        # Определяем тип события
        if execution.status == "success":
            event_type = EventType.EXECUTION_COMPLETED
            severity = Severity.INFO
            self.stats.successful_executions += 1
            
            # Записываем время выполнения для anomaly detection
            if execution.execution_time:
                self.execution_times.append(execution.execution_time)
        
        else:
            event_type = EventType.EXECUTION_FAILED
            severity = Severity.ERROR
            self.stats.failed_executions += 1
            
            # Увеличиваем счетчик ошибок
            self.error_counts[execution.status] += 1
        
        # Создаем событие завершения
        event = ExecutionEvent(
            id=f"complete_{execution_id}",
            event_type=event_type,
            severity=severity,
            workflow_id=execution.workflow_id,
            execution_id=execution_id,
            timestamp=execution.stopped_at or datetime.now(),
            duration=execution.execution_time
        )
        
        # Получаем ошибки если есть
        if execution.status != "success":
            errors = await self.connector.get_execution_errors(execution_id)
            if errors:
                # Берем первую ошибку для основного события
                first_error = errors[0]
                event.error_type = first_error.get("error", {}).get("type", "unknown")
                event.error_message = first_error.get("error", {}).get("message", "Unknown error")
                event.node_name = first_error.get("node")
                
                # Создаем отдельные события для каждой ошибки ноды
                for error in errors:
                    node_event = ExecutionEvent(
                        id=f"node_error_{execution_id}_{error['node']}",
                        event_type=EventType.NODE_ERROR,
                        severity=Severity.ERROR,
                        workflow_id=execution.workflow_id,
                        execution_id=execution_id,
                        timestamp=datetime.now(),
                        error_type=error.get("error", {}).get("type", "unknown"),
                        error_message=error.get("error", {}).get("message", "Unknown error"),
                        node_name=error.get("node")
                    )
                    await self._add_event(node_event)
        
        await self._add_event(event)
        
        # Обновляем статистику
        self._update_stats()
    
    async def _add_event(self, event: ExecutionEvent):
        """Добавляет событие в очередь"""
        self.recent_events.append(event)
        
        # Логируем важные события
        if event.severity in [Severity.ERROR, Severity.CRITICAL]:
            logger.warning(f"⚠️ {event.event_type.value}: {event.error_message or 'No details'}")
        elif event.event_type == EventType.EXECUTION_COMPLETED:
            logger.debug(f"✅ Execution completed: {event.execution_id}")
    
    def _update_stats(self):
        """Обновляет статистику"""
        # Обновляем процент ошибок
        self.stats.update_success_rate()
        
        # Обновляем среднее время выполнения
        if self.execution_times:
            self.stats.average_execution_time = statistics.mean(self.execution_times)
        
        self.stats.last_updated = datetime.now()
    
    async def _anomaly_detection_loop(self):
        """Цикл обнаружения аномалий"""
        logger.info("🔍 Starting anomaly detection...")
        
        while self.is_running:
            try:
                await self._detect_anomalies()
                await asyncio.sleep(60)  # Проверяем каждую минуту
                
            except Exception as e:
                logger.error(f"❌ Anomaly detection error: {e}")
                await asyncio.sleep(60)
    
    async def _detect_anomalies(self):
        """Обнаруживает аномалии в системе"""
        anomalies = []
        
        # 1. Аномалии времени выполнения
        if len(self.execution_times) >= 10:
            avg_time = statistics.mean(self.execution_times)
            recent_times = list(self.execution_times)[-5:]  # Последние 5 выполнений
            
            for exec_time in recent_times:
                if exec_time > avg_time * self.anomaly_thresholds["execution_time_multiplier"]:
                    anomaly = AnomalyAlert(
                        id=f"slow_execution_{int(time.time())}",
                        anomaly_type="slow_execution",
                        description=f"Execution time {exec_time:.1f}s exceeds average {avg_time:.1f}s by {self.anomaly_thresholds['execution_time_multiplier']}x",
                        severity=Severity.WARNING,
                        detected_at=datetime.now(),
                        threshold_value=avg_time * self.anomaly_thresholds["execution_time_multiplier"],
                        actual_value=exec_time
                    )
                    anomalies.append(anomaly)
        
        # 2. Аномалии частоты ошибок
        if self.stats.total_executions >= 10:
            if self.stats.error_rate > self.anomaly_thresholds["error_rate_threshold"]:
                anomaly = AnomalyAlert(
                    id=f"high_error_rate_{int(time.time())}",
                    anomaly_type="high_error_rate",
                    description=f"Error rate {self.stats.error_rate:.1%} exceeds threshold {self.anomaly_thresholds['error_rate_threshold']:.1%}",
                    severity=Severity.ERROR,
                    detected_at=datetime.now(),
                    threshold_value=self.anomaly_thresholds["error_rate_threshold"],
                    actual_value=self.stats.error_rate
                )
                anomalies.append(anomaly)
        
        # 3. Последовательные неудачи
        recent_events = list(self.recent_events)[-self.anomaly_thresholds["consecutive_failures"]:]
        if len(recent_events) == self.anomaly_thresholds["consecutive_failures"]:
            if all(event.event_type == EventType.EXECUTION_FAILED for event in recent_events):
                anomaly = AnomalyAlert(
                    id=f"consecutive_failures_{int(time.time())}",
                    anomaly_type="consecutive_failures",
                    description=f"{self.anomaly_thresholds['consecutive_failures']} consecutive execution failures detected",
                    severity=Severity.CRITICAL,
                    detected_at=datetime.now(),
                    threshold_value=self.anomaly_thresholds["consecutive_failures"],
                    actual_value=self.anomaly_thresholds["consecutive_failures"]
                )
                anomalies.append(anomaly)
        
        # Создаем события для аномалий
        for anomaly in anomalies:
            event = ExecutionEvent(
                id=anomaly.id,
                event_type=EventType.SYSTEM_ANOMALY,
                severity=anomaly.severity,
                workflow_id="system",
                execution_id=None,
                timestamp=anomaly.detected_at,
                error_type=anomaly.anomaly_type,
                error_message=anomaly.description,
                metadata={"anomaly": anomaly}
            )
            await self._add_event(event)
            
            logger.warning(f"🚨 Anomaly detected: {anomaly.description}")
    
    async def _start_webhook_server(self):
        """Запускает webhook server для push-уведомлений"""
        try:
            from aiohttp import web
            
            app = web.Application()
            app.router.add_post('/webhook/execution', self._handle_webhook)
            app.router.add_get('/webhook/health', self._webhook_health)
            
            runner = web.AppRunner(app)
            await runner.setup()
            
            site = web.TCPSite(runner, '0.0.0.0', self.webhook_port)
            await site.start()
            
            self.webhook_server = runner
            logger.info(f"🌐 Webhook server started on port {self.webhook_port}")
            
            # Держим сервер запущенным
            while self.is_running:
                await asyncio.sleep(1)
                
        except Exception as e:
            logger.error(f"❌ Webhook server error: {e}")
    
    async def _handle_webhook(self, request):
        """Обрабатывает webhook уведомления"""
        try:
            data = await request.json()
            
            # Создаем событие из webhook данных
            event = ExecutionEvent(
                id=f"webhook_{data.get('executionId', 'unknown')}_{int(time.time())}",
                event_type=EventType(data.get('eventType', 'execution_completed')),
                severity=Severity(data.get('severity', 'info')),
                workflow_id=data.get('workflowId', 'unknown'),
                execution_id=data.get('executionId'),
                timestamp=datetime.now(),
                error_type=data.get('errorType'),
                error_message=data.get('errorMessage'),
                node_name=data.get('nodeName'),
                duration=data.get('duration')
            )
            
            await self._add_event(event)
            
            return web.json_response({"status": "ok"})
            
        except Exception as e:
            logger.error(f"❌ Webhook handling error: {e}")
            return web.json_response({"error": str(e)}, status=400)
    
    async def _webhook_health(self, request):
        """Health check для webhook сервера"""
        return web.json_response({
            "status": "healthy",
            "uptime": str(datetime.now() - self.last_poll_time),
            "events_processed": len(self.recent_events)
        })
    
    async def get_recent_events(self, limit: int = 50, event_types: List[EventType] = None) -> List[ExecutionEvent]:
        """Получает последние события"""
        events = list(self.recent_events)
        
        # Фильтруем по типам если указано
        if event_types:
            events = [e for e in events if e.event_type in event_types]
        
        # Сортируем по времени (новые первые)
        events.sort(key=lambda x: x.timestamp, reverse=True)
        
        return events[:limit]
    
    async def get_events_by_workflow(self, workflow_id: str, limit: int = 50) -> List[ExecutionEvent]:
        """Получает события для конкретного workflow"""
        events = [e for e in self.recent_events if e.workflow_id == workflow_id]
        events.sort(key=lambda x: x.timestamp, reverse=True)
        return events[:limit]
    
    async def get_error_events(self, limit: int = 50) -> List[ExecutionEvent]:
        """Получает события с ошибками"""
        error_types = [EventType.EXECUTION_FAILED, EventType.NODE_ERROR, EventType.EXECUTION_TIMEOUT]
        return await self.get_recent_events(limit, error_types)
    
    def get_stats(self) -> MonitoringStats:
        """Возвращает статистику мониторинга"""
        return self.stats
    
    def get_anomaly_thresholds(self) -> Dict[str, float]:
        """Возвращает пороги для anomaly detection"""
        return self.anomaly_thresholds.copy()
    
    def update_anomaly_thresholds(self, thresholds: Dict[str, float]):
        """Обновляет пороги для anomaly detection"""
        self.anomaly_thresholds.update(thresholds)
        logger.info(f"🔧 Updated anomaly thresholds: {thresholds}")
    
    async def force_poll(self):
        """Принудительно выполняет polling"""
        logger.info("🔄 Force polling executions...")
        await self._poll_executions()
    
    def clear_events(self):
        """Очищает события (для тестирования)"""
        self.recent_events.clear()
        logger.info("🗑️ Events cleared")

# Утилитарные функции

async def create_test_monitor() -> ExecutionMonitor:
    """Создает тестовый монитор для проверки"""
    from connector import N8NConnector
    
    connector = N8NConnector()
    await connector.connect()
    
    monitor = ExecutionMonitor(connector, poll_interval=5)
    return monitor

async def monitor_workflow_execution(workflow_id: str, timeout: int = 300) -> List[ExecutionEvent]:
    """Мониторит выполнение конкретного workflow"""
    monitor = await create_test_monitor()
    
    start_time = time.time()
    events = []
    
    try:
        # Запускаем мониторинг в фоне
        monitor_task = asyncio.create_task(monitor.start())
        
        # Ждем события или timeout
        while time.time() - start_time < timeout:
            workflow_events = await monitor.get_events_by_workflow(workflow_id)
            
            # Проверяем на завершение
            for event in workflow_events:
                if event.event_type in [EventType.EXECUTION_COMPLETED, EventType.EXECUTION_FAILED]:
                    events = workflow_events
                    break
            
            if events:
                break
            
            await asyncio.sleep(1)
        
        # Останавливаем мониторинг
        await monitor.stop()
        monitor_task.cancel()
        
        return events
        
    except Exception as e:
        logger.error(f"❌ Monitoring error: {e}")
        return []

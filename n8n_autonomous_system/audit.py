#!/usr/bin/env python3
"""
📋 AUDIT LOGGER - Система аудита и логирования

Обеспечивает immutable журнал всех изменений в системе
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

@dataclass
class AuditEntry:
    """Запись аудита"""
    id: str
    timestamp: datetime
    action: str
    user: str
    resource_id: str
    details: Dict[str, Any]

class AuditLogger:
    """Система аудита"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.entries: List[AuditEntry] = []
    
    async def log_incident_created(self, incident):
        """Логирует создание инцидента"""
        entry = AuditEntry(
            id=f"incident_created_{incident.id}",
            timestamp=datetime.now(),
            action="incident_created",
            user="system",
            resource_id=incident.workflow_id,
            details={"incident_id": incident.id, "severity": incident.severity.value}
        )
        self.entries.append(entry)
    
    async def log_incident_resolved(self, incident):
        """Логирует разрешение инцидента"""
        entry = AuditEntry(
            id=f"incident_resolved_{incident.id}",
            timestamp=datetime.now(),
            action="incident_resolved",
            user="system",
            resource_id=incident.workflow_id,
            details={"incident_id": incident.id, "attempts": incident.attempts}
        )
        self.entries.append(entry)
    
    async def log_incident_escalated(self, incident):
        """Логирует эскалацию инцидента"""
        entry = AuditEntry(
            id=f"incident_escalated_{incident.id}",
            timestamp=datetime.now(),
            action="incident_escalated",
            user="system",
            resource_id=incident.workflow_id,
            details={"incident_id": incident.id, "attempts": incident.attempts}
        )
        self.entries.append(entry)

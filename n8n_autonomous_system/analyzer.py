#!/usr/bin/env python3
"""
🧠 ERROR ANALYZER - Интеллектуальный анализатор ошибок N8N

Этот модуль обеспечивает интеллектуальный анализ ошибок и предложение решений:
- Классификация ошибок по типам и причинам
- Machine learning для улучшения точности
- Confidence scoring для оценки уверенности
- Repair strategies для автоматического исправления

Автор: AI Assistant
Дата: 2025-10-02
Версия: 1.0
"""

import json
import logging
import re
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import statistics
from collections import defaultdict, Counter

logger = logging.getLogger(__name__)

class ErrorCategory(Enum):
    """Категории ошибок"""
    AUTHENTICATION = "authentication"
    NETWORK = "network"
    EXTERNAL_API = "external_api"
    MAPPING = "mapping"
    VALIDATION = "validation"
    INTERNAL = "internal"
    TIMEOUT = "timeout"
    CREDENTIALS = "credentials"
    CONFIGURATION = "configuration"
    RESOURCE = "resource"
    UNKNOWN = "unknown"

class FixType(Enum):
    """Типы исправлений"""
    ADD_PARAMETER = "add_parameter"
    UPDATE_PARAMETER = "update_parameter"
    FIX_CREDENTIALS = "fix_credentials"
    ADD_RETRY = "add_retry"
    INCREASE_TIMEOUT = "increase_timeout"
    ADD_VALIDATION = "add_validation"
    REPLACE_NODE = "replace_node"
    ADD_ERROR_HANDLING = "add_error_handling"
    UPDATE_MAPPING = "update_mapping"
    ADD_CIRCUIT_BREAKER = "add_circuit_breaker"

@dataclass
class ErrorPattern:
    """Паттерн ошибки для распознавания"""
    category: ErrorCategory
    keywords: List[str]
    regex_patterns: List[str]
    node_types: List[str] = field(default_factory=list)
    confidence_boost: float = 0.0
    
@dataclass
class RepairStrategy:
    """Стратегия исправления"""
    fix_type: FixType
    description: str
    confidence_threshold: float
    parameters: Dict[str, Any] = field(default_factory=dict)
    prerequisites: List[str] = field(default_factory=list)
    risk_level: str = "low"  # low, medium, high

@dataclass
class ErrorAnalysis:
    """Результат анализа ошибки"""
    error_id: str
    category: ErrorCategory
    confidence: float
    description: str
    suggested_fix: RepairStrategy
    alternative_fixes: List[RepairStrategy] = field(default_factory=list)
    root_cause: Optional[str] = None
    affected_nodes: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    analyzed_at: datetime = field(default_factory=datetime.now)

class ErrorAnalyzer:
    """
    Интеллектуальный анализатор ошибок
    
    Анализирует ошибки N8N workflow'ов и предлагает автоматические исправления:
    - Классификация по категориям
    - Оценка уверенности
    - Предложение стратегий исправления
    - Обучение на исторических данных
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """Инициализация анализатора"""
        self.config = config or {}
        
        # Паттерны ошибок
        self.error_patterns = self._initialize_error_patterns()
        
        # Стратегии исправления
        self.repair_strategies = self._initialize_repair_strategies()
        
        # История анализов для обучения
        self.analysis_history: List[ErrorAnalysis] = []
        self.success_rates: Dict[str, List[bool]] = defaultdict(list)
        
        # Кэш для часто встречающихся ошибок
        self.error_cache: Dict[str, ErrorAnalysis] = {}
        
        logger.info("🧠 Error Analyzer initialized")
    
    def _initialize_error_patterns(self) -> List[ErrorPattern]:
        """Инициализирует паттерны ошибок"""
        patterns = [
            # Authentication/Credentials ошибки
            ErrorPattern(
                category=ErrorCategory.AUTHENTICATION,
                keywords=["unauthorized", "authentication", "invalid token", "access denied", "401", "403"],
                regex_patterns=[
                    r"authentication.*failed",
                    r"invalid.*token",
                    r"access.*denied",
                    r"unauthorized.*request"
                ],
                node_types=["@n8n/n8n-nodes-langchain.lmChatOpenRouter", "n8n-nodes-base.httpRequest"],
                confidence_boost=0.2
            ),
            
            # Network/Timeout ошибки
            ErrorPattern(
                category=ErrorCategory.NETWORK,
                keywords=["timeout", "connection", "network", "ECONNREFUSED", "ETIMEDOUT", "DNS"],
                regex_patterns=[
                    r"connection.*timeout",
                    r"network.*error",
                    r"ECONNREFUSED",
                    r"ETIMEDOUT",
                    r"getaddrinfo.*ENOTFOUND"
                ],
                node_types=["n8n-nodes-base.httpRequest"],
                confidence_boost=0.15
            ),
            
            # External API ошибки
            ErrorPattern(
                category=ErrorCategory.EXTERNAL_API,
                keywords=["500", "502", "503", "504", "rate limit", "quota", "API error"],
                regex_patterns=[
                    r"HTTP.*5\d{2}",
                    r"rate.*limit.*exceeded",
                    r"quota.*exceeded",
                    r"API.*error"
                ],
                node_types=["n8n-nodes-base.httpRequest", "@n8n/n8n-nodes-langchain.lmChatOpenRouter"],
                confidence_boost=0.1
            ),
            
            # Mapping/Validation ошибки
            ErrorPattern(
                category=ErrorCategory.MAPPING,
                keywords=["undefined", "null", "missing property", "cannot read", "path not found"],
                regex_patterns=[
                    r"cannot.*read.*property",
                    r"undefined.*is.*not.*a.*function",
                    r"path.*not.*found",
                    r"missing.*required.*field"
                ],
                node_types=["n8n-nodes-base.set", "n8n-nodes-base.code"],
                confidence_boost=0.25
            ),
            
            # Session ID ошибки (специфично для N8N AI нодов)
            ErrorPattern(
                category=ErrorCategory.CONFIGURATION,
                keywords=["session", "sessionId", "no session"],
                regex_patterns=[
                    r"session.*id.*required",
                    r"no.*session.*found",
                    r"session.*not.*provided"
                ],
                node_types=["@n8n/n8n-nodes-langchain.memoryBufferWindow"],
                confidence_boost=0.3
            ),
            
            # Credentials ошибки
            ErrorPattern(
                category=ErrorCategory.CREDENTIALS,
                keywords=["credential", "api key", "token", "secret"],
                regex_patterns=[
                    r"credential.*not.*found",
                    r"invalid.*api.*key",
                    r"missing.*credentials"
                ],
                node_types=["@n8n/n8n-nodes-langchain.lmChatOpenRouter", "n8n-nodes-base.googleDrive"],
                confidence_boost=0.2
            ),
            
            # Internal/Code ошибки
            ErrorPattern(
                category=ErrorCategory.INTERNAL,
                keywords=["syntax error", "reference error", "type error", "function not defined"],
                regex_patterns=[
                    r"SyntaxError",
                    r"ReferenceError",
                    r"TypeError",
                    r"function.*not.*defined"
                ],
                node_types=["n8n-nodes-base.code", "n8n-nodes-base.function"],
                confidence_boost=0.15
            )
        ]
        
        return patterns
    
    def _initialize_repair_strategies(self) -> Dict[ErrorCategory, List[RepairStrategy]]:
        """Инициализирует стратегии исправления"""
        strategies = {
            ErrorCategory.AUTHENTICATION: [
                RepairStrategy(
                    fix_type=FixType.FIX_CREDENTIALS,
                    description="Update or refresh authentication credentials",
                    confidence_threshold=0.8,
                    parameters={"credential_type": "openRouterApi", "credential_id": "dctACn3yXSG7qIdH"},
                    risk_level="low"
                )
            ],
            
            ErrorCategory.NETWORK: [
                RepairStrategy(
                    fix_type=FixType.INCREASE_TIMEOUT,
                    description="Increase request timeout",
                    confidence_threshold=0.7,
                    parameters={"timeout": 60000, "field": "options.timeout"},
                    risk_level="low"
                ),
                RepairStrategy(
                    fix_type=FixType.ADD_RETRY,
                    description="Add retry mechanism with exponential backoff",
                    confidence_threshold=0.6,
                    parameters={"max_retries": 3, "backoff_factor": 2},
                    risk_level="low"
                )
            ],
            
            ErrorCategory.EXTERNAL_API: [
                RepairStrategy(
                    fix_type=FixType.ADD_CIRCUIT_BREAKER,
                    description="Add circuit breaker pattern",
                    confidence_threshold=0.6,
                    parameters={"failure_threshold": 5, "recovery_timeout": 60},
                    risk_level="medium"
                ),
                RepairStrategy(
                    fix_type=FixType.ADD_RETRY,
                    description="Add retry with exponential backoff for API calls",
                    confidence_threshold=0.8,
                    parameters={"max_retries": 3, "backoff_factor": 2, "status_codes": [500, 502, 503, 504]},
                    risk_level="low"
                )
            ],
            
            ErrorCategory.MAPPING: [
                RepairStrategy(
                    fix_type=FixType.ADD_VALIDATION,
                    description="Add input validation and default values",
                    confidence_threshold=0.7,
                    parameters={"add_null_checks": True, "provide_defaults": True},
                    risk_level="low"
                ),
                RepairStrategy(
                    fix_type=FixType.UPDATE_MAPPING,
                    description="Fix field mapping paths",
                    confidence_threshold=0.8,
                    parameters={"fix_paths": True, "add_fallbacks": True},
                    risk_level="low"
                )
            ],
            
            ErrorCategory.CONFIGURATION: [
                RepairStrategy(
                    fix_type=FixType.ADD_PARAMETER,
                    description="Add missing sessionId parameter",
                    confidence_threshold=0.9,
                    parameters={"parameter": "sessionIdExpression", "value": "={{ $workflow.executionId }}"},
                    risk_level="low"
                )
            ],
            
            ErrorCategory.CREDENTIALS: [
                RepairStrategy(
                    fix_type=FixType.FIX_CREDENTIALS,
                    description="Add or update missing credentials",
                    confidence_threshold=0.8,
                    parameters={"auto_detect_type": True},
                    risk_level="low"
                )
            ],
            
            ErrorCategory.INTERNAL: [
                RepairStrategy(
                    fix_type=FixType.ADD_ERROR_HANDLING,
                    description="Add try-catch error handling",
                    confidence_threshold=0.6,
                    parameters={"wrap_in_try_catch": True, "provide_fallback": True},
                    risk_level="medium"
                ),
                RepairStrategy(
                    fix_type=FixType.REPLACE_NODE,
                    description="Replace with simpler alternative node",
                    confidence_threshold=0.4,
                    parameters={"replacement_type": "n8n-nodes-base.set"},
                    risk_level="high"
                )
            ]
        }
        
        return strategies
    
    async def analyze_error(self, workflow_id: str, error_type: str, error_message: str, 
                          node_name: str = None, execution_id: str = None) -> ErrorAnalysis:
        """
        Анализирует ошибку и предлагает исправления
        
        Args:
            workflow_id: ID workflow'а
            error_type: Тип ошибки
            error_message: Сообщение об ошибке
            node_name: Имя ноды (опционально)
            execution_id: ID выполнения (опционально)
        
        Returns:
            Результат анализа с предложенными исправлениями
        """
        error_id = f"{workflow_id}_{error_type}_{hash(error_message) % 10000}"
        
        # Проверяем кэш
        if error_id in self.error_cache:
            cached_analysis = self.error_cache[error_id]
            logger.debug(f"📋 Using cached analysis for error {error_id}")
            return cached_analysis
        
        logger.info(f"🧠 Analyzing error: {error_type} in workflow {workflow_id}")
        
        # 1. Классификация ошибки
        category, confidence = self._classify_error(error_message, error_type, node_name)
        
        # 2. Определение root cause
        root_cause = self._determine_root_cause(error_message, category)
        
        # 3. Поиск подходящих стратегий исправления
        repair_strategies = self._find_repair_strategies(category, error_message, node_name)
        
        # 4. Выбор лучшей стратегии
        best_strategy = self._select_best_strategy(repair_strategies, confidence)
        
        # 5. Создание анализа
        analysis = ErrorAnalysis(
            error_id=error_id,
            category=category,
            confidence=confidence,
            description=f"{category.value.title()} error: {root_cause or error_message[:100]}",
            suggested_fix=best_strategy,
            alternative_fixes=repair_strategies[1:] if len(repair_strategies) > 1 else [],
            root_cause=root_cause,
            affected_nodes=[node_name] if node_name else [],
            metadata={
                "workflow_id": workflow_id,
                "execution_id": execution_id,
                "original_error": error_message,
                "error_type": error_type
            }
        )
        
        # Сохраняем в кэш и историю
        self.error_cache[error_id] = analysis
        self.analysis_history.append(analysis)
        
        # Ограничиваем размер истории
        if len(self.analysis_history) > 1000:
            self.analysis_history = self.analysis_history[-1000:]
        
        logger.info(f"✅ Analysis completed: {category.value} (confidence: {confidence:.2f})")
        
        return analysis
    
    def _classify_error(self, error_message: str, error_type: str, node_name: str = None) -> Tuple[ErrorCategory, float]:
        """Классифицирует ошибку по категориям"""
        error_text = f"{error_message} {error_type}".lower()
        
        category_scores = defaultdict(float)
        
        # Проверяем каждый паттерн
        for pattern in self.error_patterns:
            score = 0.0
            
            # Проверка ключевых слов
            keyword_matches = sum(1 for keyword in pattern.keywords if keyword.lower() in error_text)
            if keyword_matches > 0:
                score += (keyword_matches / len(pattern.keywords)) * 0.4
            
            # Проверка regex паттернов
            regex_matches = sum(1 for regex in pattern.regex_patterns if re.search(regex, error_text, re.IGNORECASE))
            if regex_matches > 0:
                score += (regex_matches / len(pattern.regex_patterns)) * 0.4
            
            # Проверка типа ноды
            if node_name and pattern.node_types:
                node_type_matches = sum(1 for node_type in pattern.node_types if node_type in (node_name or ""))
                if node_type_matches > 0:
                    score += 0.2
            
            # Бонус за уверенность
            score += pattern.confidence_boost
            
            if score > 0:
                category_scores[pattern.category] += score
        
        # Выбираем категорию с наивысшим счетом
        if category_scores:
            best_category = max(category_scores.items(), key=lambda x: x[1])
            return best_category[0], min(best_category[1], 1.0)
        else:
            return ErrorCategory.UNKNOWN, 0.1
    
    def _determine_root_cause(self, error_message: str, category: ErrorCategory) -> Optional[str]:
        """Определяет корневую причину ошибки"""
        root_causes = {
            ErrorCategory.AUTHENTICATION: "Invalid or expired authentication credentials",
            ErrorCategory.NETWORK: "Network connectivity or timeout issues",
            ErrorCategory.EXTERNAL_API: "External service unavailable or rate limited",
            ErrorCategory.MAPPING: "Incorrect data mapping or missing fields",
            ErrorCategory.CONFIGURATION: "Missing or incorrect configuration parameters",
            ErrorCategory.CREDENTIALS: "Missing or invalid API credentials",
            ErrorCategory.INTERNAL: "Internal code or logic error"
        }
        
        return root_causes.get(category)
    
    def _find_repair_strategies(self, category: ErrorCategory, error_message: str, node_name: str = None) -> List[RepairStrategy]:
        """Находит подходящие стратегии исправления"""
        strategies = self.repair_strategies.get(category, [])
        
        # Фильтруем стратегии по применимости
        applicable_strategies = []
        
        for strategy in strategies:
            # Проверяем prerequisites
            if strategy.prerequisites:
                # Здесь можно добавить логику проверки предварительных условий
                pass
            
            # Адаптируем параметры под конкретную ошибку
            adapted_strategy = self._adapt_strategy(strategy, error_message, node_name)
            applicable_strategies.append(adapted_strategy)
        
        # Сортируем по confidence threshold (более уверенные первые)
        applicable_strategies.sort(key=lambda x: x.confidence_threshold, reverse=True)
        
        return applicable_strategies
    
    def _adapt_strategy(self, strategy: RepairStrategy, error_message: str, node_name: str = None) -> RepairStrategy:
        """Адаптирует стратегию под конкретную ошибку"""
        # Создаем копию стратегии
        adapted = RepairStrategy(
            fix_type=strategy.fix_type,
            description=strategy.description,
            confidence_threshold=strategy.confidence_threshold,
            parameters=strategy.parameters.copy(),
            prerequisites=strategy.prerequisites.copy(),
            risk_level=strategy.risk_level
        )
        
        # Адаптируем параметры
        if strategy.fix_type == FixType.FIX_CREDENTIALS:
            # Определяем тип credentials по ноде
            if node_name and "openrouter" in node_name.lower():
                adapted.parameters["credential_type"] = "openRouterApi"
                adapted.parameters["credential_id"] = "dctACn3yXSG7qIdH"
            elif node_name and "google" in node_name.lower():
                adapted.parameters["credential_type"] = "googleDriveOAuth2Api"
                adapted.parameters["credential_id"] = "XDM9FIbDJMpu7nGH"
        
        elif strategy.fix_type == FixType.UPDATE_MAPPING:
            # Пытаемся извлечь проблемное поле из ошибки
            field_match = re.search(r"property '(\w+)'", error_message)
            if field_match:
                adapted.parameters["problematic_field"] = field_match.group(1)
        
        elif strategy.fix_type == FixType.INCREASE_TIMEOUT:
            # Адаптируем timeout в зависимости от типа ошибки
            if "timeout" in error_message.lower():
                current_timeout = self._extract_timeout_from_error(error_message)
                if current_timeout:
                    adapted.parameters["timeout"] = current_timeout * 2
        
        return adapted
    
    def _extract_timeout_from_error(self, error_message: str) -> Optional[int]:
        """Извлекает текущий timeout из сообщения об ошибке"""
        timeout_match = re.search(r"timeout.*?(\d+)", error_message, re.IGNORECASE)
        if timeout_match:
            return int(timeout_match.group(1))
        return None
    
    def _select_best_strategy(self, strategies: List[RepairStrategy], error_confidence: float) -> RepairStrategy:
        """Выбирает лучшую стратегию исправления"""
        if not strategies:
            # Fallback стратегия
            return RepairStrategy(
                fix_type=FixType.ADD_ERROR_HANDLING,
                description="Add generic error handling",
                confidence_threshold=0.3,
                risk_level="medium"
            )
        
        # Выбираем стратегию с учетом confidence и исторических данных
        best_strategy = strategies[0]
        
        for strategy in strategies:
            # Проверяем историческую успешность
            strategy_key = f"{strategy.fix_type.value}"
            if strategy_key in self.success_rates:
                success_rate = statistics.mean(self.success_rates[strategy_key])
                # Корректируем confidence threshold на основе успешности
                adjusted_threshold = strategy.confidence_threshold * (1 - success_rate * 0.2)
                
                if error_confidence >= adjusted_threshold:
                    best_strategy = strategy
                    break
        
        return best_strategy
    
    def record_fix_result(self, error_id: str, fix_type: FixType, success: bool):
        """Записывает результат применения исправления для обучения"""
        strategy_key = fix_type.value
        self.success_rates[strategy_key].append(success)
        
        # Ограничиваем размер истории
        if len(self.success_rates[strategy_key]) > 100:
            self.success_rates[strategy_key] = self.success_rates[strategy_key][-100:]
        
        logger.debug(f"📊 Recorded fix result: {fix_type.value} = {'success' if success else 'failure'}")
    
    def get_error_statistics(self) -> Dict[str, Any]:
        """Возвращает статистику анализа ошибок"""
        if not self.analysis_history:
            return {"total_analyses": 0}
        
        # Подсчет по категориям
        category_counts = Counter(analysis.category for analysis in self.analysis_history)
        
        # Средняя уверенность
        avg_confidence = statistics.mean(analysis.confidence for analysis in self.analysis_history)
        
        # Успешность исправлений
        fix_success_rates = {}
        for fix_type, results in self.success_rates.items():
            if results:
                fix_success_rates[fix_type] = statistics.mean(results)
        
        return {
            "total_analyses": len(self.analysis_history),
            "category_distribution": dict(category_counts),
            "average_confidence": avg_confidence,
            "fix_success_rates": fix_success_rates,
            "cache_size": len(self.error_cache)
        }
    
    def clear_cache(self):
        """Очищает кэш анализов"""
        self.error_cache.clear()
        logger.info("🗑️ Error analysis cache cleared")
    
    def export_patterns(self) -> Dict[str, Any]:
        """Экспортирует паттерны ошибок для внешнего использования"""
        patterns_data = []
        
        for pattern in self.error_patterns:
            patterns_data.append({
                "category": pattern.category.value,
                "keywords": pattern.keywords,
                "regex_patterns": pattern.regex_patterns,
                "node_types": pattern.node_types,
                "confidence_boost": pattern.confidence_boost
            })
        
        return {
            "patterns": patterns_data,
            "exported_at": datetime.now().isoformat()
        }
    
    def import_patterns(self, patterns_data: Dict[str, Any]):
        """Импортирует паттерны ошибок"""
        try:
            new_patterns = []
            
            for pattern_data in patterns_data.get("patterns", []):
                pattern = ErrorPattern(
                    category=ErrorCategory(pattern_data["category"]),
                    keywords=pattern_data["keywords"],
                    regex_patterns=pattern_data["regex_patterns"],
                    node_types=pattern_data.get("node_types", []),
                    confidence_boost=pattern_data.get("confidence_boost", 0.0)
                )
                new_patterns.append(pattern)
            
            self.error_patterns.extend(new_patterns)
            logger.info(f"📥 Imported {len(new_patterns)} error patterns")
            
        except Exception as e:
            logger.error(f"❌ Failed to import patterns: {e}")

# Утилитарные функции

def create_test_analyzer() -> ErrorAnalyzer:
    """Создает тестовый анализатор"""
    config = {
        "confidence_threshold": 0.7,
        "enable_learning": True
    }
    
    return ErrorAnalyzer(config)

async def analyze_common_n8n_errors():
    """Анализирует типичные ошибки N8N"""
    analyzer = create_test_analyzer()
    
    # Тестовые ошибки
    test_errors = [
        ("auth_error", "Authentication failed: Invalid API token", "OpenRouter Chat Model"),
        ("session_error", "Session ID is required but not provided", "Simple Memory"),
        ("network_error", "ECONNREFUSED: Connection refused", "HTTP Request"),
        ("mapping_error", "Cannot read property 'data' of undefined", "Set Node"),
        ("timeout_error", "Request timeout after 30000ms", "HTTP Request")
    ]
    
    results = []
    
    for error_type, error_message, node_name in test_errors:
        analysis = await analyzer.analyze_error(
            workflow_id="test_workflow",
            error_type=error_type,
            error_message=error_message,
            node_name=node_name
        )
        results.append(analysis)
        
        print(f"🔍 {error_type}:")
        print(f"  Category: {analysis.category.value}")
        print(f"  Confidence: {analysis.confidence:.2f}")
        print(f"  Suggested fix: {analysis.suggested_fix.description}")
        print()
    
    return results

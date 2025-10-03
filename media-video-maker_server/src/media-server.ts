import express from "express";
import MediaCreator from "./pipeline/MediaCreator.js";
import { PlanInputSchema } from "./types/plan.js";
import { log } from "./logger.js";
import { getFontInfo, diagnoseAllFonts } from "./utils/FontResolver.js";
import { checkOutputDir } from "./utils/OutputDir.js";
import { execa } from "execa";

const app = express();
const media = new MediaCreator();

// Базовые настройки
app.use(express.json({ limit: "50mb" }));
// Middleware для обработки text/plain (CORS fix)
app.use(express.text({ type: 'text/plain' }));
app.set("trust proxy", true);

// Разрешаем CORS для разработки
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Endpoint для приема результатов от Gemini Video Analyzer
app.post("/api/gemini-results", (req, res) => {
  try {
    // Обработка как text/plain (CORS fix)
    let requestData;
    if (req.headers['content-type'] === 'text/plain') {
      requestData = JSON.parse(req.body);
    } else {
      requestData = req.body;
    }
    
    const { video_id, analysis, timestamp } = requestData;
    
    log.info(`📊 Received Gemini analysis for video ${video_id}:`, analysis);
    
    // Сохранить результат анализа
    const fs = require('fs');
    const path = require('path');
    const resultPath = path.join(process.env.OUTPUT_DIR || './output', `gemini_analysis_${video_id}.json`);
    
    fs.writeFileSync(resultPath, JSON.stringify({
      video_id,
      analysis,
      timestamp,
      received_at: new Date().toISOString()
    }, null, 2));
    
    log.info(`💾 Analysis saved to: ${resultPath}`);
    
    res.json({ 
      status: 'received', 
      video_id,
      timestamp: new Date().toISOString(),
      message: 'Анализ успешно получен и сохранен!'
    });
  } catch (error) {
    log.error('❌ Error processing Gemini results:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Ошибка обработки результатов анализа'
    });
  }
});

// Проверка работоспособности
app.get("/api/ping", (_req, res) => {
  res.json({ 
    status: "ok",
    version: "2.1-main",
    service: "media-video-maker",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    node: process.version,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: "MB"
    },
    endpoints: {
      capabilities: "/api/capabilities",
      createVideo: "POST /api/create-video", 
      status: "GET /api/status/:id",
      jobs: "GET /api/jobs",
      health: "/health"
    },
    message: "🎬 Media Video Maker API работает отлично!"
  });
});

// Получение информации о поддерживаемых форматах и параметрах
app.get("/api/capabilities", async (_req, res) => {
  try {
    // Базовые возможности
    const capabilities: any = {
      version: "2.1-main",
      supportedFormats: {
        input: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "avi", "mkv"],
        output: ["mp4", "mov"]
      },
      tts: {
        providers: ["kokoro", "openai", "none"],
        kokoro_endpoint: "http://178.156.142.35:11402/v1/tts",
        voices: ["en-US-Standard-A", "en-US-Wavenet-A", "alloy", "echo", "fable", "onyx", "nova", "shimmer"],
        models: ["gpt-4o-mini-tts", "tts-1", "tts-1-hd"],
        formats: ["mp3", "wav"]
      },
      effects: {
        zoom: { enabled: true, description: "Плавное масштабирование с центром" },
        vhs: { enabled: true, description: "Винтажный VHS эффект" },
        retro: { enabled: true, description: "Ретро стилизация" },
        custom: { enabled: true, description: "Произвольные FFmpeg фильтры" }
      },
      limits: {
        maxFiles: 50,
        maxDurationMinutes: 30,
        maxFileSizeMB: 100,
        maxResolution: "4K"
      }
    };
    
    // Динамические проверки доступности
    capabilities.runtime = {};
    
    // FFmpeg доступность
    try {
      await execa("ffmpeg", ["-version"], { timeout: 3000 });
      capabilities.runtime.ffmpeg = { available: true, status: "ok" };
    } catch {
      capabilities.runtime.ffmpeg = { available: false, status: "error", impact: "Video processing disabled" };
    }
    
    // Whisper доступность
    try {
      await execa("whisper", ["--version"], { timeout: 3000 });
      capabilities.runtime.whisper = { available: true, status: "ok" };
      capabilities.transcription = { enabled: true, models: ["tiny", "base", "small", "medium", "large"] };
    } catch {
      capabilities.runtime.whisper = { available: false, status: "warning", impact: "Transcription disabled" };
      capabilities.transcription = { enabled: false, reason: "Whisper CLI not available" };
    }
    
    // Шрифты
    try {
      const fontInfo = await getFontInfo();
      capabilities.runtime.fonts = { 
        available: fontInfo.exists, 
        selected: fontInfo.path,
        status: fontInfo.exists ? "ok" : "warning"
      };
      capabilities.textOverlays = { 
        enabled: fontInfo.exists, 
        reason: fontInfo.exists ? null : "No fonts found" 
      };
    } catch {
      capabilities.runtime.fonts = { available: false, status: "error" };
      capabilities.textOverlays = { enabled: false, reason: "Font system error" };
    }
    
    // OUTPUT_DIR
    try {
      const outputInfo = await checkOutputDir();
      capabilities.runtime.outputDir = {
        writable: outputInfo.writable,
        path: outputInfo.path,
        status: outputInfo.writable ? "ok" : "error"
      };
    } catch {
      capabilities.runtime.outputDir = { writable: false, status: "error" };
    }
    
    // Общая готовность
    const isReady = capabilities.runtime.ffmpeg?.available && 
                   capabilities.runtime.outputDir?.writable &&
                   capabilities.runtime.fonts?.available;
                   
    capabilities.readiness = {
      ready: isReady,
      critical: ["ffmpeg", "outputDir", "fonts"],
      optional: ["whisper"]
    };
    
    res.json(capabilities);
    
  } catch (error: any) {
    log.error(`❌ Capabilities check failed: ${error.message}`);
    res.status(500).json({
      error: "Failed to determine system capabilities",
      message: error.message
    });
  }
});

// Детальная диагностика системы (Задача #26)
app.get("/api/health", async (_req, res) => {
  const startTime = Date.now();
  
  try {
    // Базовая информация
    const health: any = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "2.1-main",
      service: "media-video-maker",
    };
    
    // Система
    health.system = {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        unit: "MB"
      }
    };
    
    // Проверка OUTPUT_DIR
    try {
      const outputDirInfo = await checkOutputDir();
      health.outputDir = {
        path: outputDirInfo.path,
        exists: outputDirInfo.exists,
        writable: outputDirInfo.writable,
        permissions: outputDirInfo.permissions,
        size: outputDirInfo.size,
        status: outputDirInfo.writable ? "ok" : "error"
      };
    } catch (error: any) {
      health.outputDir = { status: "error", error: error.message };
    }
    
    // Проверка шрифтов
    try {
      const fontInfo = await getFontInfo();
      const allFonts = await diagnoseAllFonts();
      health.fonts = {
        selected: fontInfo.path,
        exists: fontInfo.exists,
        size: fontInfo.size,
        available: allFonts.filter(f => f.available).length,
        total: allFonts.length,
        status: fontInfo.exists ? "ok" : "warning"
      };
    } catch (error: any) {
      health.fonts = { status: "error", error: error.message };
    }
    
    // Проверка FFmpeg
    try {
      const { stdout: ffmpegVersion } = await execa("ffmpeg", ["-version"], { timeout: 5000 });
      health.ffmpeg = {
        available: true,
        version: ffmpegVersion.split('\n')[0],
        status: "ok"
      };
    } catch (error: any) {
      health.ffmpeg = {
        available: false,
        status: "error",
        error: error.code === 'ENOENT' ? 'FFmpeg not found' : error.message
      };
    }
    
    // Проверка Whisper
    try {
      const { stdout: whisperVersion } = await execa("whisper", ["--version"], { timeout: 5000 });
      health.whisper = {
        available: true,
        version: whisperVersion.trim(),
        status: "ok"
      };
    } catch (error: any) {
      health.whisper = {
        available: false,
        status: "warning",
        error: error.code === 'ENOENT' ? 'Whisper CLI not found' : error.message
      };
    }
    
    // Статистика MediaCreator
    health.mediaCreator = {
      running: media.getPendingCount(),
      // Можно добавить больше статистики когда будет доступно
      status: "ok"
    };
    
    // Общий статус
    const hasErrors = Object.values(health).some((component: any) => 
      component && typeof component === 'object' && component.status === 'error'
    );
    
    health.status = hasErrors ? "degraded" : "ok";
    health.checkDuration = `${Date.now() - startTime}ms`;
    
    res.status(hasErrors ? 503 : 200).json(health);
    
  } catch (error: any) {
    log.error(`❌ Health check failed: ${error.message}`);
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
      checkDuration: `${Date.now() - startTime}ms`
    });
  }
});

// Создание видео из JSON-сценария
app.post("/api/create-video", async (req, res) => {
  try {
    // Валидация входных данных
    const plan = PlanInputSchema.parse(req.body);
    
    // Дополнительная валидация бизнес-логики
    if (plan.files.length === 0) {
      return res.status(400).json({
        error: "Минимум один медиафайл требуется",
        code: "EMPTY_FILES"
      });
    }

    if (plan.files.length > 50) {
      return res.status(400).json({
        error: "Максимум 50 файлов поддерживается",
        code: "TOO_MANY_FILES"
      });
    }

    // Проверка разрешений
    const is4K = plan.width > 1920 || plan.height > 1920;
    if (is4K && plan.files.length > 10) {
      return res.status(400).json({
        error: "Для 4K максимум 10 файлов",
        code: "4K_FILE_LIMIT"
      });
    }
    
    // Создание задачи
    const id = media.enqueueJob(plan);
    log.info(`📹 Создана задача ${id} с ${plan.files.length} файлами`);
    
    res.json({ 
      id,
      status: "queued",
      progress: 0,
      files: plan.files.length,
      duration: plan.durationPerPhoto * plan.files.length,
      resolution: `${plan.width}x${plan.height}`,
      createdAt: new Date().toISOString(),
      webhooks: {
        status: `http://localhost:4123/api/status/${id}`,
        sse: `http://localhost:5123/mcp/sse`
      }
    });
  } catch (e: any) {
    log.error(`❌ Ошибка создания задачи: ${e?.message || e}`);
    
    // Более детальные ошибки валидации
    if (e.name === "ZodError") {
      return res.status(400).json({
        error: "Ошибка валидации входных данных",
        code: "VALIDATION_ERROR",
        details: e.errors,
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(400).json({ 
      error: e?.message || String(e),
      code: "INTERNAL_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// Получение статуса задачи
app.get("/api/status/:id", (req, res) => {
  try {
    const status = media.getStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ 
        error: "Задача не найдена",
        code: "NOT_FOUND",
        timestamp: new Date().toISOString()
      });
    }

    // Дополнительная информация для каждого состояния
    const response = {
      ...status,
      timestamp: new Date().toISOString(),
      elapsed: Date.now() - (status as any).createdAt || 0,
      eta: null as number | null
    };

    // Расчёт ETA для выполняющихся задач
    if (status.state === "running" && status.progress > 0) {
      const estSecondsPerPercent = (response.elapsed / 1000) / status.progress;
      response.eta = Math.round(estSecondsPerPercent * (100 - status.progress));
    }

    res.json(response);
  } catch (e: any) {
    log.error(`❌ Ошибка получения статуса ${req.params.id}: ${e?.message || e}`);
    res.status(500).json({ 
      error: "Внутренняя ошибка сервера",
      code: "INTERNAL_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// Получение списка всех задач (для админки)
app.get("/api/jobs", (req, res) => {
  try {
    const limit = Math.min(50, req.query.limit ? Number(req.query.limit) : 20);
    const offset = Number(req.query.offset) || 0;
    
    const result = media.getAllJobs(limit, offset);
    res.json({
      jobs: result.jobs,
      pagination: result.pagination,
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    log.error(`Ошибка получения списка задач: ${e?.message || e}`);
    res.status(500).json({
      error: "Внутренняя ошибка сервера", 
      code: "INTERNAL_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// Удаление задачи
app.delete("/api/jobs/:id", (req, res) => {
  try {
    const id = req.params.id;
    
    const cancelled = media.cancelJob(id);
    if (!cancelled) {
      return res.status(404).json({
        error: "Задача не найдена или уже завершена",
        code: "NOT_FOUND",
        timestamp: new Date().toISOString()
      });
    }
    
    log.info(`🗑️ Задача ${id} отменена пользователем`);
    
    res.json({
      id,
      status: "cancelled", 
      message: "Задача успешно отменена",
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    log.error(`Ошибка отмены задачи ${req.params.id}: ${e?.message || e}`);
    res.status(500).json({
      error: "Внутренняя ошибка сервера",
      code: "INTERNAL_ERROR", 
      timestamp: new Date().toISOString()
    });
  }
});

// Health check для Docker/K8s
app.get("/health", (_req, res) => {
  res.json({ 
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

const PORT = Number(process.env.MEDIA_PORT) || 4123;
const HOST = process.env.MEDIA_HOST || "0.0.0.0";

// Настраиваем сервер
const server = app.listen(PORT, HOST)
  .on("error", (err) => {
    log.error(`Ошибка запуска Media сервера: ${err}`);
    process.exit(1);
  })
  .on("listening", () => {
    const addr = server.address();
    if (addr && typeof addr === "object") {
      log.info(`🎬 Media Video Maker запущен на http://${addr.address}:${addr.port}`);
      log.info("Доступные URL:");
      log.info(`- http://localhost:${addr.port}`);
      log.info(`- http://127.0.0.1:${addr.port}`);
      log.info(`- Health: http://${addr.address}:${addr.port}/health`);
    }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  log.info("Получен сигнал завершения SIGTERM");
  server.close(() => {
    log.info("Media сервер остановлен");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  log.info("Получен сигнал завершения SIGINT");
  server.close(() => {
    log.info("Media сервер остановлен");
    process.exit(0);
  });
});

export default app;

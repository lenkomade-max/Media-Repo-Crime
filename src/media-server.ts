import express from "express";
import MediaCreator from "./pipeline/MediaCreator.js";
import { PlanInputSchema } from "./types/plan.js";
import { log } from "./logger.js";

const app = express();
const media = new MediaCreator();

// Базовые настройки
app.use(express.json({ limit: "50mb" }));
app.set("trust proxy", true);

// Разрешаем CORS для разработки
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
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
app.get("/api/capabilities", (_req, res) => {
  res.json({
    supportedFormats: {
      input: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "avi", "mkv"],
      output: ["mp4", "mov"]
    },
    tts: {
      providers: ["kokoro", "openai", "none"],
      voices: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
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
  });
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
    const status = media.getJobStatus(req.params.id);
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

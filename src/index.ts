import express from "express";
import MediaCreator from "./pipeline/MediaCreator.js";
import { PlanInputSchema } from "./types/plan.js";
import { log } from "./logger.js";

const app = express();
const media = new MediaCreator();

// Увеличиваем лимит для JSON, так как сценарии могут быть большими
app.use(express.json({ limit: "50mb" }));

// Проверка работоспособности
app.get("/api/ping", (_req, res) => {
  res.json({ 
    status: "ok",
    version: "1.0",
    timestamp: new Date().toISOString()
  });
});

// Создание видео из JSON-сценария
app.post("/api/create-video", async (req, res) => {
  try {
    // Валидация входных данных
    const plan = PlanInputSchema.parse(req.body);
    
    // Создание задачи
    const id = media.enqueueJob(plan);
    log.info(`Создана задача ${id}`);
    
    res.json({ 
      id,
      status: "queued",
      createdAt: new Date().toISOString()
    });
  } catch (e: any) {
    log.error(`Ошибка создания задачи: ${e?.message || e}`);
    res.status(400).json({ 
      error: e?.message || String(e),
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
        timestamp: new Date().toISOString()
      });
    }
    res.json({
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    log.error(`Ошибка получения статуса ${req.params.id}: ${e?.message || e}`);
    res.status(500).json({ 
      error: "Внутренняя ошибка сервера",
      timestamp: new Date().toISOString()
    });
  }
});

const PORT = Number(process.env.PORT) || 4123;
const HOST = "0.0.0.0";

// Явный промис для отслеживания ошибок запуска
const server = app.listen(PORT, HOST)
  .on("error", (err) => {
    log.error(`Ошибка запуска сервера: ${err}`);
    process.exit(1);
  })
  .on("listening", () => {
    const addr = server.address();
    const actualPort = typeof addr === "string" ? addr : addr?.port;
    log.info(`Media Video Maker запущен на ${HOST}:${actualPort}`);
  });

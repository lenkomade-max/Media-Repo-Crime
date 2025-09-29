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
    }
    catch (e) {
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
    }
    catch (e) {
        log.error(`Ошибка получения статуса ${req.params.id}: ${e?.message || e}`);
        res.status(500).json({
            error: "Внутренняя ошибка сервера",
            timestamp: new Date().toISOString()
        });
    }
});
const PORT = Number(process.env.PORT) || 4123;
const HOST = process.env.HOST || "0.0.0.0";
// Настраиваем сервер
const server = app.listen(PORT, HOST)
    .on("error", (err) => {
    log.error(`Ошибка запуска сервера: ${err}`);
    process.exit(1);
})
    .on("listening", () => {
    const addr = server.address();
    if (addr && typeof addr === "object") {
        log.info(`Media Video Maker запущен на http://${addr.address}:${addr.port}`);
        log.info("Доступные URL:");
        log.info(`- http://localhost:${addr.port}`);
        log.info(`- http://127.0.0.1:${addr.port}`);
        log.info(`- http://${HOST}:${addr.port}`);
    }
});
// Graceful shutdown
process.on("SIGTERM", () => {
    log.info("Получен сигнал завершения SIGTERM");
    server.close(() => {
        log.info("Сервер остановлен");
        process.exit(0);
    });
});
process.on("SIGINT", () => {
    log.info("Получен сигнал завершения SIGINT");
    server.close(() => {
        log.info("Сервер остановлен");
        process.exit(0);
    });
});

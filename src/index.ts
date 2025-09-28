import express from "express";
import MediaCreator from "./pipeline/MediaCreator.js";
import { attachMcpRoutes } from "./server/mcp.js";

const app = express();
const media = new MediaCreator();

app.use(express.json({ limit: "20mb" }));

// REST API
app.post("/api/create", (req, res) => {
  try {
    const id = media.enqueueJob(req.body);
    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || String(e) });
  }
});

app.get("/api/status/:id", (req, res) => {
  const status = media.getJobStatus(req.params.id);
  if (!status) return res.status(404).json({ error: "not found" });
  res.json(status);
});

// MCP API (JSON + SSE)
attachMcpRoutes(app, media);

const PORT = process.env.PORT || 4123;
app.listen(PORT, () => {
  console.log(`Media Video Maker running at http://localhost:${PORT}`);
});

import express from "express";
import MediaCreator from "../pipeline/MediaCreator.js";
import { attachMcpRoutes } from "./mcp.js";

const app = express();
const media = new MediaCreator();

attachMcpRoutes(app, media);

const PORT = process.env.PORT || 5123;
app.listen(PORT, () => {
  console.log(`MCP server listening on port ${PORT}`);
});

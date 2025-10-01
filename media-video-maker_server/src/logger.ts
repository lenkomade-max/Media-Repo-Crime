export type Level = "debug" | "info" | "warn" | "error";
const LEVEL = (process.env.LOG_LEVEL || "info") as Level;

function should(level: Level) {
  const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
  return order[level] >= order[LEVEL];
}

export const log = {
  debug: (...a: any[]) => should("debug") && console.debug("[DEBUG]", ...a),
  info:  (...a: any[]) => should("info")  && console.log("[INFO]", ...a),
  warn:  (...a: any[]) => should("warn")  && console.warn("[WARN]", ...a),
  error: (...a: any[]) => should("error") && console.error("[ERROR]", ...a),
};

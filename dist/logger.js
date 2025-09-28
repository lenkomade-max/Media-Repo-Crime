const LEVEL = (process.env.LOG_LEVEL || "info");
function should(level) {
    const order = { debug: 10, info: 20, warn: 30, error: 40 };
    return order[level] >= order[LEVEL];
}
export const log = {
    debug: (...a) => should("debug") && console.debug("[DEBUG]", ...a),
    info: (...a) => should("info") && console.log("[INFO]", ...a),
    warn: (...a) => should("warn") && console.warn("[WARN]", ...a),
    error: (...a) => should("error") && console.error("[ERROR]", ...a),
};

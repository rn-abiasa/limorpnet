const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel = LEVELS[process.env.LOG_LEVEL || "info"] ?? 1;

function log(level, context, message, meta = {}) {
  if (LEVELS[level] < currentLevel) return;

  const ts = new Date().toISOString();
  const metaStr = Object.keys(meta).length
    ? " " +
      JSON.stringify(meta, (_, v) => (typeof v === "bigint" ? v.toString() : v))
    : "";

  const colors = {
    debug: "\x1b[36m",
    info: "\x1b[32m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
  };
  const reset = "\x1b[0m";
  const color = colors[level] || "";

  console.log(
    `${color}[${ts}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}${reset}`,
  );
}

export function createLogger(context) {
  return {
    debug: (msg, meta) => log("debug", context, msg, meta),
    info: (msg, meta) => log("info", context, msg, meta),
    warn: (msg, meta) => log("warn", context, msg, meta),
    error: (msg, meta) => log("error", context, msg, meta),
  };
}

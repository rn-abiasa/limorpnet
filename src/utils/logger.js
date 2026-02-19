const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel = LEVELS[process.env.LOG_LEVEL || "info"] ?? 1;

const ICONS = {
  Blockchain: "⛓️ ",
  P2PServer: "🔗",
  MessageHandler: "📩",
  StateManager: "💾",
  BlockProducer: "⛏️ ",
  RPC: "🌐",
};

function log(level, context, message, meta = {}) {
  if (LEVELS[level] < currentLevel) return;

  const ts = new Date().toLocaleTimeString();
  const metaStr = Object.keys(meta).length
    ? " " +
      JSON.stringify(meta, (_, v) => (typeof v === "bigint" ? v.toString() : v))
    : "";

  const colors = {
    debug: "\x1b[90m", // Gray
    info: "\x1b[32m", // Green
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
  };

  const reset = "\x1b[0m";
  const color = colors[level] || "";
  const icon = ICONS[context] || "";
  const levelLabel = level.toUpperCase().padEnd(5);

  console.log(
    `${color}${ts} ${levelLabel} ${icon} [${context}] ${message}${metaStr}${reset}`,
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

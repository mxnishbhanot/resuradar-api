const normalizeMeta = (meta = {}) => {
  if (!meta || typeof meta !== "object") return undefined;
  return Object.keys(meta).length ? meta : undefined;
};

const write = (level, message, meta) => {
  const payload = {
    level,
    message,
    ...(normalizeMeta(meta) ? { meta: normalizeMeta(meta) } : {}),
    timestamp: new Date().toISOString(),
  };

  const line = JSON.stringify(payload);
  if (level === "error") return console.error(line);
  if (level === "warn") return console.warn(line);
  return console.log(line);
};

export const logger = {
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta),
};

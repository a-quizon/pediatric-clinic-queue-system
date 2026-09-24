/**
 * Lightweight in-memory rate limiter (H6) — no extra dependency.
 * keyFn(req) -> string bucket key
 */
function createRateLimiter({ windowMs, max, keyFn, message }) {
  const hits = new Map();

  const prune = (now) => {
    for (const [key, entry] of hits.entries()) {
      if (now - entry.start >= windowMs) hits.delete(key);
    }
  };

  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 5000) prune(now);
    const key = keyFn(req);
    if (!key) return next();

    let entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      entry = { start: now, count: 0 };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({
        error: "rate_limited",
        message: message || "Too many requests. Please try again later.",
      });
    }
    return next();
  };
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

module.exports = {
  createRateLimiter,
  clientIp,
};

// Sliding-window rate limiter. In-memory per instance — adequate for a
// single Cloud Run instance with low concurrency; swap the store for Redis
// when scaling out (the interface stays the same).

interface Window {
  timestamps: number[];
}

const store = new Map<string, Window>();
let lastSweep = Date.now();

function sweep(windowMs: number) {
  // Periodically drop stale keys so the map doesn't grow unbounded
  const now = Date.now();
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, win] of store) {
    win.timestamps = win.timestamps.filter((t) => now - t < windowMs);
    if (win.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  sweep(windowMs);
  const now = Date.now();

  let win = store.get(key);
  if (!win) {
    win = { timestamps: [] };
    store.set(key, win);
  }

  win.timestamps = win.timestamps.filter((t) => now - t < windowMs);

  if (win.timestamps.length >= maxRequests) {
    const oldest = win.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000),
    };
  }

  win.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - win.timestamps.length,
    retryAfterSeconds: 0,
  };
}

/** For tests: clear all rate-limit state. */
export function resetRateLimits() {
  store.clear();
}

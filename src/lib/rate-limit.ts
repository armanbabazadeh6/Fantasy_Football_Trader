interface RateLimiter {
  hit(key: string): boolean;
  reset(key?: string): void;
}

const MAX_KEYS = 1000;

export function createRateLimiter(
  max: number,
  windowMs: number
): RateLimiter {
  const attempts = new Map<string, number[]>();
  return {
    hit(key: string): boolean {
      if (attempts.size > MAX_KEYS) {
        const now = Date.now();
        for (const [storedKey, timestamps] of attempts) {
          if (attempts.size <= MAX_KEYS) break;
          const hasRecentHit = timestamps.some((time) => now - time < windowMs);
          if (!hasRecentHit) attempts.delete(storedKey);
        }
      }
      const now = Date.now();
      const recent = (attempts.get(key) ?? []).filter(
        (time) => now - time < windowMs
      );
      if (recent.length >= max) {
        attempts.set(key, recent);
        return false;
      }
      recent.push(now);
      attempts.set(key, recent);
      return true;
    },
    reset(key?: string): void {
      if (key === undefined) {
        attempts.clear();
      } else {
        attempts.delete(key);
      }
    },
  };
}

interface RateLimiter {
  hit(key: string): boolean;
}

export function createRateLimiter(
  max: number,
  windowMs: number
): RateLimiter {
  const attempts = new Map<string, number[]>();
  return {
    hit(key: string): boolean {
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
  };
}

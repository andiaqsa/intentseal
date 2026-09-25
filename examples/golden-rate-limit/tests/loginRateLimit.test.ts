import { describe, expect, it, vi } from "vitest";

import { loginRateLimit, rejectRateLimitedLogin } from "../src/loginRateLimit";

describe("login rate limiting", () => {
  it("limits each IP to five attempts per minute", () => {
    expect(loginRateLimit.max).toBe(5);
    expect(loginRateLimit.windowMs).toBe(60_000);
    expect(loginRateLimit.keyGenerator({ ip: "203.0.113.7" })).toBe("203.0.113.7");
  });

  it("returns HTTP 429 when the limit is exceeded", () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    rejectRateLimitedLogin({ status, json });
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ error: "Too Many Requests" });
  });
});

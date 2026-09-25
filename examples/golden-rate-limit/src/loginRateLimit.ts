export interface LoginRequest {
  ip: string;
}

export interface LoginResponse {
  status(code: number): LoginResponse;
  json(body: { error: string }): void;
}

export const loginRateLimit = {
  windowMs: 60_000,
  max: 5,
  keyGenerator: (request: LoginRequest) => request.ip,
};

export function rejectRateLimitedLogin(response: LoginResponse): void {
  response.status(429).json({ error: "Too Many Requests" });
}

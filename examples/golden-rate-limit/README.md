# Golden Rate Limit Demo

This fixture intentionally exposes clear evidence for the IntentSeal golden intent:

- `max: 5`, `windowMs: 60_000`, and `request.ip`
- `status(429)` and `Too Many Requests`
- automated tests in `tests/loginRateLimit.test.ts`

Publish this directory as its own author-owned public GitHub repository before the live demo. Do not claim a URL until it exists.

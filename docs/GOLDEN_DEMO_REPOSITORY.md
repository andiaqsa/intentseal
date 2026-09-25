# Golden Demo Repository Guide

Do not use a random third-party repository for the final presentation. Publish the contents of `examples/golden-rate-limit/` as a small public repository owned by the project author, then use its real URL in the demo.

## Golden intent

**Title:** Add API rate limiting

**Goal:** Implement login endpoint rate limiting before completing the task.

**Criteria:**

1. Maximum 5 login attempts per minute per IP
2. Return HTTP 429 when the limit is exceeded
3. Add automated tests for rate limiting

## Publication steps

1. Create a new public repository in the author's GitHub account.
2. Copy the contents of `examples/golden-rate-limit/` without modifying the intentional evidence.
3. Commit and push it manually.
4. Record the real repository URL and full commit SHA.
5. Run IntentSeal evidence analysis against that URL and exact SHA.
6. Confirm all three results and excerpts before recording the demo.

No URL is included here because the repository does not yet exist in verifiable project configuration.

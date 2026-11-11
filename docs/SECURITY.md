# Security notes

This is a proof of concept, not a hardened product. The notes below are the bar the
code is written against and the gaps a production cut would still need to close.

## OWASP-aligned controls already in the PoC

| Area | In this repo |
|---|---|
| Broken access control | Role → permission matrix, tenant id taken from the authenticated actor (never from a client-supplied header), segregation of duties on approve, employee-scoped HR reads |
| Cryptographic failures | Passwords stored as scrypt with a random salt (or a published demo hash for the seed users only); JWT HMAC with a 32+ character secret from the environment |
| Injection | Prisma parameterised queries; zod validation at the HTTP edge; integer minor-units for money (no float, no string concat into SQL) |
| Insecure design | Append-only audit log, optimistic concurrency on aggregates, approval state machines, no self-approval |
| Security misconfiguration | `helmet`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` on the hosted demo, CORS left explicit in Nest |
| Identification and auth | Bearer JWT (8 hour TTL). The static demo uses a persona switcher and does not mint tokens |
| XSS | React's default escaping; no `dangerouslySetInnerHTML` |
| Logging | `x-request-id` on every API response; tenant audit entries for mutations |
| SSRF / unexpected data egress | The default LLM provider is in-process and makes no network calls |

## Data residency and on-prem

- PostgreSQL is the system of record. In a self-hosted deployment it stays on infrastructure you control (`docker compose` in this repo). There is no vendor SaaS dependency in the default path.
- The AI assistant is a **port**. The default `MockLlmProvider` is deterministic and offline, so prompts — which may include invoice text or employee names — never leave the process. That is the safe default for a regulated or government deployment.
- `LLM_PROVIDER=openai-compatible` sends the prompt to `OPENAI_BASE_URL`. Point this at a model you run yourself (for example an internal OpenAI-compatible server) if policy requires that data stay on-prem. Pointing it at a third-party host is a deliberate residency decision; do not enable it by default.
- The public Firebase demo is a static export. It runs the same domain services in the browser with the mock provider and the fictional seed. No tenant database is attached.

## Gaps a production cut should close

- Token refresh, session revocation and step-up auth for approvals over a threshold
- Secret management (no long-lived secrets in env files; rotate JWT keys)
- Structured audit export, immutability guarantees (WORM / hash-chained log)
- Rate limiting, account lockout, and CSRF strategy if a cookie session is introduced
- Database backups, encryption at rest, and TLS termination in front of the API
- Penetration test and dependency scanning in CI

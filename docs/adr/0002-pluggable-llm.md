# ADR-0002: Pluggable LLM provider with a deterministic offline default

- **Status:** Accepted
- **Date:** 2026-11-11
- **Deciders:** Tech lead

## Context

Users want to ask for a report in natural language and to paste an invoice and get structured
fields. Sending those prompts to a third-party model would leak business data and is a poor
default for a self-hosted, government or otherwise regulated deployment. Tests and the public
demo also need a stable, key-free path.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Call a hosted vendor API from the demo | Impressive in a pitch | Keys, cost, data egress, flaky CI |
| Bake regexes into the UI | Simple | Coupled to the page, hard to swap later |
| **Port + mock default + optional OpenAI-compatible adapter** | Same interface on-prem or hosted; CI is deterministic | Mock is not a foundation model |

## Decision

`LlmProvider` exposes `complete({ task, input, today })`. Tasks today are `parse_report_filter`
and `extract_invoice_fields`. Results are validated with zod before they touch the domain.

- `MockLlmProvider` is the default (`LLM_PROVIDER=mock`). It is deterministic, makes no network
  calls, and needs no keys.
- `OpenAiCompatibleProvider` posts to `OPENAI_BASE_URL` for teams that run a local model server
  or have accepted the residency implications of a vendor endpoint.

The assistant then applies the validated filter through the ordinary list methods, so RBAC and
tenant isolation still hold.

## Consequences

- The public demo and CI never need an API key.
- A production team can change provider without touching finance, HR or procurement.
- The mock is a stand-in, not a claim about model quality. Document that clearly in the README.

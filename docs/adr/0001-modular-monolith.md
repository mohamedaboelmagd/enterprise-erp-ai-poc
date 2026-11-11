# ADR-0001: Start as a modular monolith with hard module boundaries

- **Status:** Accepted
- **Date:** 2026-11-11
- **Deciders:** Tech lead

## Context

The product covers three operational areas — finance (invoices and payments), HR (leave) and
procurement (purchase orders) — plus identity, an audit log and an AI assistant. A small team is
delivering a self-hosted first cut for regulated organisations. The workflows are still moving.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Microservices now (one deployable per area) | Independent scale and release | Distributed transactions, more ops, slower refactors |
| Plain monolith (shared tables, cross-module queries) | Fastest to start | Boundaries erode; splitting later is a rewrite |
| **Modular monolith** (modules own records, talk through services and events) | One deploy, real boundaries, cheap to split later | Discipline in reviews |

## Decision

One NestJS process, modules that own their repositories, and a shared kernel (`Actor`, `Clock`,
`Money`, `AuditLog`, `EventBus`). Cross-module reads go through the owning service (the AI
assistant asks finance/HR/procurement for filtered lists; it never opens their tables). The
browser demo and the API share the same services through `createPlatform()`.

## Consequences

- Extracting a module later means swapping the in-process call for HTTP or a queue, not rewriting the domain.
- CI and the hosted demo stay simple: one test run, one container.

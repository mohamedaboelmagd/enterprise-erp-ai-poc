# ADR-0003: PostgreSQL + Prisma for self-hosted deploys, in-memory for tests and the demo

- **Status:** Accepted
- **Date:** 2026-11-11
- **Deciders:** Tech lead

## Context

The self-hosted target is a single Docker Compose stack an agency can run in its own network.
Tests must run on GitHub Actions without a database. The public demo is a static site and cannot
talk to an API in another origin without standing up a backend.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Prisma only, testcontainers in CI | One adapter | Slower CI, more moving parts |
| TypeORM / raw SQL | Familiar | More boilerplate for this cut |
| **Ports & adapters: Prisma/Postgres or in-memory** | Same services everywhere; demo and CI stay offline | Two adapters to keep in sync |

## Decision

Repositories are async ports. `createInMemoryPlatform()` is what CI, unit tests and the Next.js
static demo use. When `DATABASE_URL` is set, the API builds the same services on Prisma
repositories and runs `prisma migrate deploy` on container boot.

Domain services never import Prisma or NestJS, so the browser bundle can include them.

## Consequences

- `docker compose up` is a realistic on-prem shape (Postgres 16 + API).
- The hosted demo cannot drift from the API: it is the same code with a different adapter.
- A new aggregate needs both an in-memory and a Prisma repository.

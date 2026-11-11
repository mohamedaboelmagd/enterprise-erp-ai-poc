# ADR-0004: Static Next.js export that runs the real domain in the browser

- **Status:** Accepted
- **Date:** 2026-11-11
- **Deciders:** Tech lead

## Context

The proof of concept needs a public URL. Firebase Hosting in this account is static. Standing up
a NestJS API on the open internet would need auth hardening, a hosted database and a residency
story we are not ready to operate.

## Decision

The Next.js app is a static export (`output: 'export'`). On first load it constructs
`createInMemoryPlatform()`, seeds the fictional tenants, and the UI calls the same services the
API would. A persona switcher stands in for login. Arabic/RTL is a chrome toggle so the layout
can be reviewed without a translation platform.

## Consequences

- Reloading the tab resets the data (no persistence in the hosted demo).
- Use `docker compose` when you want a durable, multi-user API.

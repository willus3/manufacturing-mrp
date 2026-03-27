# Manufacturing MRP System — Build Specification

**Version:** 1.0
**Date:** 2026-03-22
**Stage:** Prototype
**Mode:** Learner (includes Architecture Notes)

---

## Table of Contents

1. [Project Overview & Goals](00-overview.md)
2. [Users & Roles](01-users-and-roles.md)
3. [Data Model](02-data-model.md)
4. [Auth & Authorization](03-auth.md)
5. [Pages, Routes & Navigation](04-routes-and-pages.md)
6. [Component Architecture](05-component-architecture.md)
7. [State Management](06-state-management.md)
8. [API / Service Layer](07-api-endpoints.md)
9. [Error Handling](08-error-handling.md)
10. [Deployment & Environment](09-deployment.md)
11. [Feature Build Order](10-build-order.md)
12. [Code Quality Standards](11-code-quality.md)
13. [Phase 2 Roadmap](12-phase2-roadmap.md)

---

## 1. Project Overview & Goals

### Problem Statement
Small to medium manufacturers (5–250 employees) are underserved by the MRP/ERP market. Enterprise solutions (Oracle, SAP) cost $100K+ and are designed for large organizations. SMB manufacturers run on spreadsheets, tribal knowledge, and manual processes — leading to stockouts, missed ship dates, overbuying, and inability to scale.

### Solution
A cloud-hosted, multi-tenant SaaS MRP platform that gives SMB manufacturers planning and operational visibility at an affordable price point. Industry-agnostic. Commercially sold via tiered subscription by user count.

### Project Stage
**Prototype** — clean but not hardened. Code quality is "professional but pragmatic." Accessibility (WCAG 2.1 AA) is non-negotiable even at prototype stage. Advanced security hardening, comprehensive input validation, and rate limiting are deferred to production hardening.

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Database | PostgreSQL | Manufacturing data is deeply relational (BOMs, POs, WOs, inventory transactions). Foreign keys, joins, and transactions are essential. |
| ORM | Prisma | Schema-driven, auto-generates client, handles migrations. Friendlier than raw SQL. |
| Backend | Node.js + Express | Minimal, well-documented, largest ecosystem. |
| Frontend | React (via Vite) | Massive ecosystem, mature component libraries for data-dense UIs. |
| CSS | Tailwind CSS | Utility-first, fast to build, no style conflicts. |
| Component Library | Shadcn/ui | Accessible components (Radix-based) copied into project — full ownership. |
| Data Tables | TanStack Table | Industry standard for sortable, filterable, paginated tables. |
| Forms | React Hook Form + Zod | Lightweight form management + schema-based validation. |
| Icons | Lucide React | Clean, consistent. Ships with Shadcn. |
| Server State | TanStack Query | Fetching, caching, background refetching, loading/error states. |
| Local Dev DB | Docker Compose | Portable, reproducible, no permanent install. |
| Backend Hosting | Railway | Git-push deploys, managed Postgres, $5–20/month at prototype scale. |
| Frontend Hosting | Vercel | Free tier, global CDN, purpose-built for React. |

> **Architecture Note:** Why PostgreSQL over MongoDB? BOMs have parent/child hierarchies, POs reference suppliers and items, work orders reference BOMs and consume inventory. These are relationships, and relational databases are literally named for handling them. MongoDB can do this, but you'd be fighting the tool.

> **Architecture Note:** Why Shadcn instead of Material UI or Ant Design? MUI and Ant are full frameworks that control everything. Shadcn gives you the same quality components as your own code — you can modify any component directly. For custom things like BOM tree views and MRP result tables, that flexibility matters.

### Success Metrics (V1)
- A shop can fully replace their spreadsheet-based planning workflow
- Users can answer "Do we have enough material to run?" in real time
- Purchase orders and work orders are generated from the MRP engine rather than manually
- A new shop can onboard and be operational within a single work day

### Timeline & Constraints
- No hard deadline — iterative build
- Self-funded, cost-conscious
- Prototype acceptable as first milestone

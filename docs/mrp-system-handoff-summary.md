# Manufacturing MRP System — Architect Handoff Summary
**Date:** 2026-03-21
**For:** App Prompt Architect / Spec-Driven Build

---

## What We're Building
A cloud-hosted, multi-tenant SaaS MRP platform for small-to-medium manufacturers (5–250 employees, industry-agnostic). Replaces spreadsheet-based planning with a modern, affordable alternative to enterprise ERPs. Commercially sold via tiered subscription (by user count).

## The Core Problem
SMB manufacturers run on spreadsheets and tribal knowledge. Enterprise MRP (Oracle, SAP) costs $100K+ and is out of reach. No good middle-ground exists. This fills that gap.

## V1 Must-Have Modules (in priority order)
1. **BOM Management** — multi-level bills of materials, revision history
2. **Inventory Control** — real-time stock levels, transactions, CSV import
3. **MRP Calculation Engine** — BOM explosion against demand, net requirements, lead time logic
4. **Purchase Order Management** — PO lifecycle, partial receipts, supplier/item master
5. **Production Scheduling & Work Orders** — work order generation, status tracking, job sequencing

## Users & Roles
Multi-user, role-based. Key roles: Owner/Executive, Production Manager, Purchasing Agent, Shop Floor Supervisor, Inventory Clerk. RBAC required from day one.

## Architecture Constraints
- **Multi-tenant SaaS** — full data isolation per shop, mandatory from V1
- **Cloud-hosted** — browser-based, no on-premise in V1
- **Self-funded** — minimize infrastructure and licensing costs
- **CSV import** — required for onboarding (parts, inventory, suppliers)
- **No external integrations** in V1 — standalone system
- **Stack is open** — choose what best fits relational manufacturing data + multi-tenant SaaS

## Stack Recommendation Notes
- Manufacturing data is deeply relational (BOMs, WOs, POs, inventory transactions) — strongly favors a relational DB (PostgreSQL) over document DB (MongoDB)
- Suggest: PostgreSQL + Node.js/Express (or NestJS) + React + hosted on Railway or Render (low cost, easy deploys)
- Prototype-first is acceptable — can migrate later if needed

## Design Direction
- Modern SaaS aesthetic with operational data density (not consumer-grade, not legacy ERP)
- Desktop-first, tablet-friendly
- No existing brand — name and visual identity TBD

## Out of Scope for V1
Forecasting, capacity planning, shop floor tracking, costing/COGS, quality/traceability, supplier scoring, analytics dashboards, integrations, mobile app, on-premise.

## Key Open Questions for Architect
1. Does V1 need email/notification system (low-stock alerts, PO reminders)?
2. How are sales orders entered? Manual entry in V1 (no integration)?
3. Self-service signup flow or manual shop provisioning in V1?
4. Soft multi-tenancy (shared DB, tenant_id column) vs. hard (schema-per-tenant)?

## Timeline & Constraints
- No hard deadline — iterative build
- Self-funded, cost-conscious
- Solo developer (manufacturing domain expert, learning full-stack MERN/web dev)
- Prototype acceptable as first milestone

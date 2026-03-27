# Manufacturing MRP System — Requirements Document
**Date:** 2026-03-21
**Status:** Draft v1.0

---

## 1. Problem Statement

Small to medium manufacturers (up to ~250 employees) are severely underserved by the current MRP/ERP market. Enterprise solutions like Oracle NetSuite cost $100K+ to implement and are designed for large organizations. As a result, SMB manufacturers run their businesses on spreadsheets, tribal knowledge, and manual processes — leading to stockouts, missed ship dates, overbuying, and an inability to scale.

There is a clear market gap for an affordable, modern, cloud-based MRP system purpose-built for the SMB manufacturing market.

---

## 2. Product Overview

A cloud-hosted, multi-tenant SaaS MRP platform that gives small to medium manufacturers the planning and operational visibility previously only available to large enterprises — at a price point they can afford.

**Delivery model:** SaaS (cloud-hosted, browser-based)
**Pricing model:** Tiered by number of users (pricing TBD)
**Target market:** Industry-agnostic SMB manufacturers, 5–250 employees

---

## 3. Goals & Success Metrics

### Business Goals
- Build a commercially viable SaaS product in the underserved SMB manufacturing market
- Achieve recurring revenue through monthly/annual subscriptions
- Establish product-market fit through early adopter shops before expanding to Phase 2 features

### Success Metrics (V1)
- A shop can fully replace their spreadsheet-based planning workflow with the system
- Users can answer "Do we have enough material to run?" in real time without manual lookups
- Purchase orders and work orders are generated from the MRP engine rather than manually created
- A new shop can onboard and be operational within a single work day

---

## 4. Target Users

| Role | Primary Use |
|------|-------------|
| Owner / Executive | High-level visibility, production status |
| Production Manager | Work orders, scheduling, capacity overview |
| Purchasing Agent | PO creation, supplier management, receipts |
| Shop Floor Supervisor | Work order status, job tracking |
| Inventory Clerk | Stock counts, material receipts, adjustments |

All roles access the same platform with role-based permissions controlling what they can see and do.

---

## 5. V1 Scope — What We're Building

These five modules form the core MRP engine. Everything else is Phase 2+.

### 5.1 Bill of Materials (BOM) Management
- Create and manage multi-level BOMs for finished goods and sub-assemblies
- Define components, quantities, units of measure, and assembly sequence
- Single source of truth for what goes into every product
- Revision history / version control on BOMs

### 5.2 Inventory Control
- Real-time inventory levels for raw materials, WIP, and finished goods
- Inventory transactions: receipts, adjustments, issues to production
- Low-stock alerts and reorder points
- CSV/spreadsheet import for initial inventory setup
- Support for multiple units of measure

### 5.3 MRP Calculation Engine
- Explode BOM against open sales orders and/or production plans
- Check on-hand inventory and subtract available stock
- Factor in supplier lead times
- Generate material requirements: what to buy, how much, and when
- Net requirements calculation (gross demand minus on-hand minus on-order)

### 5.4 Purchase Order Management
- Create, send, and track purchase orders to suppliers
- PO status: draft, sent, partially received, fully received
- Receive against POs (full and partial receipts)
- Supplier and item master with lead times and pricing
- CSV import for existing supplier and parts data

### 5.5 Production Scheduling & Work Orders
- Generate work orders from MRP output or manually
- Assign jobs to work centers / resources
- Work order status: planned, in-progress, complete
- Basic job prioritization and sequencing
- Link work orders to BOMs and inventory consumption

---

## 6. Out of Scope for V1

The following are confirmed Phase 2+ features:
- Demand forecasting and sales history analysis
- Capacity planning (machine hours, labor hours)
- Shop floor tracking / real-time job progress
- Costing & COGS (true cost per unit)
- Quality management & lot traceability
- Supplier performance scoring
- Reporting & analytics dashboards
- Accounting integrations (QuickBooks, etc.)
- E-commerce / sales order integrations
- On-premise deployment option
- Mobile app

---

## 7. Design Direction

- **Aesthetic:** Modern SaaS (not legacy ERP) with appropriate data density for operational users
- **Reference point:** Between a dense ops dashboard and a clean modern admin UI
- **Users are not necessarily tech-savvy** — the interface must be learnable without training
- **Branding:** Name TBD, built from scratch (no existing assets)
- **Responsive:** Desktop-first (shop office environment), tablet-friendly secondary

---

## 8. Technical Requirements

### Architecture
- Cloud-hosted, browser-based web application
- Multi-tenant: each shop's data is fully isolated
- Role-based access control (RBAC)
- Self-funded build — minimize infrastructure costs

### Data
- CSV/spreadsheet import for: parts list, inventory, supplier list (onboarding)
- Data entry within the system for all ongoing operations

### Deployment
- Cloud-hosted V1 (managed by the product owner)
- On-premise option deferred to future enterprise tier

### Stack
- Open to best-fit technologies (see handoff summary for recommendation)
- Cost-conscious: prefer open-source, avoid expensive managed services where possible
- Prototype-first acceptable — can migrate to production-grade infrastructure later

### Integrations (V1)
- None required — standalone system

---

## 9. Launch & Maintenance

- **Timeline:** No hard deadline — iterative build
- **Pilot customers:** None confirmed — speculative build initially
- **Maintenance:** Self-managed by founder; support team added as needed post-launch
- **Funding:** Self-funded

---

## 10. Open Questions

| # | Question | Priority |
|---|----------|----------|
| 1 | Product name | Before branding/design work |
| 2 | Pricing tiers and price points | Before launch |
| 3 | Does V1 need email notifications (PO reminders, low stock alerts)? | Before V1 build |
| 4 | Does V1 need a customer-facing onboarding/signup flow, or manual provisioning by owner? | Early V1 |
| 5 | What's the minimum viable "sales order" input for the MRP engine — manual entry or something else? | Before MRP module build |

---

*This document represents the agreed-upon scope and direction as of the discovery session on 2026-03-21. It should be updated as decisions are made on open questions.*

## 12. Feature Build Order

### Phase 0 — Foundation

| # | Feature | Dependencies |
|---|---------|-------------|
| 0.1 | Project setup: Git, Docker Compose, Express, Prisma, Vite + React, Tailwind + Shadcn | None |
| 0.2 | Database schema: all 18 entities in Prisma, initial migration | 0.1 |
| 0.3 | Auth system: login/logout, JWT issue/verify, refresh, auth middleware, tenant scoping | 0.2 |
| 0.4 | RBAC middleware: permission checks, seed permissions and roles | 0.3 |
| 0.5 | App shell UI: sidebar, top bar, routing, auth context, protected routes, login page | 0.3 |
| 0.6 | Seed script: super admin, test tenant, tenant admin, default roles | 0.4 |

**Review gate:** Log in, see app shell, redirect when unauthenticated.

### Phase 1 — Master Data

| # | Feature | Dependencies |
|---|---------|-------------|
| 1.1 | Item Master: CRUD API + pages, CSV import, search/filter | 0.5 |
| 1.2 | Inventory Locations: CRUD API + pages | 0.5 |
| 1.3 | Supplier Master: CRUD API + pages, CSV import | 0.5 |
| 1.4 | Item-Supplier Links: API + UI on item detail (suppliers tab) | 1.1, 1.3 |

**Review gate:** Create items, locations, suppliers. Link suppliers to items. CSV import works.

### Phase 2 — BOM Management

| # | Feature | Dependencies |
|---|---------|-------------|
| 2.1 | BOM CRUD: header + line editor, status management | 1.1 |
| 2.2 | BOM Tree View: multi-level visualization | 2.1 |
| 2.3 | BOM Revision: create new revision, auto-obsolete previous | 2.1 |

**Review gate:** Multi-level BOMs, tree view, revisions, one active per item enforced.

### Phase 3 — Inventory Control

| # | Feature | Dependencies |
|---|---------|-------------|
| 3.1 | Stock Overview: filterable by item/location/status, grouped display | 1.1, 1.2 |
| 3.2 | Inventory Adjustments: form + API, lot/serial handling | 3.1 |
| 3.3 | Inventory Transfers: between locations, paired transactions | 3.1 |
| 3.4 | Transaction Log: filterable history | 3.2 |
| 3.5 | CSV Inventory Import: bulk initial stock with location/lot data | 3.1 |

**Review gate:** Full inventory visibility, adjustments, transfers, transaction audit trail, CSV import.

### Phase 4 — Purchase Orders

| # | Feature | Dependencies |
|---|---------|-------------|
| 4.1 | PO CRUD: header + line editor, auto-fill from ItemSupplier | 1.3, 1.4 |
| 4.2 | PO Status Flow: draft → sent → partial → received → cancelled | 4.1 |
| 4.3 | PO Receiving: per-line receipt, location/lot/serial, inventory transactions | 4.1, 3.2 |

**Review gate:** Full PO lifecycle. Receiving increases inventory with traceability.

### Phase 5 — Work Orders

| # | Feature | Dependencies |
|---|---------|-------------|
| 5.1 | WO CRUD: create from BOM, auto-generate material lines | 2.1 |
| 5.2 | WO Status Flow: planned → released → in_progress → completed | 5.1 |
| 5.3 | Material Issue: issue from inventory to WO lines, lot/serial | 5.1, 3.2 |
| 5.4 | WO Completion: inventory receipt for finished item | 5.3 |

**Review gate:** Full production cycle. Material consumed, finished goods produced, full traceability.

### Phase 6 — MRP Engine

| # | Feature | Dependencies |
|---|---------|-------------|
| 6.1 | Demand Entry: manual CRUD | 1.1 |
| 6.2 | MRP Calculation: BOM explosion, net requirements, lead time offset | 6.1, 2.1, 3.1, 4.1, 5.1 |
| 6.3 | MRP Results View: grouped, sortable, bulk actions | 6.2 |
| 6.4 | Convert to PO/WO: one-click conversion from suggestion | 6.3, 4.1, 5.1 |

**Review gate:** Enter demand → run MRP → review suggestions → convert to POs and WOs. The core MRP loop works.

### Phase 7 — Admin & Dashboard

| # | Feature | Dependencies |
|---|---------|-------------|
| 7.1 | User Management: CRUD, role assignment | 0.4 |
| 7.2 | Role Management: view/create custom roles, assign permissions | 0.4 |
| 7.3 | Dashboard: low stock, PO summary, WO status, demand, MRP summary | 3.1, 4.1, 5.1, 6.2 |
| 7.4 | Super Admin: tenant CRUD, suspend/activate, impersonate | 0.4 |
| 7.5 | Tenant Settings: company info, defaults, number prefixes | 0.5 |

**Review gate:** Fully functional app. User/role management, dashboard, super admin, tenant settings.

### Review Gate Protocol

After each feature, the builder must:

1. **Summarize** what was built, files changed, decisions beyond spec
2. **Testability checklist** — specific steps to verify the feature works
3. **Flag decisions** needing approval
4. **Present:**

```
⏸ FEATURE REVIEW — [Feature Name]

Please review and confirm:
✅ APPROVED — continue to next feature
🔁 REVISE — [describe what to change]
❓ QUESTION — [ask a clarifying question]
```

5. **Do not proceed** until explicit approval.

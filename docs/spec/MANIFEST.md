# Spec Manifest

This manifest maps build phases to the spec files the builder must read before starting each phase, and documents cross-reference dependencies between spec files.

---

## Phase-to-File Map

Before starting a build phase, the agent **must** read the listed spec files.

| Build Phase | Required Spec Files |
|-------------|-------------------|
| **Phase 0 — Foundation** | `00-overview.md`, `02-data-model.md`, `03-auth.md`, `01-users-and-roles.md`, `09-deployment.md`, `11-code-quality.md` |
| **Phase 0.5 — App Shell UI** | `04-routes-and-pages.md`, `05-component-architecture.md`, `06-state-management.md` |
| **Phase 1 — Master Data** | `02-data-model.md` (Item, Supplier, ItemSupplier, InventoryLocation), `07-api-endpoints.md` (Items, Suppliers, Item-Supplier Links, Locations), `04-routes-and-pages.md`, `05-component-architecture.md`, `08-error-handling.md` |
| **Phase 2 — BOM Management** | `02-data-model.md` (BOM, BOMLine), `07-api-endpoints.md` (BOMs), `04-routes-and-pages.md`, `05-component-architecture.md` (BOMTreeView, BOMLineEditor) |
| **Phase 3 — Inventory Control** | `02-data-model.md` (InventoryStock, InventoryTransaction, InventoryLocation), `07-api-endpoints.md` (Inventory, Locations), `04-routes-and-pages.md`, `05-component-architecture.md` (InventoryByLocation, CSVImport) |
| **Phase 4 — Purchase Orders** | `02-data-model.md` (PurchaseOrder, PurchaseOrderLine, PurchaseOrderReceipt), `07-api-endpoints.md` (Purchase Orders), `04-routes-and-pages.md`, `05-component-architecture.md` (POLineEditor, ReceiveForm) |
| **Phase 5 — Work Orders** | `02-data-model.md` (WorkOrder, WorkOrderLine), `07-api-endpoints.md` (Work Orders), `04-routes-and-pages.md`, `05-component-architecture.md` (WOLineTable) |
| **Phase 6 — MRP Engine** | `02-data-model.md` (DemandEntry, MrpRun, MrpResult), `07-api-endpoints.md` (MRP), `04-routes-and-pages.md`, `05-component-architecture.md` (MRPResultsTable) |
| **Phase 7 — Admin & Dashboard** | `01-users-and-roles.md`, `02-data-model.md` (Tenant, User, Role, Permission), `07-api-endpoints.md` (Admin, Super Admin), `04-routes-and-pages.md`, `05-component-architecture.md` (StockAlertCard) |

---

## Cross-Reference Dependencies

When modifying a spec file, check the listed files for downstream impact.

| If you modify... | Check these files... | Reason |
|-----------------|---------------------|--------|
| `02-data-model.md` | `07-api-endpoints.md`, `04-routes-and-pages.md`, `05-component-architecture.md` | Entity changes affect API contracts, page data requirements, and component props |
| `01-users-and-roles.md` | `03-auth.md`, `04-routes-and-pages.md`, `07-api-endpoints.md` | Permission changes affect auth middleware, route access rules, and endpoint authorization |
| `03-auth.md` | `07-api-endpoints.md` (Auth section), `06-state-management.md`, `09-deployment.md` | Auth flow changes affect API auth endpoints, client session state, and environment variables |
| `04-routes-and-pages.md` | `05-component-architecture.md`, `06-state-management.md` | Route changes affect which components are needed and which data is fetched |
| `05-component-architecture.md` | `04-routes-and-pages.md`, `06-state-management.md` | Component changes affect page layouts and state requirements |
| `07-api-endpoints.md` | `02-data-model.md`, `06-state-management.md`, `08-error-handling.md` | API changes must align with data model, affect caching strategy, and follow error patterns |
| `09-deployment.md` | `03-auth.md`, `00-overview.md` | Environment variable changes affect auth config and stack decisions |
| `10-build-order.md` | All files | Build order changes may shift when certain spec sections become relevant |

## 8. API / Service Layer

### Conventions

| Decision | Choice |
|----------|--------|
| Style | REST |
| Base URL | `/api/v1` |
| Auth | Bearer token in Authorization header |
| Tenant scoping | Extracted from JWT (not URL) |
| Response format | `{ data, meta, error }` |
| Pagination | `?page=1&pageSize=25` → `meta: { total, page, pageSize, totalPages }` |
| Filtering | Query params: `?status=active&type=raw_material` |
| Sorting | `?sort=partNumber&order=asc` |

### Response Shapes

**Success (single):**
```json
{ "data": { ... }, "meta": null, "error": null }
```

**Success (list):**
```json
{ "data": [ ... ], "meta": { "total": 142, "page": 1, "pageSize": 25, "totalPages": 6 }, "error": null }
```

**Error:**
```json
{ "data": null, "meta": null, "error": { "code": "ITEM_NOT_FOUND", "message": "..." } }
```

### Endpoints

#### Auth
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| POST | `/auth/login` | `{ email, password, tenantSlug }` | `{ accessToken, refreshToken, user }` | 401 |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` | 401 |
| POST | `/auth/logout` | — | `{ success: true }` | — |
| GET | `/auth/me` | — | Current user + permissions | 401 |

#### Items
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/items` | Query: type, search, isActive, page, pageSize, sort, order | Paginated list | — |
| GET | `/items/:id` | — | Item + suppliers + inventory + BOMs | 404 |
| POST | `/items` | Item fields | Created item | 400, 409 duplicate partNumber |
| PUT | `/items/:id` | Item fields | Updated item | 400, 404 |
| PATCH | `/items/:id/deactivate` | — | Deactivated item | 404 |
| POST | `/items/import` | CSV file | `{ imported, skipped, errors }` | 400 |

#### BOMs
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/boms` | Query: itemId, status, page, pageSize | Paginated list | — |
| GET | `/boms/:id` | — | Header + lines + tree | 404 |
| GET | `/boms/:id/tree` | — | Full multi-level exploded tree | 404, 400 circular ref |
| POST | `/boms` | Header + lines | Created BOM | 400, 409 active exists |
| PUT | `/boms/:id` | Header + lines | Updated BOM | 400, 404 |
| PATCH | `/boms/:id/status` | `{ status }` | Updated | 400 invalid transition |
| POST | `/boms/:id/revise` | — | New revision, old → obsolete | 404 |

#### Inventory
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/inventory/stock` | Query: itemId, locationId, status, page, pageSize | Paginated stock | — |
| GET | `/inventory/stock/summary` | Query: itemId | Aggregated per item | — |
| GET | `/inventory/transactions` | Query: itemId, locationId, type, dateFrom, dateTo, page, pageSize | Paginated log | — |
| POST | `/inventory/adjust` | `{ itemId, locationId, quantity, lotNumber?, serialNumber?, notes }` | Transaction + stock | 400 |
| POST | `/inventory/transfer` | `{ itemId, fromLocationId, toLocationId, quantity, lotNumber?, serialNumber? }` | Two transactions + stock | 400 insufficient |

#### Locations
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/locations` | Query: search, isActive | All locations | — |
| POST | `/locations` | Fields | Created | 400, 409 |
| PUT | `/locations/:id` | Fields | Updated | 400, 404 |
| PATCH | `/locations/:id/deactivate` | — | Deactivated | 404, 400 has stock |

#### Suppliers
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/suppliers` | Query: search, isActive, page, pageSize | Paginated list | — |
| GET | `/suppliers/:id` | — | Supplier + items + POs | 404 |
| POST | `/suppliers` | Fields | Created | 400, 409 |
| PUT | `/suppliers/:id` | Fields | Updated | 400, 404 |
| PATCH | `/suppliers/:id/deactivate` | — | Deactivated | 404 |
| POST | `/suppliers/import` | CSV file | Import result | 400 |

#### Item-Supplier Links
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/items/:itemId/suppliers` | — | Linked suppliers | 404 |
| POST | `/items/:itemId/suppliers` | `{ supplierId, unitCost, leadTimeDays, ... }` | Created link | 400, 409 |
| PUT | `/items/:itemId/suppliers/:supplierId` | Fields | Updated | 404 |
| DELETE | `/items/:itemId/suppliers/:supplierId` | — | Removed | 404 |

#### Purchase Orders
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/purchase-orders` | Query: status, supplierId, page, pageSize, sort, order | Paginated list | — |
| GET | `/purchase-orders/:id` | — | Header + lines + receipts | 404 |
| POST | `/purchase-orders` | Header + lines | Created PO (draft) | 400 |
| PUT | `/purchase-orders/:id` | Header + lines | Updated | 400, 404 |
| PATCH | `/purchase-orders/:id/send` | — | Status → sent | 404, 400 |
| PATCH | `/purchase-orders/:id/cancel` | — | Status → cancelled | 404, 400 |
| POST | `/purchase-orders/:id/receive` | `{ lines: [{ poLineId, quantity, locationId, lotNumber?, serialNumber? }] }` | Receipts + inventory | 400 |

#### Work Orders
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/work-orders` | Query: status, priority, page, pageSize, sort, order | Paginated list | — |
| GET | `/work-orders/:id` | — | Header + lines | 404 |
| POST | `/work-orders` | `{ bomId, quantity, priority, scheduledStart?, scheduledEnd? }` | Created WO + material lines | 400 |
| PUT | `/work-orders/:id` | Fields | Updated | 400, 404 |
| PATCH | `/work-orders/:id/status` | `{ status }` | Updated. On `completed`: inventory receipt for finished item | 400, 404 |
| POST | `/work-orders/:id/issue` | `{ lines: [{ woLineId, quantity, locationId, lotNumber?, serialNumber? }] }` | Material issued + inventory | 400 |

#### MRP
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/mrp/demand` | Query: status, itemId, page, pageSize | Paginated demand | — |
| POST | `/mrp/demand` | `{ itemId, quantityRequired, dateRequired, notes? }` | Created | 400 |
| PUT | `/mrp/demand/:id` | Fields | Updated | 400, 404 |
| PATCH | `/mrp/demand/:id/cancel` | — | Cancelled | 404 |
| POST | `/mrp/run` | `{ planningHorizonDays? }` | Run + results | 400 no demand |
| GET | `/mrp/runs` | Query: page, pageSize | Run history | — |
| GET | `/mrp/runs/:id/results` | Query: actionType, status | Result lines | 404 |
| POST | `/mrp/runs/:id/results/:resultId/convert` | — | Created PO or WO | 400, 404 |
| PATCH | `/mrp/runs/:id/results/:resultId/dismiss` | — | Dismissed | 404 |

#### Admin
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/admin/users` | Query: search, isActive | User list + roles | — |
| POST | `/admin/users` | `{ email, firstName, lastName, password, roleIds }` | Created | 400, 409 |
| PUT | `/admin/users/:id` | Fields | Updated | 400, 404 |
| PATCH | `/admin/users/:id/deactivate` | — | Deactivated | 404, 400 self |
| GET | `/admin/roles` | — | Roles + permissions | — |
| POST | `/admin/roles` | `{ name, permissionIds }` | Created role | 400 |
| PUT | `/admin/roles/:id` | Fields | Updated | 400, 404 |
| GET | `/admin/permissions` | — | All permissions | — |

#### Super Admin
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/super/tenants` | Query: search, status | All tenants | — |
| POST | `/super/tenants` | `{ name, slug, adminEmail, adminPassword }` | Tenant + admin | 400, 409 |
| PUT | `/super/tenants/:id` | Fields | Updated | 400, 404 |
| PATCH | `/super/tenants/:id/suspend` | — | Suspended | 404 |
| PATCH | `/super/tenants/:id/activate` | — | Activated | 404 |
| POST | `/super/tenants/:id/impersonate` | — | Admin JWT | 404 |

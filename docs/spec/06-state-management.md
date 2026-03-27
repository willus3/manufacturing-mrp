## 7. State Management

### Data Fetching

| Decision | Choice |
|----------|--------|
| Server state | TanStack Query (React Query) |
| Client state | React Context (minimal — sidebar, auth session) |
| URL state | Search params (filters, sort, pagination, active tab) |

### Caching & Staleness

| Data Type | Stale Time | Refetch On |
|-----------|-----------|------------|
| Item master, suppliers, BOMs | 5 minutes | Window focus |
| Inventory stock levels | 30 seconds | Window focus + interval |
| PO list, WO list | 1 minute | Window focus |
| MRP results | No cache | Manual refetch only |
| Current user / permissions | Session lifetime | Login only |

### State Location

| State | Location |
|-------|----------|
| Server data (all entities) | TanStack Query cache |
| Current user session | React Context |
| Table filters & sort | URL search params |
| Pagination | URL search params |
| Active tab on detail pages | URL search params |
| Sidebar collapsed | Local state (useState) |
| Form draft in progress | React Hook Form (local) |

### Loading / Error / Empty States

| State | Display |
|-------|---------|
| Loading (first) | Skeleton loader matching layout |
| Loading (refetch) | Silent — data updates in background |
| Error | Inline message with retry button |
| Empty | Friendly message + call-to-action |
| Stale | Show cached data + "Last updated" indicator |

### Real-Time

No WebSockets in V1. TanStack Query background refetching provides "near real-time." True real-time is Phase 2.

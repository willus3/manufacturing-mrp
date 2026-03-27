## 9. Error Handling

### Validation Strategy

| Layer | What | How |
|-------|------|-----|
| Client-side | Required fields, format, min/max | Zod + React Hook Form (blur + submit) |
| Server-side | Same rules + business logic | Zod on request body, business rules in service layer |
| Database | Last-line constraints | Unique indexes, FKs, not-null via Prisma |

### Error Display

| Type | Display |
|------|---------|
| Field validation | Inline below field, red text |
| Form-level | Alert banner at top of form |
| Action success | Toast (green, auto-dismiss 3s) |
| Action failure | Toast (red, manual dismiss) |
| Permission denied | Toast + redirect |
| Not found | Full page with back button |
| Network error | Toast with retry button |
| Unexpected error | Toast: "Something went wrong. Try again or contact support." |

### Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Schema validation failed |
| `DUPLICATE_ENTRY` | 409 | Unique constraint violated |
| `NOT_FOUND` | 404 | Entity doesn't exist |
| `INVALID_TRANSITION` | 400 | Status change not allowed |
| `INSUFFICIENT_STOCK` | 400 | Not enough inventory |
| `UNAUTHORIZED` | 401 | Not logged in / token expired |
| `FORBIDDEN` | 403 | Lacks permission |
| `REFERENCE_CONFLICT` | 400 | Can't deactivate — dependencies exist |
| `INTERNAL_ERROR` | 500 | Unexpected failure |

### Logging (Server)

| What | Details |
|------|---------|
| Every API request | timestamp, method, path, userId, tenantId, duration, status |
| Errors | + error code, message, stack (5xx only) |
| MRP runs | parameters, counts, duration, result count |
| Auth events | login success/fail, refresh, logout |

Prototype: log to stdout. Production: pipe to logging service.

### Retry & Timeout

| Scenario | Behavior |
|----------|----------|
| API timeout | 30s. Network error toast with retry. |
| Failed mutation | No auto-retry. Show error, manual retry. |
| Failed query | 3 retries, exponential backoff (1s, 2s, 4s). Then error state. |
| Token expired | Auto-refresh. If fails, redirect to login. |

---

## 10. Third-Party Integrations

**SKIPPED** — V1 is a standalone system. No external integrations. Integrations (accounting, e-commerce, barcode hardware) are Phase 2+.

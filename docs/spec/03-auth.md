## 4. Auth & Authorization

### Authentication

| Decision | Choice |
|----------|--------|
| Method | Email + password |
| Password hashing | bcrypt (12 rounds) |
| Session handling | JWT |
| Access token expiry | 1 hour |
| Refresh token expiry | 7 days |
| Password policy | Minimum 8 characters (strengthen for production) |
| Password reset | Not in V1 — admin resets manually via user management |

### JWT Payload

```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "permissions": ["bom:read", "bom:write", "..."]
}
```

### Tenant Identification at Login

Tenant selector on a single login page (prototype). User enters email, system resolves tenant(s). If multiple tenants, user selects. Migrate to subdomain-based (`acme.app.com`) for production.

### Authorization Flow

Every API request passes through this middleware chain:

1. **Authenticate:** Validate JWT → extract userId, tenantId, permissions. Reject with 401 if invalid/expired.
2. **Scope tenant:** Inject tenantId filter into all database queries. This happens at the middleware level — route handlers never filter by tenant manually.
3. **Check permission:** Verify the user has the required permission for the requested action. Reject with 403 if insufficient.

> **Architecture Note:** Tenant scoping at the middleware level is the single most important security decision. Like a lens filter on a camera — once it's on, everything is filtered to that tenant. No developer can accidentally forget it.

### Token Refresh Flow

1. Access token expires (1 hour)
2. Frontend detects 401 response
3. Automatically sends refresh token to `/auth/refresh`
4. Receives new access token + refresh token
5. Retries the original request
6. If refresh fails → redirect to login

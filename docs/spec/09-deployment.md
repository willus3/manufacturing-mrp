## 11. Deployment & Environment

### Hosting

| Component | Platform | Cost |
|-----------|----------|------|
| Backend (Node/Express) | Railway | $5–20/month |
| Database (PostgreSQL) | Railway (managed) | Included |
| Frontend (React) | Vercel | Free tier |

### Local Development

Docker Compose for PostgreSQL. One command: `docker-compose up`.

### Environment Variables

**Backend (.env):**

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/mrp` | Prisma connection |
| `JWT_SECRET` | random 64-char string | Signs access tokens |
| `JWT_REFRESH_SECRET` | different random 64-char string | Signs refresh tokens |
| `JWT_EXPIRY` | `1h` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token lifetime |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` / `production` | Logging, error detail |
| `CORS_ORIGIN` | `https://app.vercel.app` | Allowed frontend origin |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |

**Frontend (.env):**

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `https://api.railway.app/api/v1` | Backend base URL |

### Deploy Pipeline

```
Push to main → Railway auto-deploys backend → Vercel auto-deploys frontend
Railway build: npx prisma migrate deploy && node dist/server.js
```

### Environments

| Environment | Database |
|-------------|----------|
| Local dev | Docker Compose Postgres |
| Production | Railway managed Postgres |

Staging deferred to Phase 2.

### Seed Data

Run via `npx prisma db seed`:
- All 17 permissions
- 5 default roles with permission assignments
- Super admin user account
- One test tenant with admin user (dev only)

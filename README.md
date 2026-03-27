# Manufacturing MRP System

A cloud-hosted, multi-tenant SaaS MRP platform for small-to-medium manufacturers.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Getting Started

### 1. Start the database

```bash
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432`.

### 2. Set up the server

```bash
cd server
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

Server runs on `http://localhost:3000`. Health check at `http://localhost:3000/api/v1/health`.

### 3. Set up the client

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Client runs on `http://localhost:5173`.

## Project Structure

```
manufacturing-mrp/
├── docker-compose.yml      # PostgreSQL for local dev
├── server/                 # Express + Prisma backend
│   ├── prisma/
│   │   └── schema.prisma   # Database schema (18 entities)
│   ├── src/
│   │   └── index.js        # Server entry point
│   └── .env                # Server environment variables
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/ui/  # Shadcn/ui components
│   │   └── App.jsx         # App entry point
│   └── .env                # Client environment variables
└── docs/                   # Specifications
    ├── spec/               # Build spec (split by section)
    └── mrp-system-requirements.md
```

## Useful Commands

| Command | Location | Description |
|---------|----------|-------------|
| `docker-compose up -d` | root | Start PostgreSQL |
| `docker-compose down` | root | Stop PostgreSQL |
| `npm run dev` | server/ | Start backend (nodemon) |
| `npm run dev` | client/ | Start frontend (Vite) |
| `npx prisma migrate dev` | server/ | Run database migrations |
| `npx prisma studio` | server/ | Open database GUI |
| `npx prisma generate` | server/ | Regenerate Prisma client |

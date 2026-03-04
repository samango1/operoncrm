# OperonCRM

CRM monorepo:
- `client` - frontend on `Next.js` + `TypeScript`
- `server` - API on `Django` + `DRF` + `JWT`
- `docker-compose*.yml` + `configuration/*` - container setup and `Traefik`

## Product Idea

The core goal of the project is to simplify UX/UI as much as possible, including for users with low digital literacy.

The role model is designed as follows:
- `agent` acts as a personal assistant for a `member`
- `agent` handles workspace setup and configuration
- `member` operates in a ready-made workspace and enters business data

Example: some entities (for example, categories) are not meant to be changed by a member directly; this is an agent/admin responsibility.

## Engineering Principles

- `DRY`: avoid duplicated logic
- `Single Responsibility`: split responsibilities by layers/modules
- strict typing:
  - frontend: `TypeScript` types in `client/src/types/api/*`
  - backend: API contract via `drf-spectacular` (OpenAPI/Swagger)

## What the System Covers

The platform includes:
- users (`admin` / `agent` / `member`)
- companies and company memberships
- clients
- transactions and transaction categories
- products, services, service deliveries
- company statistics

## Project Structure

- `client/src/app/*` - pages and routing
- `client/src/components/*` - UI components
- `client/src/lib/api.ts` - frontend API client
- `client/src/types/api/*` - API contract types
- `server/apps/users/*` - users, roles, JWT
- `server/apps/crm/*` - CRM domain
- `server/config/settings/base.py` - shared defaults for all environments
- `server/config/settings/dev.py` - local development (`SQLite`)
- `server/config/settings/prod.py` - production (`PostgreSQL`)

## API Documentation

After backend startup:
- Swagger UI: `http://127.0.0.1:9999/api/docs/`
- ReDoc: `http://127.0.0.1:9999/api/redoc/`
- OpenAPI schema: `http://127.0.0.1:9999/api/schema/`

Generate and validate schema locally:
```bash
cd server
python manage.py spectacular --file /tmp/schema.yaml --validate
```

## Local Run (Recommended, Without Docker)

### 1) Backend

```bash
cd server
cp .env.example .env
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:9999
```

By default, `config.settings.dev` is used (SQLite), unless overridden in `.env`.

### 2) Frontend (new terminal)

```bash
cd client
cp .env.example .env
```

Minimum values for `client/.env`:
```dotenv
ROOT_DOMAIN=operoncrm.d
NEXT_PUBLIC_ROOT_DOMAIN=operoncrm.d
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:9999/api
```

Run:
```bash
npm install
npm run dev
```

Check:
- frontend: `http://127.0.0.1:3333`
- API docs: `http://127.0.0.1:9999/api/docs/`

## Local Run with Docker (Dev Stack)

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Important:
- `docker-compose.dev.yml` does not publish `client/server` ports to the host
- to access from host, add `ports` mappings or use an external reverse proxy

## Production Run

Production stack is started from `docker-compose.yml`:
```bash
docker compose up -d --build
```

Services:
- `traefik` (TLS, domain-based routing)
- `client`
- `server`

Requirements for production:
- provide `client/.env` and `server/.env`
- set `DJANGO_SETTINGS_MODULE=config.settings.prod`
- available PostgreSQL (not started by `docker-compose.yml`; expected external/separate DB)
- valid DNS records for domains (`operoncrm.uz`, `api.operoncrm.uz`, etc.)

SSL note:
- due to limited infrastructure resources, a full wildcard SSL setup was not feasible in this project
- current workaround: domains are explicitly enumerated in Traefik router rules/labels (see `docker-compose.yml`)

Example `server/.env` (prod):
```dotenv
DJANGO_SETTINGS_MODULE=config.settings.prod
POSTGRES_DB=operoncrm
POSTGRES_HOST=<postgres-host>
POSTGRES_PASSWORD=<postgres-password>
POSTGRES_PORT=5432
POSTGRES_USER=<postgres-user>
DEBUG=False
SECRET_KEY=<strong-secret>
```

## What to Use and Test

1. Open Swagger `api/docs` and get JWT via `POST /api/token/`.
2. Click `Authorize` and paste `Bearer <access_token>`.
3. Run a basic flow:
   - `companies`
   - `clients/products/services`
   - `transactions`
   - `companies/{id}/statistics`
4. For tenant scenarios, verify `admin/agent/member` access differences.

## Configuration and Deployment

- `server/.env.example`, `client/.env.example` - environment variable templates
- `docker-compose.yml` - production compose + Traefik labels
- `docker-compose.dev.yml` - dev compose
- `configuration/traefik.yml` - entrypoints and Let's Encrypt
- `configuration/config.yml` - middleware rules
- `.github/workflows/main.yml` - auto-deploy on push to `main` (self-hosted runner)

## Useful Commands

Formatting:
```bash
./precommit.sh
```

Frontend type-check:
```bash
cd client
npx tsc --noEmit
```

Django check:
```bash
cd server
python manage.py check
```

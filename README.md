# moose-web-app-lite

A lightweight version of [moose-web-app-template](https://github.com/alsersugasawa/moose-web-app-template) — stripped down to the essentials with zero external service dependencies.

## What's included

- **FastAPI** backend with async SQLAlchemy
- **SQLite** database via aiosqlite (no PostgreSQL needed)
- **JWT authentication** — register, login, logout
- **Password reset** — token-based (returns token in response when SMTP is not configured)
- **Profile management** — display name, bio
- **Admin panel** — user list, enable/disable, promote/demote, delete
- **Security** — bcrypt passwords, security headers, in-memory rate limiting, input sanitization
- **Vanilla JS + CSS frontend** — no build step, no framework

## What's removed vs the full template

| Feature | Full template | Lite |
|---|---|---|
| Database | PostgreSQL + replicas | SQLite |
| Cache / queue | Redis + ARQ worker | None |
| OAuth | Google, GitHub | None |
| 2FA | TOTP | None |
| WebSockets | Real-time notifications | None |
| Infrastructure | Docker + Kubernetes + Caddy | Docker + Kubernetes |
| Observability | Prometheus, OpenTelemetry, Sentry | Logging only |
| Feature flags | Yes | No |
| Webhooks | Yes | No |
| Invitations | Yes | No |
| Backup system | SMB/NFS | No |

## Quick start

```bash
# 1. Clone and enter
git clone <repo-url>
cd moose-web-app-lite

# 2. Copy env file
cp .env.example .env

# 3. Install and run
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://localhost:8000/static/index.html

## Docker

```bash
cp .env.example .env
docker compose up --build
```

## Kubernetes

Manifests live in [k8s/](k8s/). The setup creates a `moose` namespace with a Deployment, Service, PersistentVolumeClaim (for SQLite), ConfigMap, Secret, and Ingress.

### Local cluster (minikube)

```bash
# 1. Build the image inside minikube's Docker daemon
eval $(minikube docker-env)
docker build -t moose-web-app-lite:latest .

# 2. Set your secret key
kubectl create secret generic moose-secret \
  --namespace moose \
  --from-literal=SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

# 3. Apply all manifests (skip secret.yaml since we created it above)
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# 4. Enable ingress and apply (optional)
minikube addons enable ingress
kubectl apply -f k8s/ingress.yaml

# 5. Access
minikube tunnel   # then open http://moose.local/static/index.html
# or without ingress:
kubectl port-forward -n moose svc/moose 8000:80
```

### Local cluster (kind)

```bash
# 1. Build image and load into kind
docker build -t moose-web-app-lite:latest .
kind load docker-image moose-web-app-lite:latest

# 2. Apply manifests (same steps 2–5 as above, install ingress-nginx separately)
```

### Remote cluster

Update the `image:` field in [k8s/deployment.yaml](k8s/deployment.yaml) to point to your registry:

```yaml
image: ghcr.io/<your-org>/moose-web-app-lite:latest
```

Then push your image and apply the manifests.

### Useful kubectl commands

```bash
kubectl get all -n moose                          # overview
kubectl logs -n moose deploy/moose -f             # tail logs
kubectl exec -n moose deploy/moose -- sqlite3 /app/data/app.db \
  "UPDATE users SET is_admin=1 WHERE email='you@example.com';"  # promote admin
kubectl rollout restart -n moose deploy/moose     # restart pod
kubectl delete namespace moose                     # tear down everything
```

> **Note:** SQLite requires `replicas: 1` and `strategy: Recreate`. To scale horizontally, change `DATABASE_URL` to a PostgreSQL instance.

## Environment variables

See [.env.example](.env.example) for all options. Key variables:

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | (change this!) | JWT signing secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token lifetime |
| `INVITE_ONLY` | `false` | Disable public registration |
| `APP_ENV` | `development` | Hides API docs in `production` |
| `SMTP_HOST` | (blank) | Leave blank to get reset tokens in API response |

## Creating the first admin

Register normally, then promote via SQLite:

```bash
sqlite3 data/app.db "UPDATE users SET is_admin=1 WHERE email='you@example.com';"
```

## API docs

Available at http://localhost:8000/api/docs (development mode only).

## Project structure

```
app/
  main.py          # FastAPI app, middleware, lifespan
  settings.py      # Pydantic settings from env
  database.py      # Async SQLAlchemy + SQLite
  models.py        # User, PasswordResetToken
  schemas.py       # Pydantic request/response models
  security.py      # JWT, bcrypt, rate limiter, sanitization
  routers/
    auth.py        # Register, login, profile, password reset
    admin.py       # User management (admin only)
    health.py      # GET /api/health
static/
  index.html       # Auth + user dashboard SPA
  app.js           # Frontend logic
  styles.css       # Shared styles
  admin.html       # Admin panel
  admin.js         # Admin panel logic
  admin-styles.css # Admin styles
k8s/
  namespace.yaml   # moose namespace
  configmap.yaml   # non-sensitive env vars
  secret.yaml      # SECRET_KEY (replace before use)
  pvc.yaml         # 1Gi PVC for SQLite data
  deployment.yaml  # Deployment (replicas: 1, Recreate strategy)
  service.yaml     # ClusterIP service on port 80
  ingress.yaml     # Ingress (nginx) for moose.local
```

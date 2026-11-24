# Deployment

Target: a single Linux VM (Ubuntu 24.04 LTS or Debian 12) with natively installed PostgreSQL, Node.js 22 LTS, nginx and systemd. One API process only until throttle counters move to Postgres (LL-100).

## 1. Host preparation

```bash
sudo apt install -y nginx postgresql postgresql-contrib
# Node 22 from your distribution's NodeSource/apt repository or the official tarball under /usr/local
sudo useradd --system --home /opt/ledgerline --shell /usr/sbin/nologin ledgerline
sudo -u postgres createuser ledgerline
sudo -u postgres createdb -O ledgerline ledgerline
sudo install -d -o ledgerline -m 750 /opt/ledgerline/releases /var/backups/ledgerline
sudo install -d -m 750 /etc/ledgerline
```

`/etc/ledgerline/ledgerline.env` (mode 600, owner root):

```bash
NODE_ENV=production
API_HOST=127.0.0.1
API_PORT=4101
APP_ORIGIN=https://ledger.example.com
DATABASE_URL=postgres:///ledgerline?host=/var/run/postgresql
DATABASE_POOL_MAX=20
SESSION_SECRET=<64 hex chars from: openssl rand -hex 32>
SESSION_TTL_HOURS=10
LOG_LEVEL=info
TRUST_PROXY=1
```

`TRUST_PROXY=1` trusts exactly one hop (the local nginx). Use an IP/CIDR list if a load balancer sits in front. Never leave it unset in production: the API refuses to start.

## 2. Build and release layout

Build on a CI runner or build host with the same Node major:

```bash
npm ci
npm run build              # apps/api/dist (bundled with the shared package) + apps/web/dist
npm prune --omit=dev
tar czf ledgerline-$(git rev-parse --short HEAD).tgz package.json package-lock.json node_modules apps/api/dist apps/api/migrations apps/api/package.json apps/web/dist
```

On the VM:

```
/opt/ledgerline/releases/<version>/   unpacked tarball
/opt/ledgerline/current -> releases/<version>
```

## 3. systemd unit

`/etc/systemd/system/ledgerline-api.service`:

```ini
[Unit]
Description=Ledgerline API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=ledgerline
Group=ledgerline
WorkingDirectory=/opt/ledgerline/current/apps/api
EnvironmentFile=/etc/ledgerline/ledgerline.env
Environment=MIGRATIONS_DIR=/opt/ledgerline/current/apps/api/migrations
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=3
TimeoutStopSec=20
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/ledgerline
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now ledgerline-api
```

## 4. nginx

```nginx
server {
  listen 443 ssl http2;
  server_name ledger.example.com;
  ssl_certificate     /etc/ssl/ledger/fullchain.pem;
  ssl_certificate_key /etc/ssl/ledger/privkey.pem;

  root /opt/ledgerline/current/apps/web/dist;
  add_header Strict-Transport-Security "max-age=31536000" always;
  add_header Content-Security-Policy "default-src 'self'; frame-ancestors 'none'" always;

  client_max_body_size 1m;

  location /api/ {
    proxy_pass http://127.0.0.1:4101;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;   # overwrite, do not append client-supplied values
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-Id $request_id;
    proxy_read_timeout 60s;
  }

  location / {
    try_files $uri /index.html;
  }
}
server { listen 80; server_name ledger.example.com; return 301 https://$host$request_uri; }
```

Setting `X-Forwarded-For $remote_addr` (rather than appending) means the one trusted hop always reports the real client address.

## 5. Release procedure

1. Take a backup: `pg_dump --format=custom ... ledgerline` (see runbook).
2. Unpack the release to `/opt/ledgerline/releases/<version>`.
3. Run migrations from the new release (forward-only, each file in its own transaction, advisory-locked):
   `sudo -u ledgerline node --env-file=/etc/ledgerline/ledgerline.env /opt/ledgerline/releases/<version>/apps/api/dist/db/cli.js migrate` (run with `MIGRATIONS_DIR` pointing at the release's `apps/api/migrations`).
4. Switch the symlink: `ln -sfn releases/<version> /opt/ledgerline/current`.
5. `sudo systemctl restart ledgerline-api`; check `curl -fsS http://127.0.0.1:4101/api/v1/ready`.
6. Smoke test: sign in, open a trial balance.

Migrations must be **backward compatible with the previous release** (expand/contract): add columns nullable or with defaults, backfill, switch code, and drop old columns only in a later release. That keeps rollback a symlink flip.

## 6. Rollback

- **Code only:** point `current` back at the previous release and restart. Safe whenever migrations followed expand/contract.
- **Schema problem:** there are no down migrations. Either ship a corrective forward migration, or stop the API and restore the pre-release backup (runbook §4), accepting loss of writes since the backup.

## 7. Scaling notes

- Vertical first: more CPU for scrypt and posting, `DATABASE_POOL_MAX` ≤ Postgres `max_connections` minus admin headroom.
- A second API instance requires LL-100 (shared throttle counters) and sticky-free sessions (already in Postgres).
- Read-heavy reporting can use a streaming replica once report queries accept slight lag; summary tables (LL-096) come first.

## 8. Operating PostgreSQL

- Version 15 or newer; `postgresql-contrib` for `btree_gist`.
- Suggested settings for a 4 GB VM: `shared_buffers=1GB`, `work_mem=16MB`, `maintenance_work_mem=256MB`, `wal_compression=on`.
- Enable `log_min_duration_statement=500ms` to spot slow reports.

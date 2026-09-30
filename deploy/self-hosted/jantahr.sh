#!/bin/sh
# JantaHR self-hosted: Supabase (Postgres 17 + OrioleDB) + JantaHR API + web app.
#   ./jantahr.sh setup   create .env with fresh secrets (run once)
#   ./jantahr.sh up      build and start everything
#   ./jantahr.sh down    stop (data is kept in supabase/volumes)
#   ./jantahr.sh logs [service]
#   ./jantahr.sh ps
set -e
cd "$(dirname "$0")"
COMPOSE="docker compose --env-file .env -f supabase/docker-compose.yml -f docker-compose.jantahr.yml"
rand() { openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-"$1"; }

case "$1" in
  setup)
    if [ -f .env ]; then echo ".env already exists; delete it to regenerate secrets"; exit 1; fi
    cp supabase/.env.example .env
    # Supabase secrets + signed anon/service keys (official generator)
    (cd supabase && cp ../.env .env && sh utils/generate-keys.sh --update-env >/dev/null && mv .env ../.env)
    sed -i.bak "s/^REGION=.*/REGION=ap-south-1/; s/^STORAGE_TENANT_ID=.*/STORAGE_TENANT_ID=jantahr/; s/^GLOBAL_S3_BUCKET=.*/GLOBAL_S3_BUCKET=jantahr-storage/; s/^POOLER_TENANT_ID=.*/POOLER_TENANT_ID=jantahr/" .env && rm -f .env.bak
    cat .env.jantahr.example >> .env
    for k in JANTAHR_JWT_SECRET JANTAHR_ENCRYPTION_KEY CRON_SECRET JOBS_DISPATCH_SECRET; do
      sed -i.bak "s/^$k=.*/$k=$(rand 48)/" .env && rm -f .env.bak
    done
    sed -i.bak "s/^S3_PROTOCOL_ACCESS_KEY_ID=.*/S3_PROTOCOL_ACCESS_KEY_ID=$(openssl rand -hex 16)/; s/^S3_PROTOCOL_ACCESS_KEY_SECRET=.*/S3_PROTOCOL_ACCESS_KEY_SECRET=$(openssl rand -hex 32)/" .env && rm -f .env.bak
    echo "Wrote .env. Review SITE_URL, SUPABASE_PUBLIC_URL, SMTP_* and DASHBOARD_PASSWORD, then run ./jantahr.sh up"
    ;;
  up) $COMPOSE up -d --build ;;
  down) $COMPOSE down ;;
  logs) shift; $COMPOSE logs -f "$@" ;;
  ps) $COMPOSE ps ;;
  *) sed -n '2,8p' "$0" ;;
esac

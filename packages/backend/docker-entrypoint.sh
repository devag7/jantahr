#!/bin/sh
set -e
echo "Applying database migrations…"
npx prisma migrate deploy
if [ "$SEED_DEMO_DATA" = "true" ]; then
  echo "SEED_DEMO_DATA=true — this needs ts-node; run the seed from a dev checkout instead."
fi
exec node dist/main

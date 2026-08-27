#!/bin/bash
# Deploy script that disables Vercel Deployment Protection after deploy
set -e

echo "🚀 Deploying to Vercel..."
cd "$(dirname "$0")"
vercel --prod --yes

echo "🔓 Disabling deployment protection..."
vercel project protection disable --sso

echo "✅ Deploy complete! Server: https://minecraft-launcher-updates.vercel.app"
echo "   Testing heartbeat..."
sleep 3
curl -s "https://minecraft-launcher-updates.vercel.app/api/heartbeat" | head -c 200
echo ""

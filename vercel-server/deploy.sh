#!/bin/bash
# Deploy script — MUST disable protection BEFORE deploy
set -e

cd "$(dirname "$0")"

echo "🔓 Step 1: Disable deployment protection..."
vercel project protection disable --sso

echo "🚀 Step 2: Deploy to production..."
vercel --prod --yes

echo "🔓 Step 3: Disable protection again (just in case)..."
vercel project protection disable --sso

echo ""
echo "✅ Deploy complete!"
echo "   URL: https://minecraft-launcher-updates.vercel.app"
echo ""
echo "   Testing..."
sleep 3
curl -s "https://minecraft-launcher-updates.vercel.app/api/heartbeat" | head -c 200
echo ""

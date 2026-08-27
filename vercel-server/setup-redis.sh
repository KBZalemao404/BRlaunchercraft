#!/bin/bash
# ═══════════════════════════════════════════════════════
#  Setup Upstash Redis for Update Server
# ═══════════════════════════════════════════════════════
set -e

echo "═══════════════════════════════════════════════════"
echo "  🗄️  Setup Upstash Redis"
echo "═══════════════════════════════════════════════════"
echo ""
echo "1. Abra https://upstash.com (crie conta grátis)"
echo "2. Clique em 'Create Database'"
echo "3. Escolha: Region = São Paulo, Type = Free"
echo "4. Copie as credenciais REST"
echo ""

read -p "📋 Cole o UPSTASH_REDIS_REST_URL: " REDIS_URL
read -p "📋 Cole o UPSTASH_REDIS_REST_TOKEN: " REDIS_TOKEN

if [ -z "$REDIS_URL" ] || [ -z "$REDIS_TOKEN" ]; then
  echo "❌ URL e Token são obrigatórios!"
  exit 1
fi

echo ""
echo "🚀 Configurando no Vercel..."
cd "$(dirname "$0")"

echo "$REDIS_URL" | vercel env add UPSTASH_REDIS_REST_URL production
echo "$REDIS_TOKEN" | vercel env add UPSTASH_REDIS_REST_TOKEN production

echo ""
echo "🔄 Redeploying..."
vercel --prod --yes

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Redis configurado e servidor atualizado!"
echo ""
echo "  🌐 https://minecraft-launcher-updates.vercel.app"
echo "═══════════════════════════════════════════════════"

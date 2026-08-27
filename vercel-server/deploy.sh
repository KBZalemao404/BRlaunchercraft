#!/bin/bash
# ═══════════════════════════════════════════════════════
#  Minecraft Launcher — Deploy Script para Vercel
# ═══════════════════════════════════════════════════════
set -e

echo "═══════════════════════════════════════════════════"
echo "  🚀 Minecraft Launcher — Update Server Deploy"
echo "═══════════════════════════════════════════════════"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Instalando Vercel CLI..."
    npm install -g vercel
fi

# Check if logged in
echo "🔑 Verificando login Vercel..."
if ! vercel whoami &> /dev/null; then
    echo "❌ Não está logado. Execute: vercel login"
    exit 1
fi

echo "✅ Logado como: $(vercel whoami)"
echo ""

# Deploy to production
echo "🚀 Fazendo deploy para produção..."
vercel --prod --yes

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Deploy concluído!"
echo ""
echo "  🌐 Admin Panel: https://$(vercel ls --scope=$(vercel whoami) | grep minecraft | awk '{print $1}' | head -1)/admin.html"
echo ""
echo "  Próximos passos:"
echo "  1. Acesse o admin panel"
echo "  2. Configure o ADMIN_TOKEN"
echo "  3. Publique a primeira versão"
echo "  4. Inicie o ping: node ping.js"
echo "═══════════════════════════════════════════════════"

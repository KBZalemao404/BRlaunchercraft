# 🔄 Minecraft Launcher — Update Server (Vercel)

Servidor de atualização para o Minecraft Launcher, hospedado na Vercel.

## Arquitetura

```
Launcher (Electron)                    Vercel Serverless
┌──────────────────┐                   ┌──────────────────────┐
│  updater.ts      │ ──heartbeat 1s──► │  /api/heartbeat      │
│                  │ ──check update───► │  /api/update         │
│                  │ ──track download──►│  /api/download       │
└──────────────────┘                   └──────────────────────┘
                                              │
                                       ┌──────┴───────┐
                                       │  Admin Panel  │
                                       │  /admin.html  │
                                       └──────────────┘
```

## Endpoints Públicos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/update?current=1.0.0` | Verificar se há atualização disponível |
| `POST` | `/api/heartbeat` | Heartbeat do launcher (mantém servidor ativo) |
| `GET` | `/api/heartbeat` | Status do servidor |
| `POST` | `/api/download` | Registrar download de uma versão |

## Endpoints Admin (requer `X-Admin-Token`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/versions` | Listar todas as versões |
| `POST` | `/api/versions` | Criar nova versão |
| `PUT` | `/api/versions` | Atualizar versão |
| `DELETE` | `/api/versions?version=x` | Deletar versão |
| `GET` | `/api/admin/stats` | Estatísticas do servidor |

## Deploy

### 1. Instalar Vercel CLI
```bash
npm i -g vercel
```

### 2. Login
```bash
vercel login
```

### 3. Deploy
```bash
cd vercel-server
vercel --prod
```

### 4. Configurar variáveis de ambiente
```bash
vercel env add ADMIN_TOKEN
# Digite um token seguro, ex: "minha-chave-secreta-123"

vercel env add KV_REST_API_URL    # Opcional: para Vercel KV
vercel env add KV_REST_API_TOKEN  # Opcional: para Vercel KV
```

### 5. Ativar Vercel KV (opcional, para persistência)
```bash
vercel kv enable
```

## Usando o Painel Admin

1. Acesse `https://seu-app.vercel.app/admin.html`
2. Digite o token de admin
3. Publique novas versões

## Heartbeat (manter servidor ativo)

O launcher envia um heartbeat a cada 1 segundo para o servidor.
Para manter o servidor ativo manualmente:

```bash
cd vercel-server
SERVER_URL=https://seu-app.vercel.app node ping.js
```

## Publicando uma nova versão

### Via Admin Panel
Acesse `/admin.html` e preencha o formulário.

### Via API
```bash
curl -X POST https://seu-app.vercel.app/api/versions \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: seu-token" \
  -d '{
    "version": "1.1.0",
    "channel": "latest",
    "fileUrl": "https://github.com/Freebuff/minecraft-launcher/releases/download/v1.1.0/MinecraftLauncherSetup-1.1.0.exe",
    "fileSize": 87000000,
    "releaseNotes": "- Novo sistema de atualização\n- Correções de bugs"
  }'
```

## Storage

- **Desenvolvimento**: Armazenamento em memória (reinicia a cada cold start)
- **Produção**: Vercel KV (Redis) para persistência entre deploys

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `ADMIN_TOKEN` | ✅ | Token de autenticação para endpoints admin |
| `KV_REST_API_URL` | ❌ | URL do Vercel KV |
| `KV_REST_API_TOKEN` | ❌ | Token do Vercel KV |
| `UPDATE_SERVER_URL` | ❌ | URL do server (no launcher, default: Vercel URL) |

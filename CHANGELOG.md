# 📋 Changelog — Minecraft Launcher

Todas as mudanças notáveis neste projeto são documentadas neste arquivo.
O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [0.1.5] — 2026-08-27

### ✨ Funcionalidades
- Sistema de comandos de desenvolvimento (.commands.md)
- `/v` para release completo automático
- `/b` para build
- `/d` para deploy Vercel
- `/g` para git push
- `/r` para release GitHub

---

## [0.1.3] — 2026-08-27

### 🔧 Correções
- Minecraft crash exit code 1: gamePath apontava para subpasta da instância em vez da raiz
- resourcePath adicionado ao launch() para encontrar arquivos de versão
- Fallback launch corrigido para usar rootGamePath no assetsDir
- @xmcl/installer@4.2.0 + @xmcl/core@2.10.1 integrados como core do download
- Versão sempre atualizada para evitar conflitos

---

## [0.1.2] — 2026-08-27

### 🔧 Correções de Erros (Críticos)
- **Downloads nunca iniciavam** — `addTask()` adicionava tasks ao Map mas nunca colocava na `queue`, então `processQueue()` nunca processava nada
- **Servidor Vercel 404** — `Deployment Protection` (SSO) estava ativo, bloqueando todas as APIs com redirect para login
- Storage Vercel agora usa `KV_REST_API_URL` + `KV_REST_API_TOKEN` como fallback (dados persistem entre requests)

### ⚡ Melhorias
- Bibliotecas nativas tratadas por plataforma (natives-windows, natives-osx, natives-linux)
- Progresso mostra contagem de erros em vez de crashar
- Try/catch por arquivo em cada download de library/asset

### ✨ Atualização In-App (Nova)
- Download direto no launcher (sem abrir navegador)
- Barra de progresso com velocidade (MB/s) e ETA
- Botão cancelar download
- Endpoint `/api/fetch-update` proxy no Vercel
- Após download: executa .exe e fecha o launcher automaticamente

### 📦 Infraestrutura
- Deploy Vercel: `project protection disable --sso` para liberar APIs públicas
- GitHub Release v0.1.2 com instalador publicado
- Novo instalador gerado

---

## [0.1.1] — 2026-08-27

### 🚀 Lançamento (Alpha) — Correções + Auto-Start

### ✅ Funcionalidades Adicionadas
- **Auto-Start no Windows** — Iniciar launcher automaticamente com o Windows
- **Start Minimized** — Iniciar minimizado na bandeja do sistema
- **Minimize to Tray** — Minimizar para a bandeja ao fechar (em vez de fechar)
- **System Tray** — Ícone na bandeja com menu de contexto (Abrir / Fechar)
- **Single Instance Lock** — Impede múltiplas instâncias do launcher
- **Profile Manager** — Sistema completo de perfis com skins e estatísticas
- **Skin Manager** — Upload por URL ou arquivo, preview, modelo Classic/Slim

### 🔧 Correções de Erros
- **404 GitHub releases.atom** — Removido completamente o fallback do GitHub updater
- Updater agora usa **apenas** o servidor Vercel (zero referências ao GitHub)
- `electron-updater` removido das dependências (não mais necessário)
- `autoUpdater.checkForUpdates()` substituído por `checkForUpdatesViaServer()`
- Link do Changelog apontando para repositório correto (KBZalemao404/BRlaunchercraft)

### ⚡ Melhorias
- SettingsPage com seção de Inicialização (auto-start, start minimized)
- SettingsPage com toggle minimizeToTray na seção Launcher
- Verificação de `process.argv` para detectar auto-start (`--minimized`)
- Menu de contexto no tray com "Abrir Launcher" e "Fechar launcher"
- `app.requestSingleInstanceLock()` para prevenir instâncias duplicadas
- Rebuild completo sem cache — dist/ verificado sem referências GitHub

### 📦 Infraestrutura
- Versão unificada `0.1.1` em todos os 16 arquivos do projeto
- Atualização do CHANGELOG
- Novo instalador gerado

---

## [0.1.0] — 2026-08-26

### 🚀 Lançamento Oficial (Alpha)
> Primeira versão pública do Minecraft Launcher com todas as funcionalidades base.

### ✅ Funcionalidades Adicionadas
- **Login Microsoft** — Autenticação OAuth via Device Code Flow (sem armazenamento de senhas)
- **Modo Offline** — Login por nome de usuário para servidores cracked/offline
- **Instalador NSIS** — Instalador Windows com escolha de diretório e atalhos
- **Auto-Update** — Sistema de atualização automática via servidor Vercel
  - Verificação periódica (a cada 30 min)
  - Download e instalação com um clique
  - Barra de progresso em tempo real
  - Banner flutuante de notificação
- **Gerenciador de Versões** — Download e instalação de versões Minecraft (Release/Snapshot)
- **Gerenciador de Instâncias** — Múltiplas instâncias com configurações independentes
- **Sistema de Mods** — Instalação, remoção e toggle de mods (Fabric/Forge)
- **Gerenciador de Downloads** — Downloads paralelos com controle de concorrência
- **Configurações Completas** — Java, memória, resolução, tema, idioma
- **Console de Logs** — Visualização de logs do jogo em tempo real
- **News Feed** — Notícias do Minecraft.net
- **Splash Screen** — Tela de inicialização com verificação de servidor
- **Server Status Indicator** — Dot de status online/offline na barra de título

### 🌐 Servidor de Atualização (Vercel)
- API REST completa para gerenciamento de versões
- Heartbeat a cada 1 segundo para manter servidor ativo
- Painel admin com interface web para publicar versões
- Endpoints: `/api/update`, `/api/heartbeat`, `/api/versions`, `/api/download`
- Storage com Vercel KV (Redis) para persistência

### 🔧 Correções de Erros
- Corrigido `getVersionDirectory is not a function` — método inexistente no @xmcl/core
- Corrigido tsconfig `outDir` causando aninhamento duplo na compilação
- Corrigido electron-builder `winCodeSign` falha de symlinks no Windows
- Corrigido `WIN_CSC_LINK` resolução incorreta com string vazia
- Corrigido `sign: false` ainda invocando função de assinatura

### ⚡ Melhorias
- Splash screen com verificação de conexão ao servidor
- TituloBar com indicador de status do servidor em tempo real
- Sidebar mostra tipo de conta (Microsoft/Offline) com cores distintas
- LoginPage redesenhada com seleção de modo (Microsoft/Offline)
- Validação de username offline em tempo real (3-16 chars, alfanumérico)
- UUID offline determinístico (MD5 de OfflinePlayer:<name>)

### 📦 Infraestrutura
- `electron-updater` integrado para auto-update
- `electron-builder.yml` configurado para NSIS (Windows)
- Script `deploy.sh` para deploy automatizado no Vercel
- Script `ping.js` para manter servidor ativo externamente
- Variáveis de ambiente configuráveis via `.env`

---

## [0.0.1] — 2026-08-26

### 🚀 Lançamento Inicial (Development)
> Versão de desenvolvimento com funcionalidades base.

### ✅ Funcionalidades
- Estrutura base do Electron + React + TypeScript
- Login Microsoft (Device Code Flow)
- Gerenciador de versões Minecraft
- Gerenciador de instâncias
- Sistema de downloads
- Configurações do launcher
- Console de logs

### 📦 Build
- Build com Vite (renderer) + TypeScript (main)
- Estrutura de pastas organizada (main/renderer/shared)

---

## Formato de Versão

```
MAJOR.MINOR.PATCH[-prerelease]

MAJOR — Mudanças incompatíveis com versões anteriores
MINOR — Novas funcionalidades (compatível retroativamente)
PATCH — Correções de bugs

Prerelease: -alpha, -beta, -rc.1
```

### Status de Lançamento

| Tag | Significado |
|-----|-------------|
| `-alpha` | Em desenvolvimento, funcionalidades podem mudar |
| `-beta` | Estável, mas pode ter bugs menores |
| `-rc` | Release Candidate, pronto para lançamento |
| *(nenhum)* | Lançamento oficial e estável |

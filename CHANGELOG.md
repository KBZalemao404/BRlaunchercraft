# 📋 Changelog — Minecraft Launcher

Todas as mudanças notáveis neste projeto são documentadas neste arquivo.
O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

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

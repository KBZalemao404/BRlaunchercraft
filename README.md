# Minecraft Java Edition Launcher

Launcher profissional, completo e funcional para Minecraft Java Edition. Capacidade real de instalar versões, gerenciar instâncias, mods e iniciar o jogo.

## Tecnologias

- **Electron 28** — Desktop framework
- **TypeScript** — Type safety em todo o projeto
- **React 18** — Interface do renderer
- **Vite 5** — Bundler do renderer
- **@xmcl/core** — Parsing de versões e lançamento do Minecraft
- **@xmcl/installer** — Instalação de versões, Fabric e Forge
- **better-sqlite3** — Armazenamento local (SQLite)
- **electron-builder** — Empacotamento .exe

## Estrutura

```
minecraft-launcher/
├── src/
│   ├── shared/types.ts              # Tipos compartilhados
│   ├── main/                         # Electron main process (TypeScript)
│   │   ├── main.ts                   # Entry point + IPC handlers
│   │   ├── preload.ts                # Context bridge seguro
│   │   ├── auth/manager.ts           # Microsoft OAuth device code
│   │   ├── minecraft/versions.ts     # Versões via @xmcl/core + @xmcl/installer
│   │   ├── downloader/manager.ts     # Downloads paralelos com retry
│   │   ├── java/manager.ts           # Detecção multi-plataforma de Java
│   │   ├── instances/manager.ts      # Instâncias isoladas
│   │   ├── process/manager.ts        # Spawn do Minecraft via @xmcl/core
│   │   ├── mods/manager.ts           # Mods + Fabric/Forge via @xmcl/installer
│   │   ├── storage/database.ts       # SQLite para persistência
│   │   ├── security/security.ts      # Validação de hash, path sanitization
│   │   └── logger/logger.ts          # Logging com sanitização
│   └── renderer/                     # React frontend
│       ├── main.tsx                   # Entry point
│       ├── App.tsx                    # Estado + navegação
│       ├── styles/global.css          # Design system completo
│       ├── components/                # TitleBar, Sidebar
│       └── pages/                     # Home, Login, Versions, Instances,
│                                      # Mods, Downloads, Console, Settings
├── index.html
├── package.json
├── tsconfig.json                     # Renderer TS config
├── tsconfig.main.json                # Main process TS config
├── vite.config.ts                    # Vite build config
└── README.md
```

## Como Gerar o .exe

### Pré-requisitos
- [Node.js](https://nodejs.org/) 18+ (recomendado: LTS)
- Windows 10+ (para gerar .exe)
- npm (vem com Node.js)

### 1. Clonar e instalar dependências

```bash
git clone <repo-url>
cd minecraft-launcher
npm install
```

### 2. Desenvolvimento

```bash
npm run dev
```

Abre o Vite dev server + Electron com hot reload.

### 3. Build completo (gera o .exe)

```bash
npm run release
```

Ou passo a passo:

```bash
# Compila renderer (React → dist/renderer/)
npm run build:renderer

# Compila main process (TypeScript → dist/main/)
npm run build:main

# Gera o instalador NSIS .exe
npm run package
```

### 4. Resultado

Após `npm run release`, os arquivos ficam em:

```
release/
├── Minecraft Launcher Setup 1.0.0.exe    # Instalador NSIS
├── Minecraft Launcher-1.0.0.exe          # Executável portátil
└── ...
```

### 5. Instalador NSIS

O instalador gera:
- `MinecraftLauncherSetup.exe` — Instalador com:
  - Escolha de diretório
  - Atalho na área de trabalho
  - Atalho no menu iniciar
  - Desinstalação

## Como Testar o Launcher

### Teste completo:

1. **Abrir o launcher** — `npm run dev`
2. **Login Microsoft** — Clique em "Entrar com Microsoft", abra o link, digite o código
3. **Versões** — Navegue pela lista real do manifesto Mojang
4. **Instalar** — Clique "Baixar" em uma versão (ex: 1.21.4)
5. **Acompanhar download** — Barra de progresso real com velocidade
6. **Criar instância** — Vá em Instâncias → Criar
7. **Configurar RAM** — Ajuste nos sliders (mín/máx)
8. **Selecionar Java** — Auto-detect ou seleção manual
9. **Jogar** — Clique "Jogar" na instância
10. **Logs** — Acompanhe na aba Console
11. **Fechar jogo** — O launcher continua funcionando

### Detecção de Java:

O launcher detecta automaticamente:
- Eclipse Adoptium / Temurin
- Oracle JDK
- Amazon Corretto
- Azul Zulu
- Microsoft OpenJDK
- GraalVM
- Caminhos comuns no Windows, macOS e Linux

### Instalação de Modloaders:

- **Fabric** — Via `@xmcl/installer` com resolução automática de dependências
- **Forge** — Via `@xmcl/installer` com instalação do installer

## Autenticação

Utiliza Microsoft OAuth Device Code Flow:
1. O launcher solicita um device code
2. O usuário abre `microsoft.com/link` no navegador
3. Digita o código exibido no launcher
4. Autentica com sua conta Microsoft
5. O launcher obtém tokens Xbox Live → XSTS → Minecraft
6. Perfil do jogador é carregado
7. Tokens são renovados automaticamente

**Nunca** armazena senhas. Tokens são salvos com obfuscação em arquivo local.

## Segurança

- Validação SHA-1 de todos os downloads
- Sanitização de caminhos (anti path-traversal)
- Sem execução de arquivos arbitrários
- HTTPS para todas as comunicações
- Tokens ofuscados em disco
- Logs sanitizados (sem expor tokens)
- IPC seguro via contextBridge (sem nodeIntegration)

## Comandos Disponíveis

```bash
npm run dev              # Desenvolvimento com hot reload
npm run build            # Build completo (renderer + main)
npm run build:renderer   # Apenas React
npm run build:main       # Apenas main process
npm run package          # Build + gerar .exe
npm run release          # Build completo + instalador
npm run typecheck        # Verificar tipos
```

## Licença

MIT

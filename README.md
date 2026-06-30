# RescueRadio Web

Frontend operacional do RescueRadio. A aplicacao e um cockpit web para equipes
de resgate, com chat em tempo real como entrega principal da Entrega 3.

O app usa React, Vite, TanStack Router, Tailwind CSS, lucide-react e
Leaflet/OpenStreetMap. Em Docker, e servido como SPA estatica pelo Nginx, com
configuracao de runtime via `/config.js`.

## Objetivo da interface

A GUI substitui o uso via console/terminal. O operador deve conseguir:

- autenticar-se com JWT;
- completar onboarding operacional;
- entrar na Central de Comunicacao da propria base;
- receber briefing automatico ao conectar;
- enviar mensagens pressionando Enter;
- ver membros online/offline e status de conexao;
- resistir a quedas de conexao com reconexao silenciosa;
- visualizar mapa, operacoes, historico, perfil e, conforme role, gestao e
  observabilidade.

## Stack

- React 19.
- Vite 8.
- TypeScript.
- TanStack Router para rotas.
- TanStack Query como base para dados assincronos quando necessario.
- Tailwind CSS 4.
- lucide-react para icones.
- Leaflet/OpenStreetMap para mapa.
- Vitest e Testing Library para testes.
- Nginx para servir o build em container.

## Estrutura de pastas

```text
src/
  main.tsx                  # bootstrap React
  routes/
    __root.tsx              # raiz do TanStack Router
    auth.tsx                # login, bootstrap e cadastro por convite
    onboarding.tsx          # perfil inicial obrigatorio
    chat.tsx                # Central de Comunicacao
    map.tsx                 # mapa operacional
    operations.tsx          # operacoes ativas e chat de operacao
    history.tsx             # historico/auditoria
    observability.tsx       # links e status de ferramentas
    profile.tsx             # perfil operacional
    admin.tsx               # usuarios, convites e bases
  components/
    Shell.tsx               # layout, sidebar, topbar, status e notificacoes
    ChatRoom.tsx            # chat principal, briefing, reconexao e membros
    OccurrenceMap.tsx       # mapa Leaflet e marcadores
    OperationForm.tsx       # criacao de ocorrencia/operacao
    OperatorSelector.tsx    # selecao rapida de operadores
    ConfirmDialog.tsx       # modal reutilizavel de confirmacao
    RoleGuard.tsx           # protecao de rotas
    StatusBadge.tsx         # badges de status/prioridade
  lib/
    api.ts                  # cliente HTTP e config de runtime
    auth.tsx                # provider de autenticacao
    ws.ts                   # WebSocket do chat com reconexao
    notifications.ts        # WebSocket global de notificacoes
    rescueradio.ts          # normalizadores de dados da API
    geo.ts                  # dados geograficos locais e busca de municipios
    profileValidation.ts    # validacao de perfil/onboarding
    utils.ts                # helpers de UI
```

## Rotas e permissoes

| Rota | Nome na GUI | Acesso |
| --- | --- | --- |
| `/auth` | Login/cadastro/bootstrap | publico |
| `/onboarding` | Onboarding operacional | usuario autenticado sem perfil completo |
| `/chat` | Central de Comunicacao | admin, comandante, operador |
| `/map` | Mapa | admin, comandante, operador |
| `/operations` | Operacoes | admin, comandante, operador |
| `/history` | Historico | admin, comandante, operador |
| `/observability` | Observabilidade | admin, comandante |
| `/admin?section=users` | Gestao de Usuarios | admin |
| `/admin?section=bases` | Gestao de Bases | admin |
| `/profile` | Meu perfil | usuario autenticado |

Regras importantes:

- Operador ve apenas sua base e operacoes designadas.
- Comandante atua no escopo da propria UF.
- Admin ve o sistema inteiro.
- O item de perfil e acessado pelo bloco do usuario na sidebar.

## Chat: entrega principal

O componente `ChatRoom` implementa o fluxo mais importante do projeto:

- conecta no canal via `/ws/channel/{channel_id}?token={jwt}`;
- recebe `CONNECTED` e lista membros do canal;
- recebe `BRIEFING` e preenche automaticamente as ultimas mensagens;
- mostra separacao visual entre briefing e mensagens ao vivo;
- envia com Enter e usa Shift+Enter para quebra de linha;
- mostra operadores online e, com "Ver mais", operadores offline da base;
- exibe ultimo visto quando o operador esta offline;
- mostra estado de conexao, latencia aproximada e reconexao;
- bloqueia escrita em operacoes finalizadas;
- permite que admin limpe o chat do canal;
- remove tags textuais `[CRITICO]` e `[ALERTA]` do corpo, mantendo os
  indicadores visuais de prioridade.

Canais usados:

- `base:{base_id}:geral`
- `operacao:{operation_id}`

## Fluxo de usuario

1. Admin inicial usa bootstrap com `BOOTSTRAP_ADMIN_KEY`.
2. Admin entra na Gestao de Usuarios e cria convite.
3. Usuario convidado usa o codigo no cadastro.
4. Usuario completa onboarding.
5. Usuario entra no cockpit.
6. Operador usa a Central de Comunicacao da base.
7. Comandante/admin cria ocorrencia e operacao.
8. Operador designado recebe modal por push global.
9. Ao entrar no chat da operacao, recebe briefing do canal.
10. Ao finalizar, a operacao fica somente leitura e aparece no historico.

## Mapa e bases

O mapa usa Leaflet com tiles OpenStreetMap/CARTO. Ele exibe:

- ocorrencias ativas;
- marcador de auditoria vindo do historico;
- cobertura da base;
- cidades cobertas;
- centralizacao na base selecionada;
- busca local de municipios para criacao de bases.

Os dados geograficos ficam no frontend para manter a demo independente de
chaves externas. O backend persiste base, UF, coordenadas e cidades cobertas.

## Configuracao

Em desenvolvimento, use variaveis `VITE_*`:

```powershell
$env:VITE_API_BASE_URL="http://localhost:8001/api"
$env:VITE_WS_BASE_URL="ws://localhost:8000"
npm run dev
```

Padroes:

- HTTP: `http://localhost:8001/api`
- WebSocket: `ws://localhost:8000`

No container, a configuracao vem de variaveis sem rebuild:

```text
GATEWAY_HTTP_URL=http://localhost:8001/api
GATEWAY_WS_URL=ws://localhost:8000
```

O entrypoint do container gera `/config.js`, lido em tempo de execucao pelo
cliente.

## Desenvolvimento local

Requisitos:

- Node.js 22+.
- npm.
- API rodando diretamente ou pelo `rescueradio-infra`.

Instalacao:

```powershell
npm install
npm run dev
```

Abra a URL do Vite, normalmente:

- <http://localhost:3000>
- <http://localhost:5173>

## Build, lint e testes

```powershell
npm run lint
npm test
npm run test:coverage
npm run build
```

A cobertura minima configurada e 50% no recorte critico do frontend. Os testes
cobrem componentes reutilizaveis, normalizadores, notificacoes e mapa local.

## Docker

Build:

```powershell
docker build -t rescueradio-web:local .
```

Execucao isolada:

```powershell
docker run --rm -p 4200:80 `
  -e GATEWAY_HTTP_URL=http://localhost:8001/api `
  -e GATEWAY_WS_URL=ws://localhost:8000 `
  rescueradio-web:local
```

Ambiente completo:

```powershell
cd ..\rescueradio-infra
.\scripts\build-local-windows.ps1
docker compose up -d
```

Linux:

```bash
cd ../rescueradio-infra
./scripts/build-local-linux.sh
docker compose up -d
```

GUI:

- <http://localhost:4200>

## Cenarios manuais da Entrega 3

### Multiplas instancias

1. Abra duas abas em <http://localhost:4200>.
2. Entre com usuarios diferentes.
3. Complete onboarding dos usuarios.
4. Acesse a Central de Comunicacao.
5. Envie mensagens em uma aba e confirme recebimento na outra.

### Briefing automatico

1. Envie algumas mensagens no chat geral.
2. Abra nova aba ou outro navegador.
3. Entre com outro usuario da mesma base.
4. Ao conectar, as ultimas mensagens devem aparecer automaticamente como
   briefing.

### Reconexao silenciosa

1. Com a GUI aberta, reinicie a API:

   ```powershell
   docker compose restart api
   ```

2. O chat deve mostrar estado de reconexao.
3. A tela nao deve travar.
4. Quando a API voltar, o canal deve ser restabelecido.

### Operacao

1. Entre como comandante ou admin.
2. Crie uma ocorrencia/operacao.
3. Selecione operadores.
4. Entre no chat da operacao.
5. Finalize com `Sucesso` ou `Falha`.
6. Confira o registro no Historico.

### Observabilidade

1. Entre como admin ou comandante.
2. Abra Observabilidade.
3. Use os links para Swagger, Prometheus, Grafana e Loki.

Em producao, os links publicos sao:

- Prometheus: <https://prometheus.devflowapp.space>
- Grafana: <https://grafana.devflowapp.space>
- Loki: <https://loki.devflowapp.space>

## Solucao de problemas

- Tela nao conecta: confira se API esta em `8000` e Kong em `8001`.
- Login funciona, mas WebSocket nao: confira `GATEWAY_WS_URL`.
- Mudou API/Web e nada mudou no navegador: rode build das imagens e
  `docker compose up -d --force-recreate`.
- Operador nao ve uma operacao: confirme se ele foi designado ou se pertence ao
  escopo correto.
- Grafana pede login localmente: use `admin/admin`, salvo alteracao no `.env`.
  Em producao, use a credencial definida no deploy.

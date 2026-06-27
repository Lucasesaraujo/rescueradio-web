# RescueRadio Web

Frontend operacional do RescueRadio. A interface usa React, TanStack Router,
Tailwind, lucide-react e Leaflet/OpenStreetMap, com foco no chat em tempo real
como experiencia principal.

## Fluxo principal

1. O primeiro admin e criado por bootstrap; os demais usuarios entram por convite.
2. Usuario sem perfil completo passa pelo onboarding operacional.
3. O cockpit abre com sidebar para Central de Comunicacao, Mapa, Operacoes,
   Historico, Observabilidade e Gestao de Usuarios.
4. O chat geral usa o canal `base:{base_id}:geral`.
5. Chats de operacao usam `operacao:{operation_id}`.
6. Operacao finalizada bloqueia novas mensagens e mantem auditoria.
7. Operador designado recebe push global `OPERATION_ASSIGNED` e briefing modal.

## Desenvolvimento local

Requisitos:

- Node.js 22+
- npm

```bash
npm install
npm run dev
```

Abra a URL mostrada pelo Vite, normalmente `http://localhost:3000` ou
`http://localhost:5173`.

## Configuracao

Em desenvolvimento, o app le variaveis `VITE_*`:

```bash
VITE_API_BASE_URL=http://localhost:8001/api
VITE_WS_BASE_URL=ws://localhost:8000
```

No container, o Nginx serve `/config.js`, gerado no boot por:

```bash
GATEWAY_HTTP_URL=http://localhost:8001/api
GATEWAY_WS_URL=ws://localhost:8000
```

## Build

```bash
npm run build
```

O Dockerfile publica o conteudo estatico de `dist` no Nginx.

## Testes

```bash
npm test
npm run test:coverage
npm run lint
```

A configuracao atual exige cobertura minima de 50% para statements, branches,
functions e lines no recorte critico do frontend: dialogos reutilizaveis,
status, normalizadores, mapa local e notificacoes globais.

## Docker

```bash
docker build -t rescueradio-web:local .
docker run --rm -p 4200:80 ^
  -e GATEWAY_WS_URL=ws://localhost:8000 ^
  -e GATEWAY_HTTP_URL=http://localhost:8001/api ^
  rescueradio-web:local
```

Com o ambiente completo:

```bash
cd ..\rescueradio-infra
docker compose -f compose\docker-compose.yml up -d
```

Abra `http://localhost:4200`.

## Cenarios manuais

- Bootstrap: na tela de login, use "Configurar primeiro admin" e informe a
  `BOOTSTRAP_ADMIN_KEY` do backend.
- Convite: como admin, abra Gestao de Usuarios, gere um convite e use o codigo
  na tela de cadastro de um operador/comandante.
- Multiplas instancias: abra duas abas em `http://localhost:4200`, faca login
  com usuarios diferentes e entre na Central de Comunicacao.
- Briefing automatico: envie algumas mensagens em uma aba, abra uma nova aba
  com outro usuario da mesma base e confirme que as ultimas mensagens aparecem
  ao conectar.
- Reconexao: reinicie a API ou derrube a conexao; a tela deve mostrar
  reconexao silenciosa e voltar sem travar.
- Operacao: como comandante/admin, crie uma ocorrencia no mapa, selecione
  operadores, abra o chat da operacao, finalize e confira o historico.
- Resultado: ao finalizar uma operacao, selecione `Sucesso` ou `Falha`; o
  historico e o mapa usam esse resultado para o pin de auditoria.
- Mapa: defina coordenada e cidades cobertas na base. O mapa destaca uma
  cobertura local estimada a partir da coordenada da base, sem depender de
  geocoding externo durante a operacao.
- Observabilidade: acesse a pagina Observabilidade para links de API, Kong,
  Prometheus, Grafana e Loki.

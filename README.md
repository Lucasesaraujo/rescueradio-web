# RescueRadio Web

Aplicacao Angular do RescueRadio para comunicacao em tempo real entre equipes de resgate.

## Responsabilidades

- entrada no canal;
- chat em tempo real;
- exibicao do briefing;
- lista de membros ativos;
- eventos de conexao;
- cliente WebSocket;
- futuramente, login e controle de acesso por roles.

## Decisao tecnologica

O frontend utiliza Angular 21 com TypeScript. O Angular foi escolhido por
oferecer uma estrutura organizada para componentes, templates, estilos,
formularios e testes, alem de atualizacao reativa da interface durante o
recebimento de eventos em tempo real. O TypeScript tambem permite representar
explicitamente os contratos das mensagens WebSocket e reduzir erros de
integracao com a API.

Na arquitetura do RescueRadio, o navegador nao precisa conhecer diretamente o
container da API. O cliente abre uma conexao WebSocket com o Kong, que encaminha
o caminho `/ws` para o FastAPI. A interface interpreta os eventos de conexao,
briefing, mensagens e presenca, mantendo a lista de mensagens e socorristas
ativos visivel para o usuario.

## Estrutura de pastas

```text
rescueradio-web/
|-- src/
|   |-- app/                    # componente, template, estilos e testes
|   |-- index.html
|   |-- main.ts
|   `-- styles.css
|-- public/
|   |-- config.js               # configuracao usada no desenvolvimento
|   `-- config.template.js      # modelo preenchido no container
|-- docker-entrypoint.d/        # configuracao runtime do gateway
|-- Dockerfile
|-- angular.json
|-- package.json
`-- README.md
```

O modulo `src/app/runtime-config.ts` resolve a URL WebSocket do gateway. Em
container, o script de entrada gera a configuracao a partir de
`GATEWAY_WS_URL`, sem exigir um novo build do Angular.

## Desenvolvimento

Requisitos:

- Node.js 22;
- npm 10.

Instale as dependencias e inicie o servidor:

```bash
npm ci
npm start
```

A aplicacao fica disponivel em <http://localhost:4200>.

O cliente WebSocket usa `window.__RESCUERADIO_CONFIG__.gatewayWsUrl`. Sem uma
configuração explícita, usa o hostname da página e acessa o Kong pela porta
`8001`.

## Testes e build

```bash
npm test -- --watch=false
npm run build
```

## Docker

```bash
docker build -t rescueradio-web:local .
docker run --rm -p 4200:80 -e GATEWAY_WS_URL=ws://localhost:8001 rescueradio-web:local
```

Para executar o ambiente completo, use o repositorio `rescueradio-infra`.

## Fluxo de desenvolvimento

- `main`: homologação das versões aprovadas em `develop`;
- `develop`: desenvolvimento e integração das funcionalidades aprovadas;
- `feature/*`: desenvolvimento isolado, sempre criado a partir de `develop`.

As branches de funcionalidade devem voltar para `develop` por pull request
após a aprovação do CI. A promoção para homologação ocorre por pull request
de `develop` para `main`.

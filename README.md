# RescueRadio Web

Aplicação Angular do RescueRadio para comunicação em tempo real entre equipes de resgate.

## Responsabilidades

- entrada no canal;
- chat em tempo real;
- exibição do briefing;
- lista de membros ativos;
- eventos de conexão;
- cliente WebSocket com reconexão automática;
- futuramente, login e controle de acesso por roles.

## Decisão Tecnológica

O frontend utiliza Angular 21 com TypeScript. O Angular foi escolhido por
oferecer uma estrutura organizada para componentes, templates, estilos,
formulários e testes, além de atualização reativa da interface durante o
recebimento de eventos em tempo real. O TypeScript também permite representar
explicitamente os contratos das mensagens WebSocket e reduzir erros de
integração com a API.

Na arquitetura do RescueRadio, o navegador não precisa conhecer diretamente o
container da API. O cliente abre uma conexão WebSocket com o Kong, que encaminha
o caminho `/ws` para o FastAPI. A interface interpreta os eventos de conexão,
briefing, mensagens e presença, mantendo a lista de mensagens e socorristas
ativos visível para o usuário.

A Entrega 2 também possui um cliente de terminal no repositório
`rescueradio-api`. Esse cliente existe para validar o protocolo em um nível
mais baixo, via console, como exigido pela rubrica. A interface gráfica consome
o mesmo endpoint e o mesmo contrato WebSocket, mas representa a experiência
principal do produto.

## Comportamento Do Chat

O backend não ecoa `SEND_MESSAGE` para o próprio remetente. Por isso, a
interface adiciona localmente a mensagem enviada assim que o `socket.send()` é
executado com sucesso. Mensagens de outros socorristas, briefing, presença e
erros continuam vindo do servidor.

Se a conexão cair sem o usuário clicar em sair, a interface muda para
`Reconectando` e tenta abrir uma nova conexão automaticamente. Durante esse
período, o histórico permanece visível e o envio fica bloqueado até o WebSocket
voltar para `Conectado`.

## Estrutura de Pastas

```text
rescueradio-web/
|-- src/
|   |-- app/                    # componente, template, estilos e testes
|   |-- index.html
|   |-- main.ts
|   `-- styles.css
|-- public/
|   |-- config.js               # configuração usada no desenvolvimento
|   `-- config.template.js      # modelo preenchido no container
|-- docker-entrypoint.d/        # configuração runtime do gateway
|-- Dockerfile
|-- angular.json
|-- package.json
`-- README.md
```

O módulo `src/app/runtime-config.ts` resolve a URL WebSocket do gateway. Em
container, o script de entrada gera a configuração a partir de
`GATEWAY_WS_URL`, sem exigir um novo build do Angular.

## Desenvolvimento

Requisitos:

- Node.js 22;
- npm 10.

Instale as dependências e inicie o servidor:

```bash
npm ci
npm start
```

A aplicação fica disponível em <http://localhost:4200>.

O cliente WebSocket usa `window.__RESCUERADIO_CONFIG__.gatewayWsUrl`. Sem uma
configuração explícita, usa o hostname da página e acessa o Kong pela porta
`8001`.

## Testes e Build

```bash
npm test -- --watch=false
npm run build
```

## Docker

```bash
docker build -t rescueradio-web:local .
docker run --rm -p 4200:80 -e GATEWAY_WS_URL=ws://localhost:8001 rescueradio-web:local
```

Para executar o ambiente completo, use o repositório `rescueradio-infra`.

## Fluxo de Desenvolvimento

- `main`: homologação das versões aprovadas em `develop`;
- `develop`: desenvolvimento e integração das funcionalidades aprovadas;
- `feature/*`: desenvolvimento isolado, sempre criado a partir de `develop`.

As branches de funcionalidade devem voltar para `develop` por pull request
após a aprovação do CI. A promoção para homologação ocorre por pull request
de `develop` para `main`.

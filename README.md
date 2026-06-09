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

O cliente WebSocket usa o hostname da pagina e acessa o Kong pela porta `8001`.

## Testes e build

```bash
npm test -- --watch=false
npm run build
```

## Docker

```bash
docker build -t rescueradio-web:local .
docker run --rm -p 4200:80 rescueradio-web:local
```

Para executar o ambiente completo, use o repositorio `rescueradio-infra`.

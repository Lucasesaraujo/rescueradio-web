import { getGatewayWebSocketUrl } from './runtime-config';

describe('getGatewayWebSocketUrl', () => {
  afterEach(() => {
    delete window.__RESCUERADIO_CONFIG__;
  });

  it('uses the runtime gateway configuration', () => {
    window.__RESCUERADIO_CONFIG__ = {
      gatewayWsUrl: 'wss://gateway.example.com/',
    };

    expect(getGatewayWebSocketUrl()).toBe('wss://gateway.example.com');
  });

  it('falls back to the current hostname and Kong port', () => {
    expect(getGatewayWebSocketUrl()).toBe(`ws://${window.location.hostname}:8001`);
  });
});

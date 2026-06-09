export type RescueRadioRuntimeConfig = {
  gatewayWsUrl?: unknown;
};

declare global {
  interface Window {
    __RESCUERADIO_CONFIG__?: RescueRadioRuntimeConfig;
  }
}

export function getGatewayWebSocketUrl(): string {
  const runtimeValue = window.__RESCUERADIO_CONFIG__?.gatewayWsUrl;
  const configuredUrl = typeof runtimeValue === 'string' ? runtimeValue.trim() : '';

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:8001`;
}

export type RescueRadioRuntimeConfig = {
  gatewayWsUrl?: string;
};

declare global {
  interface Window {
    __RESCUERADIO_CONFIG__?: RescueRadioRuntimeConfig;
  }
}

export function getGatewayWebSocketUrl(): string {
  const configuredUrl = window.__RESCUERADIO_CONFIG__?.gatewayWsUrl?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:8001`;
}

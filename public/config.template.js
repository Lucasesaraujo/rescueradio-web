const gatewayWsUrlBase64 = '${GATEWAY_WS_URL_BASE64}';

window.__RESCUERADIO_CONFIG__ = {
  gatewayWsUrl: gatewayWsUrlBase64
    ? new TextDecoder().decode(
        Uint8Array.from(atob(gatewayWsUrlBase64), (character) => character.charCodeAt(0)),
      )
    : '',
};

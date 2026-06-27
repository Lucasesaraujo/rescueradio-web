const gatewayWsUrlBase64 = "${GATEWAY_WS_URL_BASE64}";
const gatewayHttpUrlBase64 = "${GATEWAY_HTTP_URL_BASE64}";

function decodeConfigValue(value) {
  try {
    return value ? atob(value) : "";
  } catch {
    return "";
  }
}

window.__RESCUERADIO_CONFIG__ = {
  gatewayWsUrl: decodeConfigValue(gatewayWsUrlBase64),
  gatewayHttpUrl: decodeConfigValue(gatewayHttpUrlBase64),
};

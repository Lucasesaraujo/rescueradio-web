#!/bin/sh
set -eu

export GATEWAY_WS_URL="${GATEWAY_WS_URL:-}"
export GATEWAY_WS_URL_BASE64
GATEWAY_WS_URL_BASE64="$(printf '%s' "$GATEWAY_WS_URL" | base64 | tr -d '\r\n')"

envsubst '${GATEWAY_WS_URL_BASE64}' \
  < /usr/share/nginx/html/config.template.js \
  > /usr/share/nginx/html/config.js

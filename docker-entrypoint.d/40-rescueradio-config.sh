#!/bin/sh
set -eu

export GATEWAY_WS_URL="${GATEWAY_WS_URL:-ws://localhost:8000}"
export GATEWAY_HTTP_URL="${GATEWAY_HTTP_URL:-http://localhost:8001/api}"
export GATEWAY_WS_URL_BASE64
export GATEWAY_HTTP_URL_BASE64

GATEWAY_WS_URL_BASE64="$(printf '%s' "$GATEWAY_WS_URL" | base64 | tr -d '\r\n')"
GATEWAY_HTTP_URL_BASE64="$(printf '%s' "$GATEWAY_HTTP_URL" | base64 | tr -d '\r\n')"

envsubst '${GATEWAY_WS_URL_BASE64} ${GATEWAY_HTTP_URL_BASE64}' \
  < /usr/share/nginx/html/config.template.js \
  > /usr/share/nginx/html/config.js

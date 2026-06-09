#!/bin/sh
set -eu

export GATEWAY_WS_URL="${GATEWAY_WS_URL:-}"
envsubst '${GATEWAY_WS_URL}' \
  < /usr/share/nginx/html/config.template.js \
  > /usr/share/nginx/html/config.js

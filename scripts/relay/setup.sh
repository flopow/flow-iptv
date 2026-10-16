#!/bin/bash
# ─────────────────────────────────────────────────────────────
# FLOW IPTV — setup do relay no VPS (Ubuntu 24.04).
# Instala ferramentas, cria estrutura, configura nginx.
# Uso: bash <(curl -sL https://raw.githubusercontent.com/flopow/flow-iptv/main/scripts/relay/setup.sh)
# ─────────────────────────────────────────────────────────────
set -e

echo "=== [1/4] INSTALANDO FERRAMENTAS ==="
sudo apt-get update -y >/dev/null 2>&1 || true
sudo apt-get install -y ffmpeg nginx curl jq

echo "=== [2/4] ESTRUTURA ==="
sudo mkdir -p /opt/relay/hls /opt/relay/api /opt/relay/logs
sudo chown -R $USER:$USER /opt/relay

echo "=== [3/4] NGINX ==="
sudo tee /etc/nginx/sites-available/relay > /dev/null << 'NGINX'
server {
  listen 8080;
  root /opt/relay;

  location /api/ {
    alias /opt/relay/api/;
    default_type application/json;
    add_header Access-Control-Allow-Origin *;
  }

  location /hls/ {
    alias /opt/relay/hls/;
    types {
      application/vnd.apple.mpegurl m3u8;
      video/mp2t ts;
    }
    add_header Access-Control-Allow-Origin *;
  }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/relay /etc/nginx/sites-enabled/relay
sudo nginx -t && sudo systemctl reload nginx

echo "=== [4/4] SCRIPT DO RELAY ==="
curl -sL https://raw.githubusercontent.com/flopow/flow-iptv/main/scripts/relay/start-relay.sh -o /opt/relay/start-relay.sh
chmod +x /opt/relay/start-relay.sh
curl -sL https://raw.githubusercontent.com/flopow/flow-iptv/main/data/catalog/live.json -o /opt/relay/live.json
COUNT=$(jq '[.[] | select(.enabled==true)] | length' /opt/relay/live.json)
echo "Canais ativos no catálogo: $COUNT"

echo "=== PRONTO ==="
echo "Para iniciar o relay: bash /opt/relay/start-relay.sh"

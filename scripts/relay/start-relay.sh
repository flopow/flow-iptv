#!/bin/bash
# ─────────────────────────────────────────────────────────────
# FLOW IPTV — relay de canais ao vivo (roda no VPS Ubuntu).
# Para cada canal ativo do catálogo, o ffmpeg re-empacota o HLS
# (-c copy, sem re-encode) e serve via nginx em /hls/<id>.
# A API /api/canais.json lista tudo com URLs do próprio VPS.
# ─────────────────────────────────────────────────────────────
set -e
cd /opt/relay

# limpa processos antigos
pkill -f 'ffmpeg.*-f hls' 2>/dev/null || true
sleep 1
mkdir -p logs

# baixa catálogo atualizado do GitHub
curl -sL https://raw.githubusercontent.com/flopow/flow-iptv/main/data/catalog/live.json -o live.json

COUNT=$(jq '[.[] | select(.enabled==true)] | length' live.json)
echo "Canais ativos: $COUNT"

# limpa HLS antigo
rm -rf hls/*

# gera a API com URLs do próprio servidor
IP=$(hostname -I | awk '{print $1}')
jq '[.[] | select(.enabled==true)] | map({id, name, category, src, url: ("http://'$IP':8080/hls/" + .id + "/index.m3u8")})' live.json > api/canais.json
echo "API: http://$IP:8080/api/canais.json"

# sobe um ffmpeg por canal (remux -c copy, leve)
jq -r '.[] | select(.enabled==true) | .id + "|" + .src' live.json | while IFS='|' read -r id src; do
  dir=/opt/relay/hls/$id
  mkdir -p "$dir"
  nohup ffmpeg -hide_banner -loglevel error \
    -headers "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36" \
    -i "$src" -c copy -f hls -hls_time 4 -hls_list_size 5 -hls_flags delete_segments \
    -hls_segment_filename "$dir/seg_%03d.ts" "$dir/index.m3u8" \
    > logs/$id.log 2>&1 &
done

echo "Relay iniciado. Teste: curl http://$IP:8080/hls/$(jq -r '.[] | select(.enabled==true) | .id' live.json | head -1)/index.m3u8"

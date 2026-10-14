# FLOW IPTV — Mídia

Repositório de **arquivos pequenos** do site FLOW IPTV (capas, backdrops e episódios de
dramas curtos). Serve como CDN via `raw.githubusercontent.com` — o site consome as URLs
direto deste repositório.

```
posters/    capas (pôsteres) dos títulos
backdrops/  imagens de fundo
videos/     episódios em MP4 (dramas curtos, <100 MB cada)
catalog/    metadados JSON exportados (shorts, media)
```

## Regras

- **Nunca** subir arquivos >100 MB (limite do GitHub).
- Vídeos grandes / séries completas → provider de mídia dedicado (R2/Stream), não aqui.
- Capas e metadados: somente conteúdo autorizado.
- Importação automatizada: `scripts/import-dramasite.mjs` (veja o repo principal).

> Não é servidor de streaming de vídeo de propósito geral — é a prateleira de mídia
> pequena do FLOW IPTV.

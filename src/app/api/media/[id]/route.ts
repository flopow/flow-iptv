import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { getCatalog } from "@/lib/catalog";

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
};

function mediaRoot(): string {
  const configured = process.env.MEDIA_ROOT?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), "public", "media");
}

// Streaming com suporte a Range (seek/scrub do player e retomada).
// - provider "local": arquivo do disco (MEDIA_ROOT);
// - provider "drive": proxy do Google Drive (servidor→servidor, porque o
//   navegador é bloqueado pelo CORS do drive.usercontent — o servidor não).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const catalog = await getCatalog();
  const media = await catalog.getMediaFile(id);
  if (!media || (media.provider !== "local" && media.provider !== "drive")) {
    return new Response("Não encontrado", { status: 404 });
  }

  // provider "drive": repassa Range pro Google e faz streaming de volta.
  if (media.provider === "drive") {
    const up = new URL(media.src);
    const range = req.headers.get("range");
    const upstream = await fetch(up, {
      headers: {
        Range: range ?? "bytes=0-",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!upstream.ok && upstream.status !== 206) {
      return new Response("Falha no upstream", { status: 502 });
    }
    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") ?? "video/mp4");
    headers.set("Cache-Control", "public, max-age=86400");
    const contentRange = upstream.headers.get("content-range");
    const contentLength = upstream.headers.get("content-length");
    if (contentRange) headers.set("Content-Range", contentRange);
    if (contentLength) headers.set("Content-Length", contentLength);
    if (upstream.status === 206 || range) {
      headers.set("Accept-Ranges", "bytes");
      return new Response(upstream.body, {
        status: range ? 206 : 200,
        headers,
      });
    }
    return new Response(upstream.body, { status: 200, headers });
  }

  const root = mediaRoot();
  const filePath = path.resolve(root, media.src);
  if (!filePath.startsWith(root + path.sep)) {
    return new Response("Não permitido", { status: 403 });
  }

  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const cacheControl = "public, max-age=86400";

  const range = req.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return new Response("Range inválido", { status: 416 });
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : size - 1;
    if (start > end || start >= size) return new Response("Range inválido", { status: 416 });

    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": cacheControl,
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": cacheControl,
    },
  });
}

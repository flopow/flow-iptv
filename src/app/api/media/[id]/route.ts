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
// Somente arquivos registrados no catálogo como provider "local" são
// servidos — nunca caminho arbitrário (sem traversal, sem SSRF).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const catalog = await getCatalog();
  const media = await catalog.getMediaFile(id);
  if (!media || media.provider !== "local") {
    return new Response("Não encontrado", { status: 404 });
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

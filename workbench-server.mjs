import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const buildVersion = "20260727-v31.40";
const cleanResetKey = "sous:clean-release";
const publicPort = Number(process.env.PORT || 8124);
const allowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const requestBuckets = new Map();

const { handleSousRequest } = await import("./server.mjs");

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
};

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim();
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function withinRateLimit(req) {
  const now = Date.now();
  const key = clientIp(req);
  const bucket = requestBuckets.get(key) || [];
  const recent = bucket.filter((timestamp) => now - timestamp < 10 * 60 * 1000);
  if (recent.length >= 30) return false;
  recent.push(now);
  requestBuckets.set(key, recent);
  return true;
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...securityHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function encodedBody(req, bytes, contentType) {
  if (!/javascript|text\/css|text\/html|application\/json/.test(contentType) || bytes.length < 1024) return { bytes, encoding: null };
  const accepted = String(req.headers["accept-encoding"] || "");
  if (accepted.includes("br")) return { bytes: zlib.brotliCompressSync(bytes), encoding: "br" };
  if (accepted.includes("gzip")) return { bytes: zlib.gzipSync(bytes), encoding: "gzip" };
  return { bytes, encoding: null };
}

function sendFile(req, res, fileName, contentType) {
  const source = fs.readFileSync(path.join(projectDir, fileName));
  const { bytes, encoding } = encodedBody(req, source, contentType);
  const versioned = new URL(req.url, "http://localhost").searchParams.get("v") === buildVersion;
  res.writeHead(200, {
    ...securityHeaders,
    "Content-Type": contentType,
    "Content-Length": bytes.length,
    "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "no-cache",
    "Vary": "Accept-Encoding",
    ...(encoding ? { "Content-Encoding": encoding } : {}),
  });
  res.end(bytes);
}

function injectWorkbench(html) {
  return html
    .replace(
      "</head>",
      `<script>
        (() => {
          const params = new URLSearchParams(location.search);
          const buildVersion = "${buildVersion}";
          const resetKey = "${cleanResetKey}";
          const shouldReset = params.get("resetAppData") === "1";
          if (shouldReset) {
            localStorage.clear();
            sessionStorage.clear();
            if ("caches" in window) {
              caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
            }
            if ("indexedDB" in window && typeof indexedDB.databases === "function") {
              indexedDB.databases().then((databases) => {
                databases.forEach((database) => {
                  if (database.name) indexedDB.deleteDatabase(database.name);
                });
              });
            }
            history.replaceState(null, "", "/?firstUse=1&v=" + buildVersion);
          }
          localStorage.setItem(resetKey, buildVersion);
        })();
      </script><link rel="stylesheet" href="/sous-ui.css?v=${buildVersion}"></head>`,
    )
    .replace(
      "</body>",
      `<script src="/sous-runtime.js?v=${buildVersion}"></script></body>`,
    );
}
function sendIndex(req, res) {
  const html = injectWorkbench(fs.readFileSync(path.join(projectDir, "index.html"), "utf8"));
  const { bytes, encoding } = encodedBody(req, Buffer.from(html), "text/html");
  res.writeHead(200, {
    ...securityHeaders,
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": bytes.length,
    "Cache-Control": "no-cache",
    "Vary": "Accept-Encoding",
    ...(encoding ? { "Content-Encoding": encoding } : {}),
  });
  res.end(bytes);
}

const assetRoutes = new Map([
  ["/sous-ui.css", ["sous-ui.css", "text/css; charset=utf-8"]],
  ["/sous-runtime.js", ["sous-runtime.js", "text/javascript; charset=utf-8"]],
  ["/sous-mark-v1.png", ["sous-mark-v1.png", "image/png"]],
  ["/sous-loader-v1.png", ["sous-loader-v1.png", "image/png"]],
]);

const workbench = http.createServer((req, res) => {
  for (const [key, value] of Object.entries(securityHeaders)) {
    res.setHeader(key, value);
  }
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (req.method === "GET" && pathname === "/favicon.ico") {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === "GET" && assetRoutes.has(pathname)) {
    const [fileName, contentType] = assetRoutes.get(pathname);
    return sendFile(req, res, fileName, contentType);
  }
  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    return sendIndex(req, res);
  }
  if (req.method === "POST" && pathname.startsWith("/api/")) {
    if (!sameOrigin(req)) return json(res, 403, { error: "Origin not allowed" });
    if (!withinRateLimit(req)) {
      return json(res, 429, { error: "Too many AI requests. Please retry later." });
    }
  }
  return handleSousRequest(req, res);
});

workbench.listen(publicPort, "0.0.0.0", () => {
  console.log(`SOUS running at http://0.0.0.0:${publicPort}`);
});

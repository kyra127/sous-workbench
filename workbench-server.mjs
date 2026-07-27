import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
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

function sendFile(res, fileName, contentType) {
  const bytes = fs.readFileSync(path.join(projectDir, fileName));
  res.writeHead(200, {
    ...securityHeaders,
    "Content-Type": contentType,
    "Content-Length": bytes.length,
    "Cache-Control": "no-cache",
  });
  res.end(bytes);
}

function injectWorkbench(html) {
  return html
    .replace(
      "</head>",
      '<link rel="stylesheet" href="/workbench.css?v=20260727-v30.8.2"><link rel="stylesheet" href="/workbench-v5.css?v=20260727-v30.8.2"><link rel="stylesheet" href="/workbench-v8-multigroup.css?v=20260727-v30.8.2"><link rel="stylesheet" href="/v26-final.css?v=20260727-v30.8.2"><link rel="stylesheet" href="/v27-final.css?v=20260727-v30.8.2"><link rel="stylesheet" href="/v28-final.css?v=20260727-v30.8.2"><link rel="stylesheet" href="/v29-consistency.css?v=20260727-v30.8.2"><link rel="stylesheet" href="/v30-entry.css?v=20260727-v30.8.2"></head>',
    )
    .replace(
      "</body>",
      '<script src="/workbench.js?v=20260727-v30.8.2"></script><script src="/workbench-v2.js?v=20260727-v30.8.2"></script><script src="/workbench-v4.js?v=20260727-v30.8.2"></script><script src="/workbench-v6-pre.js?v=20260727-v30.8.2"></script><script src="/workbench-v6.js?v=20260727-v30.8.2"></script><script src="/workbench-v6-fixes.js?v=20260727-v30.8.2"></script><script src="/workbench-v7.js?v=20260727-v30.8.2"></script><script src="/workbench-v7-fixes.js?v=20260727-v30.8.2"></script><script src="/workbench-v8-multigroup.js?v=20260727-v30.8.2"></script><script src="/workbench-v9-feedback.js?v=20260727-v30.8.2"></script><script src="/v26-final.js?v=20260727-v30.8.2"></script><script type="module" src="/v27-final.js?v=20260727-v30.8.2"></script><script type="module" src="/v28-final.js?v=20260727-v30.8.2"></script><script type="module" src="/v29-consistency.js?v=20260727-v30.8.2"></script><script src="/v30-entry.js?v=20260727-v30.8.2"></script></body>',
    );
}

function sendIndex(res) {
  const html = injectWorkbench(fs.readFileSync(path.join(projectDir, "index.html"), "utf8"));
  res.writeHead(200, {
    ...securityHeaders,
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
    "Cache-Control": "no-cache",
  });
  res.end(html);
}

const assetRoutes = new Map([
  ["/workbench.js", ["workbench.js", "text/javascript; charset=utf-8"]],
  ["/workbench.css", ["workbench.css", "text/css; charset=utf-8"]],
  ["/workbench-v2.js", ["workbench-v2.js", "text/javascript; charset=utf-8"]],
  ["/workbench-v4.js", ["workbench-v4.js", "text/javascript; charset=utf-8"]],
  ["/workbench-v5.css", ["workbench-v5.css", "text/css; charset=utf-8"]],
  ["/workbench-v6-pre.js", ["workbench-v6-pre.js", "text/javascript; charset=utf-8"]],
  ["/workbench-v6.js", ["workbench-v6.js", "text/javascript; charset=utf-8"]],
  ["/workbench-v6-fixes.js", ["workbench-v6-fixes.js", "text/javascript; charset=utf-8"]],
  ["/workbench-v7.js", ["workbench-v7.js", "text/javascript; charset=utf-8"]],
  ["/workbench-v7-fixes.js", ["workbench-v7-fixes.js", "text/javascript; charset=utf-8"]],
  ["/workbench-v8-multigroup.js", ["workbench-v8-multigroup.js", "text/javascript; charset=utf-8"]],
  ["/workbench-v8-multigroup.css", ["workbench-v8-multigroup.css", "text/css; charset=utf-8"]],
  ["/workbench-v9-feedback.js", ["workbench-v9-feedback.js", "text/javascript; charset=utf-8"]],
  ["/v26-final.js", ["v26-final.js", "text/javascript; charset=utf-8"]],
  ["/v26-final.css", ["v26-final.css", "text/css; charset=utf-8"]],
  ["/v27-final.js", ["v27-final.js", "text/javascript; charset=utf-8"]],
  ["/v27-final.css", ["v27-final.css", "text/css; charset=utf-8"]],
  ["/v27-settings.svg", ["v27-settings.svg", "image/svg+xml"]],
  ["/v28-final.js", ["v28-final.js", "text/javascript; charset=utf-8"]],
  ["/v28-final.css", ["v28-final.css", "text/css; charset=utf-8"]],
  ["/v29-consistency.js", ["v29-consistency.js", "text/javascript; charset=utf-8"]],
  ["/v29-consistency.css", ["v29-consistency.css", "text/css; charset=utf-8"]],
  ["/v30-entry.js", ["v30-entry.js", "text/javascript; charset=utf-8"]],
  ["/v30-entry.css", ["v30-entry.css", "text/css; charset=utf-8"]],
  ["/sous-mark-v1.png", ["sous-mark-v1.png", "image/png"]],
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
    return sendFile(res, fileName, contentType);
  }
  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    return sendIndex(res);
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

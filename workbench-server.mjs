import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const buildVersion = "20260727-v31.36-rc1";
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
    "Cache-Control": /javascript|text\/css/.test(contentType) ? "no-store" : "public, max-age=300",
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
  ["/sous-ui.css", ["sous-ui.css", "text/css; charset=utf-8"]],
  ["/sous-runtime.js", ["sous-runtime.js", "text/javascript; charset=utf-8"]],
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
  ["/workbench-v8-multigroup.js?v=8.1", ["workbench-v8-multigroup.js", "text/javascript; charset=utf-8"]],
  ["/workbench-v8-multigroup.css", ["workbench-v8-multigroup.css", "text/css; charset=utf-8"]],
  ["/workbench-v9-feedback.js?v=9.1", ["workbench-v9-feedback.js", "text/javascript; charset=utf-8"]],
  ["/v26-final.js", ["v26-final.js", "text/javascript; charset=utf-8"]],
  ["/v26-final.css", ["v26-final.css", "text/css; charset=utf-8"]],
  ["/v27-final.js", ["v27-final.js", "text/javascript; charset=utf-8"]],
  ["/v27-final.css", ["v27-final.css", "text/css; charset=utf-8"]],
  ["/v28-final.js", ["v28-final.js", "text/javascript; charset=utf-8"]],
  ["/v28-final.css", ["v28-final.css", "text/css; charset=utf-8"]],
  ["/v29-consistency.js", ["v29-consistency.js", "text/javascript; charset=utf-8"]],
  ["/v29-consistency.css", ["v29-consistency.css", "text/css; charset=utf-8"]],
  ["/v30-entry.js", ["v30-entry.js", "text/javascript; charset=utf-8"]],
  ["/v30-entry.css", ["v30-entry.css", "text/css; charset=utf-8"]],
  ["/v31-blue-final.css", ["v31-blue-final.css", "text/css; charset=utf-8"]],
  ["/v31-annotations.js", ["v31-annotations.js", "application/javascript; charset=utf-8"]],
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












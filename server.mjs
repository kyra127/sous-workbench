import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(projectDir, "..", "..");
loadEnv(path.join(workspaceDir, ".env.local"));
loadEnv(path.join(projectDir, ".env.local"));

const PORT = Number(process.env.PORT || 8124);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const MAX_BODY_BYTES = 40 * 1024 * 1024;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const orderSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "parse_ok",
    "customer",
    "items",
    "delivery_date",
    "delivery_time",
    "method",
    "address",
    "customer_note",
    "customer_ref",
    "urgent",
    "confidence",
    "reasons",
    "missing_critical",
    "follow_up",
  ],
  properties: {
    parse_ok: { type: "boolean" },
    customer: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["product", "qty"],
        properties: {
          product: { type: "string" },
          qty: { type: "number" },
        },
      },
    },
    delivery_date: { type: "string" },
    delivery_time: { type: "string" },
    method: { type: "string", enum: ["自取", "配送", "未确定"] },
    address: { type: "string" },
    customer_note: { type: "string" },
    customer_ref: { type: "string" },
    urgent: { type: "boolean" },
    confidence: {
      type: "object",
      additionalProperties: false,
      required: [
        "customer",
        "items",
        "delivery_date",
        "delivery_time",
        "method",
        "address",
        "customer_note",
        "customer_ref",
      ],
      properties: Object.fromEntries(
        [
          "customer",
          "items",
          "delivery_date",
          "delivery_time",
          "method",
          "address",
          "customer_note",
          "customer_ref",
        ].map((key) => [key, { type: "string", enum: ["high", "low"] }]),
      ),
    },
    reasons: {
      type: "object",
      additionalProperties: false,
      required: [
        "customer",
        "items",
        "delivery_date",
        "delivery_time",
        "method",
        "address",
        "customer_note",
        "customer_ref",
      ],
      properties: Object.fromEntries(
        [
          "customer",
          "items",
          "delivery_date",
          "delivery_time",
          "method",
          "address",
          "customer_note",
          "customer_ref",
        ].map((key) => [key, { type: "string" }]),
      ),
    },
    missing_critical: {
      type: "array",
      items: { type: "string" },
    },
    follow_up: { type: "string" },
  },
};

const weeklySchema = {
  type: "object",
  additionalProperties: false,
  required: ["menu_text", "image_prompt"],
  properties: {
    menu_text: { type: "string" },
    image_prompt: { type: "string" },
  },
};

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("请求内容过大"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("请求格式无效"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

async function openAIRequest(endpoint, payload, timeoutMs = 90000) {
  if (!OPENAI_API_KEY) {
    throw Object.assign(new Error("OpenAI API 尚未配置"), { status: 503 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const requestId = response.headers.get("x-request-id");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || `OpenAI API ${response.status}`);
      error.status = response.status;
      error.requestId = requestId;
      throw error;
    }
    return { data, requestId };
  } catch (error) {
    if (error.name === "AbortError") {
      throw Object.assign(new Error("AI 请求超时，请稍后重试"), { status: 504 });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function outputText(response) {
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text || "")
    .join("\n")
    .trim();
}

async function handleAI(req, res) {
  const body = await readJson(req);
  const prompt = String(body.prompt || "").trim();
  const task = String(body.task || "text");
  const images = Array.isArray(body.images) ? body.images.slice(0, 5) : [];
  if (!prompt) return json(res, 400, { error: "缺少提示内容" });

  const content = [{ type: "input_text", text: prompt }];
  for (const image of images) {
    if (!image?.data || !String(image.type || "").startsWith("image/")) continue;
    content.push({
      type: "input_image",
      image_url: `data:${image.type};base64,${image.data}`,
      detail: "original",
    });
  }

  const payload = {
    model: TEXT_MODEL,
    input: [{ role: "user", content }],
    reasoning: { effort: task === "order" ? "low" : "none" },
    store: false,
  };
  if (task === "order") {
    payload.text = {
      format: {
        type: "json_schema",
        name: "sous_order",
        strict: true,
        schema: orderSchema,
      },
    };
  } else if (task === "weekly") {
    payload.text = {
      format: {
        type: "json_schema",
        name: "sous_weekly_menu",
        strict: true,
        schema: weeklySchema,
      },
    };
  } else {
    payload.text = { verbosity: "low" };
  }

  const { data, requestId } = await openAIRequest("responses", payload);
  const text = outputText(data);
  if (!text) {
    throw Object.assign(new Error("AI 没有返回可用内容"), { status: 502, requestId });
  }
  json(res, 200, { text, requestId, model: TEXT_MODEL });
}

async function handleImage(req, res) {
  const body = await readJson(req);
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return json(res, 400, { error: "缺少图像提示词" });
  const allowedSizes = new Set([
    "1024x1024",
    "1024x1536",
    "1536x1024",
    "2048x2048",
    "2048x1152",
  ]);
  const size = allowedSizes.has(body.size) ? body.size : "1024x1536";
  const quality = ["low", "medium", "high"].includes(body.quality)
    ? body.quality
    : "low";
  const { data, requestId } = await openAIRequest(
    "images/generations",
    {
      model: IMAGE_MODEL,
      prompt,
      size,
      quality,
      output_format: "jpeg",
      output_compression: 86,
      n: 1,
    },
    180000,
  );
  const imageBase64 = data?.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw Object.assign(new Error("图像模型没有返回图片"), { status: 502, requestId });
  }
  json(res, 200, {
    image: `data:image/jpeg;base64,${imageBase64}`,
    requestId,
    model: IMAGE_MODEL,
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(projectDir, `.${relative}`);
  if (!filePath.startsWith(projectDir + path.sep)) {
    return json(res, 403, { error: "Forbidden" });
  }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) return json(res, 404, { error: "Not found" });
    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

export async function handleSousRequest(req, res) {
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      return json(res, 200, { ok: Boolean(OPENAI_API_KEY) });
    }
    if (req.method === "POST" && req.url === "/api/ai") return await handleAI(req, res);
    if (req.method === "POST" && req.url === "/api/image") return await handleImage(req, res);
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
    json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const status = Number(error.status) || 500;
    const publicError = status >= 500 ? "服务暂时不可用，请稍后重试" : error.message;
    json(res, status >= 400 && status < 600 ? status : 500, {
      error: publicError,
      ...(process.env.NODE_ENV === "production" ? {} : { detail: error.message }),
      requestId: error.requestId || null,
    });
  }
}

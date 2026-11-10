#!/usr/bin/env node
// Static server for previewing spec-it artifacts on localhost (some browser tools refuse file://).
// Usage: node serve.mjs <unit dir, e.g. spec-it/1-habit-tracker> [--port 4173] [--idle 30]
// Serves only files inside that folder, bound to 127.0.0.1. Prints its PID so the caller can stop exactly
// this process. Exits by itself after --idle minutes without a request (0 keeps it running). Stop with Ctrl+C.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith("--")) || ".");
const portFlag = args.indexOf("--port");
const port = portFlag !== -1 ? Number(args[portFlag + 1]) : 4173;
const idleFlag = args.indexOf("--idle");
const idleMinutes = idleFlag !== -1 ? Number(args[idleFlag + 1]) : 30;

let idleTimer = null;
function touch() {
  if (!idleMinutes) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log(`No requests for ${idleMinutes} minutes; stopping.`);
    process.exit(0);
  }, idleMinutes * 60000);
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`Not a directory: ${root}`);
  process.exit(2);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  touch();
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let file = path.resolve(root, "." + urlPath);
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end(`Not found: ${urlPath}`);
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
});

server.on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `Port ${port} is in use; pass --port <n>.` : e.message);
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  touch();
  console.log(`Serving ${root} (pid ${process.pid}${idleMinutes ? `, stops after ${idleMinutes} idle minutes` : ""})`);
  const entry = fs.existsSync(path.join(root, "mockups", "index.html")) ? "mockups/" : "";
  console.log(`http://localhost:${port}/${entry}`);
});

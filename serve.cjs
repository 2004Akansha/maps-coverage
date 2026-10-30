const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT) || 5173;
const root = __dirname;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }
  const url = new URL(request.url, "http://127.0.0.1");
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = path.normalize(pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  const file = path.join(root, relativePath);
  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    if (request.method === "HEAD") response.end();
    else response.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log("Map Coverage is at http://localhost:" + port);
});

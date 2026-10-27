const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-browser-"));
const output = path.join(scratch, "public");
const clean = () => fs.rmSync(scratch, {recursive:true, force:true});
process.on("exit", clean);
execFileSync("hugo", ["--gc", "--minify", "--environment", "production", "--noBuildLock", "--destination", output, "--cacheDir", path.join(scratch,"cache")], {
  cwd:root, env:{...process.env,HUGO_RESOURCEDIR:path.join(scratch,"resources")}, stdio:"inherit",
});
const types = {".html":"text/html; charset=utf-8", ".css":"text/css", ".js":"text/javascript", ".pdf":"application/pdf", ".woff2":"font/woff2", ".png":"image/png", ".ico":"image/x-icon", ".xml":"application/xml"};
const server = http.createServer((request,response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1:4173");
    let file = path.resolve(output, "." + decodeURIComponent(url.pathname));
    if (file !== output && !file.startsWith(output + path.sep)) {response.writeHead(403).end(); return;}
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,"index.html");
    if (!fs.existsSync(file)) {response.writeHead(404).end(); return;}
    response.writeHead(200, {"Content-Type":types[path.extname(file)] || "application/octet-stream"});
    fs.createReadStream(file).pipe(response);
  } catch {response.writeHead(400).end();}
});
server.listen(4173,"127.0.0.1");
for (const signal of ["SIGINT","SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));

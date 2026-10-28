import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
export async function buildPwa(dist = path.resolve("dist")) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const template = await readFile(
    path.join(root, "pwa/service-worker.js"),
    "utf8",
  );
  const assets = [
    "/offline.html",
    "/manifest.webmanifest",
    "/favicon.svg",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/maskable-512.png",
    "/icons/apple-touch-icon.png",
  ];
  for (const name of (await readdir(path.join(dist, "assets"))).sort())
    if (/\.(js|css)$/.test(name)) assets.push("/assets/" + name);
  const hash = createHash("sha256").update(template);
  for (const asset of assets)
    hash.update(asset).update(await readFile(path.join(dist, asset.slice(1))));
  const version = hash.digest("hex").slice(0, 16);
  const sw = template
    .replaceAll("__VERSION__", version)
    .replace("__ASSETS__", JSON.stringify(assets));
  await writeFile(path.join(dist, "sw.js"), sw);
  console.log(`PWA: ${assets.length} archivos públicos · versión ${version}`);
  return { version, assets, sw };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await buildPwa();

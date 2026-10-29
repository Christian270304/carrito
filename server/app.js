import {
  quantityUnits,
  roundQuantity,
  weighted,
  validAmount,
  maxStock,
  purchaseNeeded,
  purchaseToStock,
  stockUnit,
  purchaseUnit,
} from "../shared/quantities.js";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createClient } from "@libsql/client";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const categories = [
  "Fruta y verdura",
  "Lácteos y huevos",
  "Carne y pescado",
  "Despensa",
  "Panadería",
  "Bebidas",
  "Limpieza",
  "Otros",
];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fail = (res, status, message) =>
  res.status(status).json({ error: message });
function equal(a, b) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export async function createApp(config = process.env) {
  const production = config.NODE_ENV === "production";
  const secret = config.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      "SESSION_SECRET debe tener al menos 32 caracteres. Consulta README.md.",
    );
  let raw;
  try {
    raw = JSON.parse(config.USERS_JSON || "");
  } catch {
    throw new Error(
      "USERS_JSON debe contener un array JSON de usuarios y contraseñas.",
    );
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 30)
    throw new Error("Configura entre 1 y 30 usuarios en USERS_JSON.");
  const users = new Map();
  for (const user of raw) {
    const username =
      typeof user.username === "string"
        ? user.username.trim().toLowerCase()
        : "";
    if (
      !/^[a-z0-9_-]{3,32}$/.test(username) ||
      typeof user.password !== "string" ||
      user.password.length < 12 ||
      user.password.length > 200 ||
      users.has(username)
    )
      throw new Error(
        "Cada usuario necesita un nombre único (3-32 letras minúsculas, números, _ o -) y una contraseña de 12-200 caracteres.",
      );
    const salt = randomBytes(16);
    const hash = scryptSync(user.password, salt, 64);
    // Un cambio de contraseña invalida las sesiones anteriores de esa cuenta.
    const revision = createHmac("sha256", secret)
      .update(username + "\0" + user.password)
      .digest("hex");
    users.set(username, { salt, hash, revision });
  }
  raw = null;
  if (!config.TURSO_DATABASE_URL) throw new Error("Falta TURSO_DATABASE_URL.");
  if (
    production &&
    !config.TURSO_DATABASE_URL.startsWith("libsql://") &&
    !config.TURSO_DATABASE_URL.startsWith("https://")
  )
    throw new Error(
      "En producción utiliza una base de datos Turso remota, no un archivo local.",
    );
  if (production && !config.TURSO_AUTH_TOKEN)
    throw new Error("Falta TURSO_AUTH_TOKEN.");
  const db = createClient({
    url: config.TURSO_DATABASE_URL,
    authToken: config.TURSO_AUTH_TOKEN || undefined,
  });
  await db.execute(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity>0), price_cents INTEGER NOT NULL CHECK(price_cents>=0),
    done INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  // Migración aditiva: conserva los productos de la primera versión.
  const columns = new Set(
    (await db.execute("PRAGMA table_info(products)")).rows.map((r) => r.name),
  );
  for (const [name, definition] of [
    ["store", "TEXT NOT NULL DEFAULT 'Sin supermercado'"],
    ["pack", "TEXT NOT NULL DEFAULT '1 unidad'"],
    ["emoji", "TEXT NOT NULL DEFAULT '🛍️'"],
    ["basket_count", "INTEGER NOT NULL DEFAULT 0"],
    ["uses", "INTEGER NOT NULL DEFAULT 0"],
    ["stock_quantity", "INTEGER DEFAULT NULL"],
    ["target_quantity", "INTEGER DEFAULT NULL"],
    ["measurement_unit", "TEXT NOT NULL DEFAULT 'unit'"],
    ["pack_size", "INTEGER NOT NULL DEFAULT 1"],
    ["stock_step", "REAL NOT NULL DEFAULT 1"],
  ]) {
    if (!columns.has(name))
      await db.execute(`ALTER TABLE products ADD COLUMN ${name} ${definition}`);
  }
  if (!columns.has("basket_count"))
    await db.execute(
      "UPDATE products SET basket_count=CASE WHEN done=0 THEN MIN(999,CAST(ROUND(quantity) AS INTEGER)) ELSE 0 END",
    );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL,action TEXT NOT NULL,product TEXT NOT NULL,amount INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS profiles(username TEXT PRIMARY KEY,name TEXT NOT NULL,theme TEXT NOT NULL DEFAULT 'auto')`,
  );
  const activityColumns = new Set(
    (await db.execute("PRAGMA table_info(activity)")).rows.map((r) => r.name),
  );
  if (!activityColumns.has("amount_unit"))
    await db.execute(
      "ALTER TABLE activity ADD COLUMN amount_unit TEXT NOT NULL DEFAULT 'ud.'",
    );
  const app = express();
  if (production) app.set("trust proxy", 1); // Render termina HTTPS en su proxy.
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:"],
          "connect-src": ["'self'"],
          "upgrade-insecure-requests": production ? [] : null,
        },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use(express.json({ limit: "16kb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("X-Requested-With") !== "en-casa"
    )
      return fail(res, 403, "Petición no permitida.");
    // No se habilita CORS. El encabezado exige preflight en peticiones de otros orígenes.
    const origin = req.get("origin");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && origin) {
      try {
        if (new URL(origin).host !== req.get("host"))
          return fail(res, 403, "Origen no permitido.");
      } catch {
        return fail(res, 403, "Origen no válido.");
      }
    }
    next();
  });
  const sign = (data) =>
    createHmac("sha256", secret).update(data).digest("base64url");
  function getUser(req) {
    try {
      const cookie = (req.headers.cookie || "")
        .split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith("en_casa_session="));
      if (!cookie) return null;
      const token = cookie.slice("en_casa_session=".length);
      const [data, signature, ...extra] = token.split(".");
      if (extra.length || !signature || !equal(signature, sign(data)))
        return null;
      const payload = JSON.parse(Buffer.from(data, "base64url").toString());
      if (
        !Number.isFinite(payload.exp) ||
        payload.exp < Date.now() ||
        users.get(payload.username)?.revision !== payload.revision
      )
        return null;
      return payload;
    } catch {
      return null;
    }
  }
  const cookieOptions = {
    httpOnly: true,
    secure: production,
    sameSite: "strict",
    path: "/",
  };
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) =>
      fail(res, 429, "Demasiados intentos. Espera 15 minutos."),
  });
  app.post("/api/login", loginLimiter, (req, res) => {
    const username = String(req.body?.username || "")
      .trim()
      .toLowerCase();
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";
    if (password.length > 200)
      return fail(res, 401, "Usuario o contraseña incorrectos.");
    const user = users.get(username);
    const computed = scryptSync(password, user?.salt || Buffer.alloc(16), 64);
    if (!user || !timingSafeEqual(computed, user.hash))
      return fail(res, 401, "Usuario o contraseña incorrectos.");
    const data = Buffer.from(
      JSON.stringify({
        username,
        revision: user.revision,
        exp: Date.now() + 7 * 86400000,
        nonce: randomBytes(16).toString("hex"),
      }),
    ).toString("base64url");
    res.cookie("en_casa_session", data + "." + sign(data), {
      ...cookieOptions,
      maxAge: 7 * 86400000,
    });
    res.json({ username });
  });
  app.post("/api/logout", (_req, res) => {
    res.clearCookie("en_casa_session", cookieOptions);
    res.json({ ok: true });
  });
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", (req, res, next) => {
    const user = getUser(req);
    if (!user) return fail(res, 401, "Inicia sesión para acceder a la lista.");
    req.user = user;
    next();
  });
  app.get("/api/me", async (req, res) => {
    const r = await db.execute({
      sql: "SELECT name,theme FROM profiles WHERE username=?",
      args: [req.user.username],
    });
    res.json({
      username: req.user.username,
      name: r.rows[0]?.name || req.user.username,
      theme: r.rows[0]?.theme || "auto",
    });
  });
  app.post("/api/profile", async (req, res) => {
    const { name, theme } = req.body || {};
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 40 ||
      !["auto", "light", "dark"].includes(theme)
    )
      return fail(res, 400, "Revisa tu nombre y la apariencia.");
    await db.execute({
      sql: "INSERT INTO profiles(username,name,theme) VALUES(?,?,?) ON CONFLICT(username) DO UPDATE SET name=excluded.name,theme=excluded.theme",
      args: [req.user.username, name.trim(), theme],
    });
    res.json({ username: req.user.username, name: name.trim(), theme });
  });
  const mapRow = (p) => {
    const item = {
      id: p.id,
      name: p.name,
      category: p.category,
      price: Number(p.price_cents) / 100,
      version: Number(p.version),
      store: p.store,
      pack: p.pack,
      emoji: p.emoji,
      stockCount: Number(p.stock_quantity ?? 0),
      targetCount: Number(p.target_quantity ?? 0),
      configured: p.stock_quantity !== null && p.target_quantity !== null,
      unit: p.measurement_unit,
      packSize: Number(p.pack_size),
      stockStep: Number(p.stock_step),
      uses: Number(p.uses),
    };
    return {
      ...item,
      expectedAmount: roundQuantity(
        item.targetCount / (item.unit === "pack" ? item.packSize : 1),
      ),
      toBuy: item.configured ? purchaseNeeded(item) : 0,
    };
  };
  const event = (req, action, product, amount = 0, unit = "ud.") => ({
    sql: "INSERT INTO activity(username,action,product,amount,amount_unit) VALUES(?,?,?,?,?)",
    args: [req.user.username, action, product, amount, unit],
  });
  async function mutate(req, res, fn) {
    const tx = await db.transaction("write");
    try {
      const result = await fn(tx);
      if (result.error) {
        await tx.rollback();
        return fail(res, result.status || 409, result.error);
      }
      await tx.commit();
      res.status(result.status || 200).json(result.data);
    } catch (e) {
      await tx.rollback();
      throw e;
    } finally {
      tx.close();
    }
  }
  app.get("/api/activity", async (_req, res) => {
    const r = await db.execute(
      "SELECT a.*,COALESCE(p.name,a.username) AS name FROM activity a LEFT JOIN profiles p ON p.username=a.username ORDER BY a.id DESC LIMIT 100",
    );
    res.json(r.rows);
  });
  app.get("/api/products", async (_req, res) => {
    const result = await db.execute(
      "SELECT * FROM products ORDER BY created_at, id",
    );
    res.json(result.rows.map(mapRow));
  });
  function validate(p) {
    return (
      p &&
      typeof p.name === "string" &&
      p.name.trim().length > 0 &&
      p.name.trim().length <= 100 &&
      categories.includes(p.category) &&
      quantityUnits.includes(p.unit) &&
      validAmount(p.expectedAmount, p.unit) &&
      Number.isInteger(p.packSize) &&
      p.packSize >= 1 &&
      p.packSize <= 999 &&
      validAmount(p.stockStep, p.unit === "pack" ? "unit" : p.unit, false) &&
      (weighted(p.unit) || p.stockStep === 1) &&
      Number.isFinite(p.price) &&
      p.price >= 0 &&
      p.price <= 1000000 &&
      (p.store === undefined ||
        (typeof p.store === "string" && p.store.trim().length <= 50)) &&
      (p.pack === undefined ||
        (typeof p.pack === "string" && p.pack.trim().length <= 60)) &&
      (p.emoji === undefined ||
        (typeof p.emoji === "string" && p.emoji.trim().length <= 64))
    );
  }
  app.post("/api/products", async (req, res) => {
    const p = req.body;
    if (p && (!("expectedAmount" in p) || !("unit" in p)))
      return fail(
        res,
        409,
        "Actualiza la aplicación para configurar la cantidad prevista y las unidades.",
      );
    if (p && (p.price === undefined || p.price === null || p.price === ""))
      p.price = 0;
    if (!validate(p))
      return fail(
        res,
        400,
        "Revisa la cantidad prevista, el tipo de unidad, el contenido del pack y el precio.",
      );
    const packSize = p.unit === "pack" ? p.packSize : 1,
      target = purchaseToStock({ unit: p.unit, packSize }, p.expectedAmount);
    const extra = [
      p.store?.trim() || "Sin supermercado",
      p.pack?.trim() || "",
      p.emoji?.trim() || "🛍️",
    ];
    return mutate(req, res, async (tx) => {
      if (p.id) {
        if (
          typeof p.id !== "string" ||
          !Number.isInteger(p.version) ||
          p.version < 1
        )
          return { status: 400, error: "Versión no válida." };
        const old = (
          await tx.execute({
            sql: "SELECT * FROM products WHERE id=? AND version=?",
            args: [p.id, p.version],
          })
        ).rows[0];
        if (!old)
          return {
            error:
              "Otra persona ha cambiado este producto. Cierra y vuelve a abrir la edición.",
          };
        // Cambiar el objetivo no repone existencias. Cambiar dimensión (ud./kg/l) empieza un conteo nuevo.
        const oldDimension = old.measurement_unit;
        const dimension = p.unit;
        const stock =
          old.stock_quantity === null || oldDimension !== dimension
            ? target
            : Number(old.stock_quantity);
        const r = await tx.execute({
          sql: "UPDATE products SET name=?,category=?,price_cents=?,store=?,pack=?,emoji=?,stock_quantity=?,target_quantity=?,measurement_unit=?,pack_size=?,stock_step=?,version=version+1 WHERE id=? AND version=? RETURNING *",
          args: [
            p.name.trim(),
            p.category,
            Math.round(p.price * 100),
            ...extra,
            stock,
            target,
            p.unit,
            packSize,
            p.stockStep,
            p.id,
            p.version,
          ],
        });
        await tx.execute(event(req, "edited", p.name.trim()));
        return { data: mapRow(r.rows[0]) };
      }
      const r = await tx.execute({
        sql: "INSERT INTO products(id,name,category,quantity,price_cents,done,store,pack,emoji,stock_quantity,target_quantity,measurement_unit,pack_size,stock_step) VALUES(?,?,?,1,?,0,?,?,?,?,?,?,?,?) RETURNING *",
        args: [
          randomUUID(),
          p.name.trim(),
          p.category,
          Math.round(p.price * 100),
          ...extra,
          target,
          target,
          p.unit,
          packSize,
          p.stockStep,
        ],
      });
      await tx.execute(event(req, "created", p.name.trim()));
      return { status: 201, data: mapRow(r.rows[0]) };
    });
  });
  app.post("/api/products/:id/stock", async (req, res) => {
    const { delta, unit } = req.body || {};
    if (!quantityUnits.includes(unit))
      return fail(
        res,
        409,
        "Actualiza la aplicación para descontar usando las unidades del producto.",
      );
    if (
      !validAmount(
        Math.abs(delta),
        unit === "pack" ? "unit" : unit,
        false,
        999000,
      ) ||
      typeof delta !== "number"
    )
      return fail(res, 400, "Cantidad no válida.");
    return mutate(req, res, async (tx) => {
      const old = (
        await tx.execute({
          sql: "SELECT * FROM products WHERE id=?",
          args: [req.params.id],
        })
      ).rows[0];
      if (!old || old.stock_quantity === null || old.target_quantity === null)
        return {
          error:
            "Configura primero la cantidad prevista o actualiza el inventario.",
        };
      const p = mapRow(old),
        next = roundQuantity(p.stockCount + delta);
      if (p.unit !== unit)
        return { error: "La unidad ha cambiado. Actualiza el inventario." };
      if (next < 0 || next > maxStock(p))
        return { error: "La cantidad está fuera de los límites del producto." };
      const r = await tx.execute({
        sql: "UPDATE products SET stock_quantity=?,version=version+1 WHERE id=? RETURNING *",
        args: [next, req.params.id],
      });
      await tx.execute(
        event(
          req,
          delta > 0 ? "restocked" : "consumed",
          p.name,
          Math.abs(delta),
          stockUnit(p),
        ),
      );
      return { data: mapRow(r.rows[0]) };
    });
  });
  app.post("/api/checkout", async (req, res) => {
    const selections = req.body?.items;
    if (
      !Array.isArray(selections) ||
      !selections.length ||
      selections.length > 200 ||
      new Set(selections.map((p) => p?.id)).size !== selections.length ||
      selections.some(
        (p) =>
          !p ||
          typeof p.id !== "string" ||
          !quantityUnits.includes(p.unit) ||
          !validAmount(p.count, p.unit, false) ||
          !Number.isInteger(p.version),
      )
    )
      return fail(
        res,
        400,
        "Selecciona productos con cantidades y unidades válidas.",
      );
    return mutate(req, res, async (tx) => {
      for (const selection of selections) {
        const old = (
          await tx.execute({
            sql: "SELECT * FROM products WHERE id=? AND version=?",
            args: [selection.id, selection.version],
          })
        ).rows[0];
        if (!old || old.stock_quantity === null || old.target_quantity === null)
          return {
            error:
              "El inventario ha cambiado. Revisa los productos y vuelve a marcar lo comprado.",
          };
        const p = mapRow(old),
          actual = purchaseToStock(p, selection.count),
          next = roundQuantity(p.stockCount + actual);
        if (selection.unit !== p.unit || next > maxStock(p))
          return {
            error:
              "Las unidades han cambiado o la cantidad supera el límite. Revisa la compra.",
          };
        await tx.execute({
          sql: "UPDATE products SET stock_quantity=?,uses=uses+1,version=version+1 WHERE id=?",
          args: [next, p.id],
        });
        await tx.execute(
          event(req, "purchased", p.name, selection.count, purchaseUnit(p)),
        );
      }
      return { data: { ok: true } };
    });
  });
  // Las versiones antiguas no pueden modificar las cantidades con la semántica de cesta.
  app.post("/api/products/:id/quantity", (_req, res) =>
    fail(
      res,
      409,
      "Actualiza la aplicación: las cantidades ahora se controlan desde el inventario.",
    ),
  );
  app.patch("/api/products/:id", (_req, res) =>
    fail(res, 409, "Actualiza la aplicación para utilizar el inventario."),
  );
  app.delete("/api/products/:id", async (req, res) => {
    const version = Number(req.query.version);
    if (!Number.isInteger(version) || version < 1)
      return fail(res, 400, "Falta la versión del producto.");
    return mutate(req, res, async (tx) => {
      const r = await tx.execute({
        sql: "DELETE FROM products WHERE id=? AND version=? RETURNING *",
        args: [req.params.id, version],
      });
      if (!r.rows.length)
        return {
          error: "El producto ha cambiado o ya no existe. Actualiza la lista.",
        };
      await tx.execute(event(req, "deleted", r.rows[0].name));
      return { data: { ok: true } };
    });
  });
  app.use("/api", (_req, res) => fail(res, 404, "Ruta no encontrada."));
  app.use(
    express.static(path.join(root, "dist"), {
      index: false,
      setHeaders(res, filePath) {
        if (
          ["sw.js", "manifest.webmanifest", "offline.html"].includes(
            path.basename(filePath),
          )
        )
          res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
  app.use((err, req, res, _next) => {
    if (err instanceof SyntaxError && "body" in err)
      return fail(res, 400, "JSON no válido.");
    if (err.status === 413) return fail(res, 413, "Petición demasiado grande.");
    console.error(
      "Error de petición:",
      req.method,
      req.path,
      err.code || err.name,
    );
    fail(res, 500, "No se pudo completar la operación. Inténtalo de nuevo.");
  });
  return { app, db };
}

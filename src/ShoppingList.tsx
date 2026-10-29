import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus,
  Minus,
  Search,
  Check,
  Pencil,
  Trash2,
  ClipboardList,
  Boxes,
  History,
  X,
  ArrowLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Smartphone,
  SlidersHorizontal,
  RefreshCw,
  Store,
  CheckCheck,
  House,
  PackageOpen,
} from "lucide-react";
import { api } from "./api";
import PwaInstall from "./PwaInstall";
import {
  acceptsPrice,
  parsePrice,
  acceptsCount,
  parseCount,
} from "./formNumbers.js";
export type Profile = { username: string; name: string; theme: string };
type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  version: number;
  store: string;
  pack: string;
  emoji: string;
  stockCount: number;
  targetCount: number;
  configured: boolean;
  toBuy: number;
  uses: number;
};
type Draft = Partial<Product>;
type Activity = {
  id: number;
  username: string;
  name: string;
  action: string;
  product: string;
  amount: number;
  created_at: string;
};
type Selection = { id: string; count: number; version: number };
const cats = [
  "Fruta y verdura",
  "Lácteos y huevos",
  "Carne y pescado",
  "Despensa",
  "Panadería",
  "Bebidas",
  "Limpieza",
  "Otros",
];
const labels = [
  "Fruta",
  "Lácteos",
  "Carne y pescado",
  "Despensa",
  "Panadería",
  "Bebidas",
  "Limpieza",
  "Otros",
];
const emojiChoices = [
  "🥣",
  "🥔",
  "🥛",
  "🧀",
  "🥚",
  "🥖",
  "🥩",
  "🍗",
  "🐟",
  "🍎",
  "🍌",
  "🍅",
  "🥬",
  "🍚",
  "🍝",
  "🥫",
  "🧂",
  "🧃",
  "💧",
  "🧴",
  "🧻",
  "🍪",
  "☕",
  "🧈",
];
const blank = {
  name: "",
  category: "Despensa",
  store: "",
  pack: "1 unidad",
  emoji: "",
  stockCount: 0,
  targetCount: 0,
  price: 0,
};
const actions: Record<string, string> = {
  created: "añadió al inventario",
  edited: "actualizó",
  deleted: "eliminó",
  consumed: "consumió",
  restocked: "añadió existencias de",
  purchased: "compró",
  added: "añadió a la antigua cesta",
  removed: "quitó de la antigua cesta",
};
const money = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
function date(s: string) {
  return new Date(s.replace(" ", "T") + "Z").toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export default function ShoppingList({
  profile,
  onProfile,
  onLogout,
}: {
  profile: Profile;
  onProfile: (p: Profile) => void;
  onLogout: () => void;
}) {
  const [items, setItems] = useState<Product[]>([]),
    [activity, setActivity] = useState<Activity[]>([]),
    [tab, setTab] = useState("inventory"),
    [category, setCategory] = useState("Todas"),
    [store, setStore] = useState("Todos"),
    [search, setSearch] = useState(""),
    [stockFilter, setStockFilter] = useState("Todos"),
    [edit, setEdit] = useState<Draft | null>(null),
    [priceInput, setPriceInput] = useState(""),
    [stockInput, setStockInput] = useState(""),
    [targetInput, setTargetInput] = useState(""),
    [targetTouched, setTargetTouched] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [draftProfile, setDraftProfile] = useState(profile),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [connected, setConnected] = useState(false),
    [shop, setShop] = useState<string | null>(null),
    [selected, setSelected] = useState<Selection[]>([]),
    [askDelete, setAskDelete] = useState<Product | null>(null);
  const latest = useRef(0),
    active = useRef(false),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3500);
  }, []);
  const load = useCallback(async () => {
    if (active.current) return;
    active.current = true;
    try {
      const [r, a] = await Promise.all([
        api("/api/products"),
        api("/api/activity"),
      ]);
      if (!r.ok || !a.ok) throw Error();
      const products: Product[] = await r.json();
      if (products.some((p) => typeof p.stockCount !== "number")) throw Error();
      const events: Activity[] = await a.json();
      setItems(products);
      setActivity(events);
      setConnected(true);
      const newest = Number(events[0]?.id || 0);
      if (latest.current && newest > latest.current) {
        const other = events.find(
          (e) =>
            Number(e.id) > latest.current && e.username !== profile.username,
        );
        if (other)
          notify(
            `${other.name} ${actions[other.action] || "actualizó"} ${other.product}`,
          );
      }
      latest.current = newest;
    } catch {
      setConnected(false);
      setError(
        "No se pudo actualizar el inventario. Comprueba la conexión y que el despliegue haya terminado.",
      );
    } finally {
      active.current = false;
      setLoading(false);
    }
  }, [profile.username, notify]);
  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    const visible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [load]);
  const overlayOpen = !!edit || profileOpen || !!askDelete;
  useEffect(() => {
    if (!overlayOpen) return;
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        if (askDelete) setAskDelete(null);
        else {
          setEdit(null);
          setProfileOpen(false);
        }
      }
      if (e.key === "Tab") {
        const sheets = document.querySelectorAll(".sheet");
        const nodes = Array.from(
          sheets[sheets.length - 1].querySelectorAll<HTMLElement>(
            "button:not(:disabled), input, select",
          ),
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [overlayOpen, busy, !!askDelete]);
  async function mutate(path: string, method: string, body?: unknown) {
    const r = await api(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || "No se pudo guardar.");
    return data;
  }
  async function change(p: Product, delta: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await mutate(`/api/products/${p.id}/stock`, "POST", {
        delta,
      });
      setItems((previous) =>
        previous.map((i) => (i.id === p.id ? updated : i)),
      );
      notify(
        delta < 0
          ? `Una unidad menos de ${p.name}`
          : `Una unidad más de ${p.name}`,
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  }
  function openEdit(p?: Product) {
    setError("");
    setEdit(p ? { ...p } : { ...blank });
    setPriceInput(p?.price ? String(p.price).replace(".", ",") : "");
    setStockInput(p?.configured ? String(p.stockCount) : "");
    setTargetInput(p?.configured ? String(p.targetCount) : "");
    setTargetTouched(!!p?.configured);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit || busy) return;
    const price = parsePrice(priceInput),
      stockCount = parseCount(stockInput),
      targetCount = parseCount(targetInput);
    if (price === null || stockCount === null || targetCount === null) {
      setError(
        "Revisa el precio y las cantidades. Usa números positivos; el precio vacío vale 0.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await mutate("/api/products", "POST", {
        ...edit,
        price,
        stockCount,
        targetCount,
        emoji: edit.emoji?.trim() || "🛍️",
      });
      setEdit(null);
      notify("Inventario actualizado");
      await load();
    } catch (e) {
      setError((e as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!askDelete || busy) return;
    setBusy(true);
    setError("");
    try {
      await mutate(
        `/api/products/${askDelete.id}?version=${askDelete.version}`,
        "DELETE",
      );
      setAskDelete(null);
      setEdit(null);
      notify("Producto eliminado");
      await load();
    } catch (e) {
      setError((e as Error).message);
      setAskDelete(null);
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onProfile(
        await mutate("/api/profile", "POST", {
          name: draftProfile.name,
          theme: draftProfile.theme,
        }),
      );
      setProfileOpen(false);
      notify("Perfil actualizado");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    if (!selected.length || busy) return;
    setBusy(true);
    setError("");
    try {
      await mutate("/api/checkout", "POST", { items: selected });
      setShop(null);
      setSelected([]);
      notify("Compra guardada: las unidades ya están en casa.");
      await load();
    } catch (e) {
      setError((e as Error).message);
      setSelected([]);
      await load();
    } finally {
      setBusy(false);
    }
  }
  function select(p: Product) {
    setSelected((previous) =>
      previous.some((s) => s.id === p.id)
        ? previous.filter((s) => s.id !== p.id)
        : [...previous, { id: p.id, count: p.toBuy, version: p.version }],
    );
  }
  function boughtCount(p: Product, delta: number) {
    setSelected((previous) =>
      previous.map((s) =>
        s.id === p.id
          ? {
              ...s,
              count: Math.max(1, Math.min(999 - p.stockCount, s.count + delta)),
            }
          : s,
      ),
    );
  }
  function navigate(next: string) {
    setTab(next);
    setShop(null);
    setSelected([]);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const needs = items.filter((p) => p.configured && p.toBuy > 0),
    unknown = items.filter((p) => !p.configured),
    units = items
      .filter((p) => p.configured)
      .reduce((a, p) => a + p.stockCount, 0),
    toBuy = needs.reduce((a, p) => a + p.toBuy, 0),
    stores = Array.from(new Set(items.map((p) => p.store))).sort((a, b) =>
      a.localeCompare(b),
    ),
    buyStores = Array.from(new Set(needs.map((p) => p.store))).sort((a, b) =>
      a.localeCompare(b),
    ),
    shopping = shop ? needs.filter((p) => p.store === shop) : [],
    estimate = needs.reduce((a, p) => a + p.toBuy * p.price, 0),
    filtered = items.filter(
      (p) =>
        (category === "Todas" || p.category === category) &&
        (store === "Todos" || store === p.store) &&
        (stockFilter === "Todos" ||
          (stockFilter === "Falta comprar" && p.toBuy > 0) ||
          (stockFilter === "Sin existencias" &&
            p.configured &&
            p.stockCount === 0) ||
          (stockFilter === "Por configurar" && !p.configured)) &&
        p.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")),
    );
  const nav = [
    { id: "inventory", label: "Inventario", Icon: Boxes },
    { id: "shopping", label: "Compra", Icon: ClipboardList },
    { id: "activity", label: "Actividad", Icon: History },
  ];
  const stepper = (p: Product) => (
    <div className="stock-control">
      <small>En casa</small>
      <div className="stepper">
        <button
          disabled={busy || p.stockCount === 0}
          aria-label={`Consumir una unidad de ${p.name}`}
          onClick={() => change(p, -1)}
        >
          <Minus size={19} />
        </button>
        <span
          className={p.stockCount ? "has-count" : ""}
          aria-label={`${p.stockCount} unidades en casa`}
        >
          {p.stockCount}
        </span>
        <button
          disabled={busy || p.stockCount >= 999}
          className="plus"
          aria-label={`Añadir una unidad al inventario de ${p.name}`}
          onClick={() => change(p, 1)}
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
  const row = (p: Product, buy = false) => (
    <div className="product-row inventory-row" key={p.id}>
      <button
        className="product-info"
        onClick={() => openEdit(p)}
        aria-label={`Editar ${p.name}`}
      >
        <span className="food">{p.emoji}</span>
        <span className="product-text">
          {!buy && <span className="store-name">{p.store}</span>}
          <strong>{p.name}</strong>
          <small>
            {p.category} · {p.pack}
          </small>
          {p.configured ? (
            <span className={"inventory-status " + (p.toBuy ? "low" : "")}>
              <span>Objetivo {p.targetCount}</span>
              {p.toBuy > 0 ? <b>Faltan {p.toBuy}</b> : <b>Al día</b>}
            </span>
          ) : (
            <span className="inventory-status low">
              Configura cuánto hay en casa
            </span>
          )}
        </span>
      </button>
      {!p.configured ? (
        <button className="setup-button" onClick={() => openEdit(p)}>
          Configurar
          <ChevronRight size={14} />
        </button>
      ) : buy ? (
        <div className="buy-quantity">
          <small>Comprar</small>
          <strong>{p.toBuy}</strong>
          <span>Hay {p.stockCount} en casa</span>
        </div>
      ) : (
        stepper(p)
      )}
    </div>
  );
  return (
    <div className="mobile-app">
      <aside className="desktop-sidebar">
        <a className="desktop-brand" href="/">
          <House />
          en casa<span>.</span>
        </a>
        <div className="house-label">SABER QUÉ HAY. COMPRAR LO JUSTO.</div>
        {nav.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={tab === id ? "chosen" : ""}
            onClick={() => navigate(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
            {id === "shopping" && needs.length > 0 && <b>{needs.length}</b>}
          </button>
        ))}
        <div className="sidebar-note">
          <span>🏡</span>
          <strong>
            Lo que hay.
            <br />
            Lo que hace falta.
          </strong>
          <p>Menos dudas antes de comprar.</p>
        </div>
        <button
          className="desktop-profile"
          onClick={() => {
            setDraftProfile(profile);
            setError("");
            setProfileOpen(true);
          }}
        >
          <span>{profile.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{profile.name}</strong>
            <small>Tu perfil y apariencia</small>
          </div>
          <SlidersHorizontal size={17} />
        </button>
      </aside>
      <main className="mobile-main">
        <header className="page-header">
          <div>
            <p className="eyebrow">
              {shop
                ? "EN EL SUPERMERCADO"
                : tab === "inventory"
                  ? "CONTROL DE CASA"
                  : tab === "shopping"
                    ? "SOLO LO QUE FALTA"
                    : "LO QUE PASA EN CASA"}
            </p>
            <h1>
              {shop ||
                (tab === "inventory"
                  ? "Nuestro inventario"
                  : tab === "shopping"
                    ? "Lista de compra"
                    : "Actividad")}
            </h1>
          </div>
          <button
            className="avatar"
            aria-label="Abrir tu perfil"
            onClick={() => {
              setDraftProfile(profile);
              setError("");
              setProfileOpen(true);
            }}
          >
            {profile.name.slice(0, 1).toUpperCase()}
          </button>
        </header>
        <div className="connection">
          <span className={connected ? "online" : "offline"} />
          {loading
            ? "Conectando…"
            : connected
              ? "Inventario compartido al día"
              : "Revisa la conexión"}
          <button
            aria-label="Actualizar inventario"
            onClick={() => {
              setError("");
              load();
            }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
        {error && !overlayOpen && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button aria-label="Cerrar aviso" onClick={() => setError("")}>
              <X size={17} />
            </button>
          </div>
        )}
        {tab === "inventory" && (
          <>
            <div className="inventory-summary">
              <div>
                <span>
                  <Boxes size={18} /> En casa
                </span>
                <strong>
                  {units}
                  <small>unidades registradas</small>
                </strong>
              </div>
              <button onClick={() => navigate("shopping")}>
                <span>
                  <ClipboardList size={18} /> Hace falta
                </span>
                <strong>
                  {toBuy}
                  <small>
                    unidades por comprar
                    <ChevronRight size={12} />
                  </small>
                </strong>
              </button>
            </div>
            {unknown.length > 0 && (
              <div className="onboarding-note">
                <PackageOpen size={21} />
                <div>
                  <strong>
                    {unknown.length}{" "}
                    {unknown.length === 1
                      ? "producto por configurar"
                      : "productos por configurar"}
                  </strong>
                  <p>
                    Indica las existencias reales y cuánto queréis mantener. No
                    hemos contado la antigua cesta como productos que ya tenéis.
                  </p>
                  <button onClick={() => setStockFilter("Por configurar")}>
                    Revisar existencias
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
            {!items.length && !loading && (
              <div className="onboarding-note">
                <House size={22} />
                <div>
                  <strong>Primero, cuenta lo que hay.</strong>
                  <p>
                    Registra cada producto, las unidades que tenéis y las que
                    queréis mantener. Después solo tendrás que descontar lo que
                    usáis.
                  </p>
                </div>
              </div>
            )}
            <div className="search-box">
              <Search size={22} />
              <input
                aria-label="Buscar productos"
                placeholder="Buscar en casa"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  aria-label="Borrar búsqueda"
                  onClick={() => setSearch("")}
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="filter-row horizontal-scroll">
              <button
                className={category === "Todas" ? "active" : ""}
                onClick={() => setCategory("Todas")}
              >
                Todos
              </button>
              {cats.map((c, i) => (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  {labels[i]}
                </button>
              ))}
            </div>
            <div className="section-title products-title">
              <h2>
                Productos <span className="muted-count">{filtered.length}</span>
              </h2>
              <button className="new-button" onClick={() => openEdit()}>
                <Plus size={16} />
                Nuevo
              </button>
            </div>
            <div className="inventory-filters">
              <label className="store-filter">
                <Store size={14} />
                <select
                  aria-label="Filtrar por supermercado"
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                >
                  <option value="Todos">Todos los supermercados</option>
                  {stores.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="store-filter">
                <SlidersHorizontal size={14} />
                <select
                  aria-label="Filtrar por existencias"
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                >
                  {[
                    "Todos",
                    "Falta comprar",
                    "Sin existencias",
                    "Por configurar",
                  ].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
            </div>
            {loading ? (
              <div className="empty-state">
                <RefreshCw className="spin" />
                <h3>Preparando tu casa…</h3>
              </div>
            ) : filtered.length ? (
              <div className="product-card">{filtered.map((p) => row(p))}</div>
            ) : (
              <div className="empty-state">
                <span>🏡</span>
                <h3>
                  {items.length
                    ? "No hay productos con esos filtros"
                    : "Vamos a organizar tu casa"}
                </h3>
                <p>
                  {items.length
                    ? "Prueba otro nombre o cambia los filtros."
                    : "Añade lo que tenéis o usáis habitualmente. Nosotros calculamos lo que falta."}
                </p>
                <button className="primary" onClick={() => openEdit()}>
                  <Plus size={18} />
                  Añadir producto
                </button>
              </div>
            )}
            <p className="footnote">
              <Minus size={12} />
              Resta lo que consumes. Toca un producto para editarlo.
            </p>
          </>
        )}
        {tab === "shopping" && !shop && (
          <>
            <p className="page-subtitle">
              {needs.length} {needs.length === 1 ? "producto" : "productos"} ·{" "}
              {toBuy} {toBuy === 1 ? "unidad que falta" : "unidades que faltan"}
            </p>
            <div className="shopping-explanation">
              <ClipboardList size={21} />
              <p>
                Esta lista se calcula sola:{" "}
                <strong>lo que quieres tener − lo que hay en casa</strong>. Al
                terminar la compra, las unidades vuelven al inventario.
              </p>
            </div>
            {unknown.length > 0 && (
              <div className="onboarding-note">
                <PackageOpen size={20} />
                <div>
                  <strong>
                    Faltan {unknown.length} productos por configurar
                  </strong>
                  <p>Todavía no se incluyen en esta lista.</p>
                  <button
                    onClick={() => {
                      navigate("inventory");
                      setStockFilter("Por configurar");
                    }}
                  >
                    Revisar existencias
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
            {needs.length > 0 ? (
              <>
                <div className="basket-summary">
                  <div>
                    <ClipboardList size={20} />
                    <span>Compra prevista</span>
                  </div>
                  <strong>{money(estimate)}</strong>
                  <small>
                    Estimado según tus precios. Los precios vacíos cuentan como
                    0.
                  </small>
                </div>
                {buyStores.map((s) => (
                  <section className="store-section" key={s}>
                    <div className="section-title">
                      <h2 className="store-heading">
                        <Store size={15} />
                        {s}
                      </h2>
                      <small>
                        {needs
                          .filter((p) => p.store === s)
                          .reduce((a, p) => a + p.toBuy, 0)}{" "}
                        unidades
                      </small>
                    </div>
                    <div className="product-card">
                      {needs
                        .filter((p) => p.store === s)
                        .map((p) => row(p, true))}
                    </div>
                    <button
                      className="primary start-shopping"
                      onClick={() => {
                        setShop(s);
                        setSelected([]);
                        setError("");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <ClipboardList size={20} />
                      Hacer esta compra
                      <ChevronRight size={18} />
                    </button>
                  </section>
                ))}
              </>
            ) : (
              <div className="empty-state">
                <span>✨</span>
                <h3>
                  {items.length
                    ? "Por ahora, todo al día"
                    : "Aún no hay nada registrado"}
                </h3>
                <p>
                  {items.length
                    ? "Los productos configurados tienen las unidades que queréis mantener. Cuando consumas algo, aparecerá aquí lo que falta."
                    : "Empieza indicando lo que tenéis en el inventario."}
                </p>
                <button
                  className="primary"
                  onClick={() => navigate("inventory")}
                >
                  <Boxes size={18} />
                  Ver inventario
                </button>
              </div>
            )}
          </>
        )}
        {tab === "shopping" && shop && (
          <>
            <button
              className="back-button"
              onClick={() => {
                setShop(null);
                setSelected([]);
              }}
            >
              <ArrowLeft size={17} />
              Volver a la lista
            </button>
            <div className="shopping-intro">
              <span>COMPRA LO QUE FALTA</span>
              <h2>De la tienda a casa.</h2>
              <p>
                Marca los productos que has comprado. Puedes ajustar cuántas
                unidades has cogido antes de confirmar.
              </p>
            </div>
            <div className="shopping-progress">
              <span>
                {selected.length} de {shopping.length} productos marcados
              </span>
              <strong>
                {shopping.length
                  ? Math.round(
                      (selected.filter((s) =>
                        shopping.some((p) => p.id === s.id),
                      ).length /
                        shopping.length) *
                        100,
                    )
                  : 0}
                %
              </strong>
              <div>
                <i
                  style={{
                    width: `${shopping.length ? (selected.filter((s) => shopping.some((p) => p.id === s.id)).length / shopping.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="product-card shopping-card">
              {shopping.map((p) => {
                const choice = selected.find((s) => s.id === p.id);
                return (
                  <div key={p.id} className="purchase-item">
                    <button
                      className={"shopping-row " + (choice ? "checked" : "")}
                      onClick={() => select(p)}
                      disabled={busy}
                    >
                      <span className="shopping-check">
                        {choice && <Check size={19} />}
                      </span>
                      <span className="food">{p.emoji}</span>
                      <span className="product-text">
                        <strong>{p.name}</strong>
                        <small>
                          Hay {p.stockCount} · Objetivo {p.targetCount} ·{" "}
                          {p.pack}
                        </small>
                      </span>
                      <span className="shopping-qty">Faltan {p.toBuy}</span>
                    </button>
                    {choice && (
                      <div className="purchase-quantity">
                        <span>Unidades compradas</span>
                        <div className="stepper">
                          <button
                            aria-label={`Comprar una unidad menos de ${p.name}`}
                            disabled={busy || choice.count <= 1}
                            onClick={() => boughtCount(p, -1)}
                          >
                            <Minus size={17} />
                          </button>
                          <span className="has-count">{choice.count}</span>
                          <button
                            className="plus"
                            aria-label={`Comprar una unidad más de ${p.name}`}
                            disabled={
                              busy || choice.count >= 999 - p.stockCount
                            }
                            onClick={() => boughtCount(p, 1)}
                          >
                            <Plus size={17} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!shopping.length && (
              <div className="empty-state">
                <CheckCheck />
                <h3>Ya no falta nada en esta tienda.</h3>
              </div>
            )}
            <div className="checkout-bar">
              <span>
                {selected.reduce((a, p) => a + p.count, 0)} unidades compradas
              </span>
              <button
                className="primary"
                disabled={!selected.length || busy}
                onClick={checkout}
              >
                <CheckCheck size={18} />
                {busy ? "Guardando…" : "Guardar compra"}
              </button>
            </div>
            <p className="footnote">
              Las unidades se sumarán a lo que hay en casa.
            </p>
          </>
        )}
        {tab === "activity" && (
          <>
            <p className="page-subtitle">
              Lo que entra, lo que se usa y lo que compramos.
            </p>
            <div className="activity-intro">
              <History size={20} />
              <span>Los últimos 100 cambios de casa.</span>
            </div>
            {!activity.length ? (
              <div className="empty-state">
                <span>✨</span>
                <h3>Una casa por organizar</h3>
                <p>
                  Aquí verás los cambios en existencias y las compras de todos.
                </p>
              </div>
            ) : (
              <div className="activity-list">
                {activity.map((a) => (
                  <article key={a.id}>
                    <span className={"activity-icon " + a.action}>
                      {a.action === "purchased" ? (
                        <Check size={18} />
                      ) : a.action === "deleted" ? (
                        <Trash2 size={16} />
                      ) : a.action === "consumed" || a.action === "removed" ? (
                        <Minus size={18} />
                      ) : a.action === "edited" ? (
                        <Pencil size={16} />
                      ) : (
                        <Plus size={18} />
                      )}
                    </span>
                    <div>
                      <p>
                        <strong>{a.name}</strong>{" "}
                        {actions[a.action] || "actualizó"}{" "}
                        <strong>{a.product}</strong>
                        {a.amount > 0 && (
                          <span className="amount-label"> ×{a.amount}</span>
                        )}
                      </p>
                      <time>{date(a.created_at)}</time>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <nav className="bottom-nav" aria-label="Navegación principal">
        {nav.map(({ id, label, Icon }) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <span className="nav-icon">
              <Icon size={24} />
              {id === "shopping" && needs.length > 0 && (
                <b>{needs.length > 99 ? "99+" : needs.length}</b>
              )}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {edit && (
        <div className="overlay" onClick={() => !busy && setEdit(null)}>
          <section
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" />
            <button
              autoFocus
              className="close"
              disabled={busy}
              aria-label="Cerrar"
              onClick={() => setEdit(null)}
            >
              <X size={21} />
            </button>
            <p className="eyebrow">LO QUE USÁIS EN CASA</p>
            <h2 id="edit-title">
              {edit.id ? "Editar producto" : "Añadir al inventario"}
            </h2>
            <form onSubmit={save}>
              <div className="product-preview">
                <span>{edit.emoji || "🛍️"}</span>
                <div>
                  <strong>{edit.name || "¿Qué tenemos en casa?"}</strong>
                  <small>{edit.pack || "Formato del producto"}</small>
                </div>
              </div>
              <label>
                Nombre
                <input
                  required
                  maxLength={100}
                  placeholder="Ej. Harina de trigo"
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </label>
              <div className="form-grid">
                <label>
                  Supermercado
                  <input
                    list="stores"
                    maxLength={50}
                    placeholder="Ej. Mercadona"
                    value={edit.store}
                    onChange={(e) =>
                      setEdit({ ...edit, store: e.target.value })
                    }
                  />
                </label>
                <datalist id="stores">
                  {stores.map((s) => (
                    <option value={s} key={s} />
                  ))}
                </datalist>
                <label>
                  Categoría
                  <select
                    value={edit.category}
                    onChange={(e) =>
                      setEdit({ ...edit, category: e.target.value })
                    }
                  >
                    {cats.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="stock-form">
                <div className="form-grid">
                  <label>
                    Cuánto hay en casa
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      placeholder="0"
                      value={stockInput}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (acceptsCount(v)) {
                          setStockInput(v);
                          if (!targetTouched) setTargetInput(v);
                        }
                      }}
                    />
                  </label>
                  <label>
                    Cuánto quieres mantener
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      placeholder="0"
                      value={targetInput}
                      onChange={(e) => {
                        if (acceptsCount(e.target.value)) {
                          setTargetTouched(true);
                          setTargetInput(e.target.value);
                        }
                      }}
                    />
                  </label>
                </div>
                <p>
                  Si quedan {Number(stockInput || 0)} y quieres tener{" "}
                  {Number(targetInput || 0)}, la lista propondrá comprar{" "}
                  <strong>
                    {Math.max(
                      0,
                      Number(targetInput || 0) - Number(stockInput || 0),
                    )}
                  </strong>
                  .
                </p>
              </div>
              <div className="form-grid">
                <label>
                  Formato
                  <input
                    maxLength={60}
                    placeholder="Ej. paquete de 1 kg"
                    value={edit.pack}
                    onChange={(e) => setEdit({ ...edit, pack: e.target.value })}
                  />
                </label>
                <label>
                  Precio por unidad (€)
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    maxLength={12}
                    placeholder="Opcional · 0 €"
                    value={priceInput}
                    onChange={(e) => {
                      if (acceptsPrice(e.target.value))
                        setPriceInput(e.target.value);
                    }}
                  />
                  <small className="field-help">
                    Vacío = 0. Admite coma o punto.
                  </small>
                </label>
              </div>
              <label>
                Emoji o icono
                <input
                  className="emoji-input"
                  type="text"
                  autoComplete="off"
                  maxLength={64}
                  placeholder="Toca aquí y usa tu teclado de emojis"
                  value={edit.emoji}
                  onChange={(e) => setEdit({ ...edit, emoji: e.target.value })}
                />
                <small className="field-help">
                  Puedes escribir o pegar cualquier emoji desde el móvil.
                </small>
              </label>
              <div className="emoji-picker" aria-label="Emojis sugeridos">
                {emojiChoices.map((e) => (
                  <button
                    type="button"
                    aria-label={"Usar " + e}
                    aria-pressed={edit.emoji === e}
                    className={edit.emoji === e ? "selected" : ""}
                    key={e}
                    onClick={() => setEdit({ ...edit, emoji: e })}
                  >
                    {e}
                  </button>
                ))}
              </div>
              {error && (
                <p className="error-banner" role="alert">
                  {error}
                </p>
              )}
              <div className="sheet-actions">
                {edit.id && (
                  <button
                    type="button"
                    className="delete-button"
                    disabled={busy}
                    onClick={() => {
                      const p = items.find((i) => i.id === edit.id);
                      if (p) setAskDelete(p);
                    }}
                  >
                    <Trash2 size={17} />
                    Eliminar
                  </button>
                )}
                <button className="primary" disabled={busy}>
                  {busy
                    ? "Guardando…"
                    : edit.id
                      ? "Guardar cambios"
                      : "Añadir producto"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {profileOpen && (
        <div className="overlay" onClick={() => !busy && setProfileOpen(false)}>
          <section
            className="sheet profile-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" />
            <button
              autoFocus
              className="close"
              disabled={busy}
              aria-label="Cerrar"
              onClick={() => setProfileOpen(false)}
            >
              <X size={21} />
            </button>
            <p className="eyebrow">A TU MANERA</p>
            <h2 id="profile-title">Tu perfil</h2>
            <form onSubmit={saveProfile}>
              <label>
                Nombre
                <input
                  required
                  maxLength={40}
                  value={draftProfile.name}
                  onChange={(e) =>
                    setDraftProfile({ ...draftProfile, name: e.target.value })
                  }
                />
              </label>
              <label>Apariencia</label>
              <div className="theme-picker">
                {[
                  { id: "auto", label: "Auto", Icon: Smartphone },
                  { id: "light", label: "Claro", Icon: Sun },
                  { id: "dark", label: "Oscuro", Icon: Moon },
                ].map(({ id, label, Icon }) => (
                  <button
                    type="button"
                    key={id}
                    className={draftProfile.theme === id ? "selected" : ""}
                    aria-pressed={draftProfile.theme === id}
                    onClick={() =>
                      setDraftProfile({ ...draftProfile, theme: id })
                    }
                  >
                    <Icon size={17} />
                    {label}
                  </button>
                ))}
              </div>
              <div className="profile-detail">
                <RefreshCw size={19} />
                <div>
                  <strong>Un inventario compartido</strong>
                  <p>
                    Se actualiza cada 15 segundos mientras la aplicación está
                    abierta. Verás avisos cuando otra persona cambie las
                    existencias.
                  </p>
                </div>
              </div>
              <PwaInstall />
              <p className="profile-info">
                Los avisos aparecen dentro de la aplicación. No se envían
                notificaciones cuando está cerrada.
              </p>
              {error && (
                <p className="error-banner" role="alert">
                  {error}
                </p>
              )}
              <button className="primary full-width" disabled={busy}>
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
            </form>
            <button
              className="logout-button"
              disabled={busy}
              onClick={onLogout}
            >
              <LogOut size={18} />
              Cerrar sesión<small>{profile.username}</small>
            </button>
          </section>
        </div>
      )}
      {askDelete && (
        <div
          className="overlay confirmation-layer"
          onClick={() => !busy && setAskDelete(null)}
        >
          <section
            className="sheet confirm-sheet"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" />
            <span className="confirm-icon">
              <Trash2 size={24} />
            </span>
            <h2 id="delete-title">¿Eliminar {askDelete.name}?</h2>
            <p>
              Se eliminará del inventario y dejará de aparecer en la lista de
              compra de todos.
            </p>
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            <div className="confirm-actions">
              <button
                autoFocus
                disabled={busy}
                onClick={() => setAskDelete(null)}
              >
                Cancelar
              </button>
              <button className="danger" disabled={busy} onClick={remove}>
                {busy ? "Eliminando…" : "Eliminar producto"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

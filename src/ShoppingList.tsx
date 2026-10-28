import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus,
  Minus,
  Search,
  Check,
  Pencil,
  Trash2,
  ShoppingCart,
  LayoutGrid,
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
  Package,
  CheckCheck,
  ShoppingBasket,
} from "lucide-react";
import { api } from "./api";
export type Profile = { username: string; name: string; theme: string };
type Product = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  done: boolean;
  version: number;
  store: string;
  pack: string;
  emoji: string;
  basketCount: number;
  uses: number;
};
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
const emojis = ["🥬", "🥛", "🥩", "🥫", "🥖", "🧃", "🧴", "🛍️"];
const emojiChoices = [
  "🛍️",
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
  emoji: "🛍️",
  quantity: 1,
  price: 0,
  done: false,
};
const actionText: Record<string, string> = {
  created: "creó el producto",
  edited: "editó",
  deleted: "eliminó",
  added: "añadió a la cesta",
  removed: "quitó de la cesta",
  purchased: "compró",
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
    [tab, setTab] = useState("products"),
    [category, setCategory] = useState("Todas"),
    [store, setStore] = useState("Todos"),
    [search, setSearch] = useState(""),
    [edit, setEdit] = useState<Partial<Product> | null>(null),
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
      const products = await r.json();
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
            `${other.name} ${actionText[other.action] || "actualizó"} ${other.product}`,
          );
      }
      latest.current = newest;
    } catch {
      setConnected(false);
      setError("No se pudo actualizar la lista. Comprueba tu conexión.");
    } finally {
      setLoading(false);
      active.current = false;
    }
  }, [profile.username, notify]);
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    const focus = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", focus);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", focus);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [load]);
  const overlayOpen = !!edit || profileOpen || !!askDelete;
  useEffect(() => {
    if (!overlayOpen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previous = document.activeElement as HTMLElement;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setEdit(null);
        setProfileOpen(false);
        setAskDelete(null);
      }
      if (e.key === "Tab") {
        const sheets = document.querySelectorAll(".sheet");
        const current = sheets[sheets.length - 1];
        const nodes = Array.from(
          current.querySelectorAll<HTMLElement>(
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
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [overlayOpen, busy]);
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
      const data = await mutate(`/api/products/${p.id}/quantity`, "POST", {
        delta,
      });
      setItems((previous) => previous.map((i) => (i.id === p.id ? data : i)));
      notify(
        delta > 0 ? `${p.name} en la cesta` : `Una unidad menos de ${p.name}`,
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await mutate("/api/products", "POST", edit);
      setEdit(null);
      notify("Producto guardado");
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
      const p = await mutate("/api/profile", "POST", {
        name: draftProfile.name,
        theme: draftProfile.theme,
      });
      onProfile(p);
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
      setSelected([]);
      setShop(null);
      notify("¡Compra terminada! Los productos siguen en tu catálogo.");
      await load();
    } catch (e) {
      setError((e as Error).message);
      setSelected([]);
      await load();
    } finally {
      setBusy(false);
    }
  }
  const basket = items.filter((p) => p.basketCount > 0),
    unitCount = basket.reduce((a, p) => a + p.basketCount, 0),
    stores = Array.from(new Set(items.map((p) => p.store))).sort((a, b) =>
      a.localeCompare(b),
    ),
    basketStores = Array.from(new Set(basket.map((p) => p.store))).sort(
      (a, b) => a.localeCompare(b),
    ),
    frequent = [...items]
      .filter((p) => p.uses > 0)
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 8),
    filtered = items.filter(
      (p) =>
        (category === "Todas" || p.category === category) &&
        (store === "Todos" || p.store === store) &&
        p.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")),
    ),
    shopping = shop ? basket.filter((p) => p.store === shop) : [],
    estimate = basket.reduce((a, p) => a + p.basketCount * p.price, 0);
  function openEdit(p?: Product) {
    setError("");
    setEdit(p ? { ...p } : { ...blank });
  }
  function select(p: Product) {
    setSelected((previous) =>
      previous.some((s) => s.id === p.id)
        ? previous.filter((s) => s.id !== p.id)
        : [...previous, { id: p.id, count: p.basketCount, version: p.version }],
    );
  }
  const stepper = (p: Product) => (
    <div className="stepper">
      <button
        disabled={busy || p.basketCount === 0}
        onClick={() => change(p, -1)}
        aria-label={`Quitar una unidad de ${p.name}`}
      >
        <Minus size={19} />
      </button>
      <span
        className={p.basketCount ? "has-count" : ""}
        aria-label={`${p.basketCount} unidades`}
      >
        {p.basketCount}
      </span>
      <button
        className="plus"
        disabled={busy || p.basketCount >= 999}
        onClick={() => change(p, 1)}
        aria-label={`Añadir una unidad de ${p.name}`}
      >
        <Plus size={20} />
      </button>
    </div>
  );
  const productRow = (p: Product, showStore = false) => (
    <div className="product-row" key={p.id}>
      <button
        className="product-info"
        onClick={() => openEdit(p)}
        aria-label={`Editar ${p.name}`}
      >
        <span className="food">{p.emoji}</span>
        <span className="product-text">
          {showStore && <span className="store-name">{p.store}</span>}
          <strong>{p.name}</strong>
          <small>
            {p.category} <span>·</span> {p.pack}
          </small>
        </span>
      </button>
      {stepper(p)}
    </div>
  );
  return (
    <div className="mobile-app">
      <aside className="desktop-sidebar">
        <a className="desktop-brand" href="/">
          <ShoppingBasket /> en casa<span>.</span>
        </a>
        <div className="house-label">UNA LISTA, TODA LA CASA</div>
        {[
          ["products", "Productos", LayoutGrid],
          ["basket", "Cesta", ShoppingCart],
          ["activity", "Actividad", History],
        ].map(([id, label, Icon]) => (
          <button
            key={id as string}
            className={tab === id ? "chosen" : ""}
            onClick={() => {
              setTab(id as string);
              setShop(null);
            }}
          >
            {typeof Icon !== "string" && <Icon size={20} />}
            <span>{label as string}</span>
            {id === "basket" && unitCount > 0 && <b>{unitCount}</b>}
          </button>
        ))}
        <div className="sidebar-note">
          <span>🧺</span>
          <strong>
            Que no se quede
            <br />
            nada por apuntar.
          </strong>
          <p>La compra, entre todos.</p>
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
                ? "MODO COMPRA"
                : tab === "basket"
                  ? "TU COMPRA"
                  : tab === "activity"
                    ? "LO QUE PASA EN CASA"
                    : "LISTA COMPARTIDA"}
            </p>
            <h1>
              {shop ||
                (tab === "products"
                  ? "Carrito de casa"
                  : tab === "basket"
                    ? "Cesta"
                    : "Actividad")}
            </h1>
          </div>
          <button
            className="avatar"
            onClick={() => {
              setDraftProfile(profile);
              setError("");
              setProfileOpen(true);
            }}
            aria-label="Abrir tu perfil"
          >
            {profile.name.slice(0, 1).toUpperCase()}
          </button>
        </header>
        <div className="connection">
          <span className={connected ? "online" : "offline"} />
          {loading
            ? "Conectando…"
            : connected
              ? "Lista compartida al día"
              : "Sin conexión"}
          <button
            onClick={() => {
              setError("");
              load();
            }}
            aria-label="Actualizar lista"
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
        {tab === "products" && (
          <>
            <div className="search-box">
              <Search size={22} />
              <input
                aria-label="Buscar productos"
                placeholder="Buscar productos"
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
            {frequent.length > 0 && !search && (
              <section className="frequent">
                <div className="section-title">
                  <h2>Frecuentes</h2>
                  <small>Un toque y a la cesta</small>
                </div>
                <div className="horizontal-scroll">
                  {frequent.map((p) => (
                    <button
                      disabled={busy}
                      key={p.id}
                      onClick={() => change(p, 1)}
                    >
                      <span>{p.emoji}</span>
                      <strong>{p.name}</strong>
                      <Plus size={15} />
                    </button>
                  ))}
                </div>
              </section>
            )}
            <div className="filter-row horizontal-scroll">
              <button
                className={category === "Todas" ? "active" : ""}
                onClick={() => setCategory("Todas")}
              >
                Todos
              </button>
              {cats.map((c, i) => (
                <button
                  className={category === c ? "active" : ""}
                  key={c}
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
                <Plus size={16} /> Nuevo
              </button>
            </div>
            <label className="store-filter">
              <SlidersHorizontal size={14} />
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
            {loading ? (
              <div className="empty-state">
                <RefreshCw className="spin" />
                <h3>Preparando tu lista…</h3>
              </div>
            ) : filtered.length ? (
              <div className="product-card">
                {filtered.map((p) => productRow(p, true))}
              </div>
            ) : (
              <div className="empty-state">
                <span>🥑</span>
                <h3>
                  {items.length
                    ? "No encontramos ese producto"
                    : "Tu próxima compra empieza aquí"}
                </h3>
                <p>
                  {items.length
                    ? "Prueba otro nombre o cambia los filtros."
                    : "Crea los productos que compráis en casa y añádelos a la cesta cuando hagan falta."}
                </p>
                <button className="primary" onClick={() => openEdit()}>
                  <Plus size={18} />
                  Crear producto
                </button>
              </div>
            )}
            <p className="footnote">
              <Pencil size={12} /> Toca un producto para editarlo o eliminarlo.
            </p>
          </>
        )}
        {tab === "basket" && !shop && (
          <>
            <p className="page-subtitle">
              {unitCount} {unitCount === 1 ? "unidad" : "unidades"}{" "}
              <span>·</span> {basket.length}{" "}
              {basket.length === 1 ? "producto" : "productos"}
            </p>
            {basket.length > 0 ? (
              <>
                <div className="basket-summary">
                  <div>
                    <ShoppingBasket size={20} />
                    <span>Todo lo que hace falta</span>
                  </div>
                  <strong>{money(estimate)}</strong>
                  <small>Total estimado según tus precios</small>
                </div>
                {basketStores.map((s) => (
                  <section className="store-section" key={s}>
                    <div className="section-title">
                      <h2 className="store-heading">
                        <Store size={15} />
                        {s}
                      </h2>
                      <small>
                        {basket
                          .filter((p) => p.store === s)
                          .reduce((a, p) => a + p.basketCount, 0)}{" "}
                        unidades
                      </small>
                    </div>
                    <div className="product-card">
                      {basket
                        .filter((p) => p.store === s)
                        .map((p) => productRow(p))}
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
                      <ShoppingCart size={21} />
                      Empezar compra
                      <ChevronRight size={18} />
                    </button>
                  </section>
                ))}
              </>
            ) : (
              <div className="empty-state">
                <span>🧺</span>
                <h3>Tu cesta está tranquila</h3>
                <p>
                  Añade lo que falta desde Productos. Lo encontrarás aquí,
                  organizado por supermercado.
                </p>
                <button className="primary" onClick={() => setTab("products")}>
                  <Plus size={18} />
                  Añadir a la cesta
                </button>
              </div>
            )}
          </>
        )}
        {tab === "basket" && shop && (
          <>
            <button
              className="back-button"
              onClick={() => {
                setShop(null);
                setSelected([]);
              }}
            >
              <ArrowLeft size={17} />
              Volver a la cesta
            </button>
            <div className="shopping-intro">
              <span>EN EL SUPERMERCADO</span>
              <h2>Al carro, sin olvidos.</h2>
              <p>
                Marca lo que ya has cogido. Al terminar se quitará de la cesta y
                seguirá en tus productos.
              </p>
            </div>
            <div className="shopping-progress">
              <span>
                {selected.length} de {shopping.length} productos
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
              {shopping.map((p) => (
                <button
                  className={
                    "shopping-row " +
                    (selected.some((s) => s.id === p.id) ? "checked" : "")
                  }
                  key={p.id}
                  onClick={() => select(p)}
                >
                  <span className="shopping-check">
                    {selected.some((s) => s.id === p.id) && <Check size={19} />}
                  </span>
                  <span className="food">{p.emoji}</span>
                  <span className="product-text">
                    <strong>{p.name}</strong>
                    <small>
                      {p.pack} · {p.basketCount}{" "}
                      {p.basketCount === 1 ? "unidad" : "unidades"}
                    </small>
                  </span>
                  <span className="shopping-qty">×{p.basketCount}</span>
                </button>
              ))}
            </div>
            {!shopping.length && (
              <div className="empty-state">
                <CheckCheck />
                <h3>No quedan productos en esta tienda.</h3>
              </div>
            )}
            <div className="checkout-bar">
              <span>{selected.length} seleccionados</span>
              <button
                className="primary"
                disabled={!selected.length || busy}
                onClick={checkout}
              >
                <CheckCheck size={19} />
                {busy ? "Guardando…" : "Terminar compra"}
              </button>
            </div>
          </>
        )}
        {tab === "activity" && (
          <>
            <p className="page-subtitle">
              Las pequeñas cosas, hechas entre todos.
            </p>
            <div className="activity-intro">
              <History size={20} />
              <span>Los últimos 100 cambios de vuestra lista.</span>
            </div>
            {!activity.length ? (
              <div className="empty-state">
                <span>✨</span>
                <h3>Una casa por estrenar</h3>
                <p>Los productos y cambios que hagáis aparecerán aquí.</p>
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
                      ) : a.action === "removed" ? (
                        <Minus size={18} />
                      ) : a.action === "edited" ? (
                        <Pencil size={16} />
                      ) : (
                        <Plus size={18} />
                      )}
                    </span>
                    <div>
                      <p>
                        <strong>{a.name}</strong> {actionText[a.action]}{" "}
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
        {[
          ["products", "Productos", LayoutGrid],
          ["basket", "Cesta", ShoppingCart],
          ["activity", "Actividad", History],
        ].map(([id, label, Icon]) => (
          <button
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "active" : ""}
            key={id as string}
            onClick={() => {
              setTab(id as string);
              setShop(null);
              setSelected([]);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <span className="nav-icon">
              {typeof Icon !== "string" && <Icon size={24} />}{" "}
              {id === "basket" && basket.length > 0 && (
                <b>{basket.length > 99 ? "99+" : basket.length}</b>
              )}
            </span>
            <span>{label as string}</span>
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
            <p className="eyebrow">TU CATÁLOGO DE CASA</p>
            <h2 id="edit-title">
              {edit.id ? "Editar producto" : "Un nuevo producto"}
            </h2>
            <form onSubmit={save}>
              <div className="product-preview">
                <span>{edit.emoji}</span>
                <div>
                  <strong>{edit.name || "¿Qué compramos?"}</strong>
                  <small>{edit.pack || "Formato del producto"}</small>
                </div>
              </div>
              <label>
                Nombre
                <input
                  required
                  maxLength={100}
                  placeholder="Ej. Leche semidesnatada"
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
                    onChange={(e) => {
                      const i = cats.indexOf(e.target.value);
                      setEdit({
                        ...edit,
                        category: e.target.value,
                        emoji: edit.id ? edit.emoji : emojis[i],
                      });
                    }}
                  >
                    {cats.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Formato
                  <input
                    maxLength={60}
                    placeholder="Ej. botella 1 l, pack 6…"
                    value={edit.pack}
                    onChange={(e) => setEdit({ ...edit, pack: e.target.value })}
                  />
                </label>
                <label>
                  Precio por unidad (€)
                  <input
                    required
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    value={edit.price}
                    onChange={(e) =>
                      setEdit({ ...edit, price: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <label>Icono del producto</label>
              <div className="emoji-picker">
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
                      const p = items.find((p) => p.id === edit.id);
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
                      : "Crear producto"}
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
              aria-label="Cerrar"
              disabled={busy}
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
                  ["auto", "Auto", Smartphone],
                  ["light", "Claro", Sun],
                  ["dark", "Oscuro", Moon],
                ].map(([id, label, Icon]) => (
                  <button
                    type="button"
                    className={draftProfile.theme === id ? "selected" : ""}
                    aria-pressed={draftProfile.theme === id}
                    key={id as string}
                    onClick={() =>
                      setDraftProfile({ ...draftProfile, theme: id as string })
                    }
                  >
                    {typeof Icon !== "string" && <Icon size={17} />}{" "}
                    {label as string}
                  </button>
                ))}
              </div>
              <div className="profile-detail">
                <span>
                  <RefreshCw size={19} />
                </span>
                <div>
                  <strong>Una lista que compartís</strong>
                  <p>
                    Se actualiza cada 15 segundos mientras la aplicación está
                    abierta. Verás avisos cuando otra persona haga cambios.
                  </p>
                </div>
              </div>
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
              Cerrar sesión <small>{profile.username}</small>
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
              Se eliminará del catálogo y de la cesta para todos los miembros de
              casa.
            </p>
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

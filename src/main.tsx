import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ShoppingBasket, ArrowRight, Eye, EyeOff } from "lucide-react";
import ShoppingList, { type Profile } from "./ShoppingList";
import { api } from "./api";
import "./style.css";
function App() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [ready, setReady] = useState(false),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  const theme = profile?.theme || "dark";
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "auto"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    api("/api/me")
      .then(async (r) => {
        if (r.ok) setProfile(await r.json());
        else if (r.status !== 401)
          setError("No se pudo contactar con el servidor.");
      })
      .catch(() => setError("No se pudo contactar con el servidor."))
      .finally(() => setReady(true));
    const expire = () => setProfile(null);
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "No se pudo iniciar sesión.");
      const me = await api("/api/me");
      if (!me.ok) throw Error("No se pudo abrir tu perfil.");
      setProfile(await me.json());
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      const r = await api("/api/logout", { method: "POST" });
      if (!r.ok) throw Error();
      setProfile(null);
    } catch {
      alert("No se pudo cerrar sesión. Vuelve a intentarlo.");
    }
  }
  if (!ready)
    return (
      <div className="login-page">
        <div className="loading-brand">
          <ShoppingBasket size={35} />
          <span>Preparando tu casa…</span>
        </div>
      </div>
    );
  if (profile)
    return (
      <ShoppingList
        profile={profile}
        onProfile={setProfile}
        onLogout={logout}
      />
    );
  return (
    <div className="login-page">
      <section className="login-card">
        <div className="login-logo">
          <ShoppingBasket size={28} />
        </div>
        <p className="eyebrow">UNA LISTA, TODA LA CASA</p>
        <h1>
          Que no falte
          <br />
          lo de siempre<span>.</span>
        </h1>
        <p>
          La compra de casa, organizada entre todos.
          <br />
          Entra y apunta lo que hace falta.
        </p>
        <form onSubmit={login}>
          <label>
            Usuario
            <input
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={32}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu usuario"
            />
          </label>
          <label>
            Contraseña
            <div className="password-field">
              <input
                required
                type={show ? "text" : "password"}
                autoComplete="current-password"
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
              />
              <button
                type="button"
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          <button className="primary full-width" disabled={busy}>
            {busy ? "Entrando…" : "Entrar en casa"}
            <ArrowRight size={19} />
          </button>
        </form>
        <small>¿No tienes usuario? Pídeselo a quien gestiona la casa.</small>
      </section>
      <span className="login-footer">
        HECHO PARA LAS PEQUEÑAS COSAS DE CADA DÍA
      </span>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { useEffect, useState } from "react";
import { Download, Check, RefreshCw, ChevronDown } from "lucide-react";
import { applyUpdate, installApp, registerPwa, usePwa } from "./pwa";
export default function PwaInstall() {
  const { prompt, installed } = usePwa();
  const [help, setHelp] = useState(false),
    [busy, setBusy] = useState(false);
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  async function install() {
    if (!prompt) {
      setHelp(!help);
      return;
    }
    setBusy(true);
    try {
      await installApp();
    } catch {
      setHelp(true);
    } finally {
      setBusy(false);
    }
  }
  if (installed)
    return (
      <div className="pwa-installed">
        <Check size={15} />
        Estás usando En casa como aplicación
      </div>
    );
  return (
    <section className="pwa-install">
      <button
        type="button"
        className="install-button"
        disabled={busy}
        onClick={install}
        aria-expanded={!prompt ? help : undefined}
      >
        <Download size={19} />
        <span>
          {busy ? "Abriendo instalación…" : "Instalar aplicación"}
          <small>Tu inventario, desde la pantalla de inicio</small>
        </span>
        {!prompt && <ChevronDown size={17} />}
      </button>
      {help && (
        <div className="install-help">
          {ios ? (
            <p>
              Abre esta web en Safari, pulsa <strong>Compartir</strong> y elige{" "}
              <strong>Añadir a pantalla de inicio</strong>. Si aparece la
              opción, activa <strong>Abrir como app web</strong> y pulsa Añadir.
            </p>
          ) : (
            <p>
              En el menú de tu navegador busca{" "}
              <strong>Instalar aplicación</strong> o{" "}
              <strong>Añadir a pantalla de inicio</strong>. Si no aparece, abre
              la web con Chrome o Edge y vuelve a intentarlo.
            </p>
          )}
          <p>
            La instalación depende del navegador. Necesitas conexión para
            consultar y guardar el inventario.
          </p>
        </div>
      )}
    </section>
  );
}
export function PwaStatus() {
  const { waiting } = usePwa();
  const [dismissed, setDismissed] = useState<ServiceWorker | null>(null),
    [applying, setApplying] = useState(false);
  useEffect(() => {
    if (document.readyState === "complete") {
      registerPwa();
      return;
    }
    window.addEventListener("load", registerPwa, { once: true });
    return () => window.removeEventListener("load", registerPwa);
  }, []);
  if (!waiting || dismissed === waiting) return null;
  return (
    <div className="pwa-update" role="status">
      <RefreshCw size={19} />
      <div>
        <strong>Hay una nueva versión</strong>
        <p>Guarda tus cambios antes de actualizar.</p>
      </div>
      <button
        type="button"
        disabled={applying}
        onClick={() => {
          setApplying(true);
          applyUpdate();
        }}
      >
        {applying ? "Actualizando…" : "Actualizar"}
      </button>
      <button
        type="button"
        disabled={applying}
        onClick={() => setDismissed(waiting)}
      >
        Luego
      </button>
    </div>
  );
}

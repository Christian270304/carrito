import { useSyncExternalStore } from "react";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
type State = {
  prompt: InstallPrompt | null;
  installed: boolean;
  waiting: ServiceWorker | null;
};
const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
let state: State = { prompt: null, installed: standalone(), waiting: null };
const listeners = new Set<() => void>();
function update(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function usePwa() {
  return useSyncExternalStore(subscribe, () => state);
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  update({ prompt: e as InstallPrompt });
});
window.addEventListener("appinstalled", () =>
  update({ installed: true, prompt: null }),
);
const displayQuery = window.matchMedia("(display-mode: standalone)");
displayQuery.addEventListener("change", () =>
  update({ installed: standalone() }),
);
export async function installApp() {
  const prompt = state.prompt;
  if (!prompt) return false;
  update({ prompt: null });
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice.outcome === "accepted";
}
let applyingUpdate = false;
export function applyUpdate() {
  if (!state.waiting) return;
  applyingUpdate = true;
  state.waiting.postMessage({ type: "SKIP_WAITING" });
}
let registered = false;
export async function registerPwa() {
  if (registered || !("serviceWorker" in navigator) || !window.isSecureContext)
    return;
  registered = true;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    if (registration.waiting && navigator.serviceWorker.controller)
      update({ waiting: registration.waiting });
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          update({ waiting: worker });
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (applyingUpdate) window.location.reload();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible")
        registration.update().catch(() => {});
    });
  } catch {
    registered =
      false; /* La web sigue funcionando si el navegador no permite registrar la PWA. */
  }
}

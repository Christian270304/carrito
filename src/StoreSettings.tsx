import { useState } from "react";
import { Plus, Check, Store, Trash2 } from "lucide-react";
import { api } from "./api";

export type Supermarket = {
  id: string;
  name: string;
  products: number;
};

export default function StoreSettings({
  stores,
  onChange,
}: {
  stores: Supermarket[];
  onChange: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(path: string, method: string, body: unknown) {
    setBusy(true);
    setError("");

    try {
      const r = await api(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await r.json();

      if (!r.ok) {
        throw Error(data.error || "No se pudo guardar.");
      }

      setName("");
      setDrafts({});
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="store-settings">
      <h3>
        <Store size={18} />
        Supermercados de casa
      </h3>

      <p>
        Esta lista es la misma para todos. Al crear un producto solo tendréis
        que elegir uno.
      </p>

      <form
        className="add-store"
        onSubmit={(e) => {
          e.preventDefault();
          send("/api/stores", "POST", { name });
        }}
      >
        <input
          aria-label="Nombre del nuevo supermercado"
          required
          maxLength={50}
          placeholder="Nuevo supermercado"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          type="submit"
          disabled={busy || !name.trim()}
          aria-label="Añadir supermercado"
        >
          <Plus size={21} />
        </button>
      </form>

      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}

      <div className="store-settings-list">
        {stores.map((s) => (
          <div className="store-settings-row" key={s.id}>
            {s.id === "unassigned" ? (
              <strong>{s.name}</strong>
            ) : (
              <>
                <div className="store-name-edit">
                  <input
                    aria-label={`Nombre de ${s.name}`}
                    maxLength={50}
                    value={drafts[s.id] ?? s.name}
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [s.id]: e.target.value,
                      })
                    }
                  />

                  <button
                    type="button"
                    disabled={
                      busy ||
                      !(drafts[s.id] ?? s.name).trim() ||
                      drafts[s.id] === undefined
                    }
                    aria-label={`Guardar nombre de ${s.name}`}
                    onClick={() =>
                      send(`/api/stores/${s.id}`, "PATCH", {
                        name: drafts[s.id],
                      })
                    }
                  >
                    <Check size={18} />
                  </button>
                </div>

                <small>{s.products} productos</small>

                <div className="store-move">
                  <label>
                    Trasladar productos a
                    <select
                      aria-label={`Destino para productos de ${s.name}`}
                      value={destinations[s.id] || "unassigned"}
                      onChange={(e) =>
                        setDestinations({
                          ...destinations,
                          [s.id]: e.target.value,
                        })
                      }
                    >
                      {stores
                        .filter((d) => d.id !== s.id)
                        .map((d) => (
                          <option value={d.id} key={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const id = destinations[s.id] || "unassigned";
                      const target = stores.find((d) => d.id === id);

                      if (
                        target &&
                        confirm(
                          `¿Eliminar ${s.name}? Sus productos pasarán a ${target.name}.`,
                        )
                      ) {
                        send(`/api/stores/${s.id}`, "DELETE", {
                          moveTo: id,
                        });
                      }
                    }}
                  >
                    <Trash2 size={15} />
                    Trasladar y eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
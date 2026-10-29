// Conserva el texto mientras se escribe: borrar el precio no vuelve a insertar un 0.
export function acceptsPrice(value) {
  return value.length <= 12 && /^\d*(?:[.,]\d{0,2})?$/.test(value);
}
export function parsePrice(value) {
  const text = value.trim();
  if (text === "") return 0;
  if (!/^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(text)) return null;
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 1000000 ? n : null;
}
export function acceptsCount(value) {
  return /^\d{0,3}$/.test(value);
}
export function parseCount(value) {
  return /^\d{0,3}$/.test(value) ? Number(value || 0) : null;
}
export function acceptsAmount(value, unit) {
  return (
    value.length <= 8 &&
    (unit === "kg" || unit === "l"
      ? /^\d{0,3}(?:[.,]\d{0,3})?$/.test(value)
      : /^\d{0,3}$/.test(value))
  );
}
export function parseAmount(value, unit) {
  if (value === "") return 0;
  if (!acceptsAmount(value, unit) || !/\d/.test(value)) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 999 ? n : null;
}

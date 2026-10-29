export const quantityUnits = ["unit", "kg", "l", "pack"];
export const roundQuantity = (n) =>
  Math.round((n + Number.EPSILON) * 1000) / 1000;
export const weighted = (unit) => unit === "kg" || unit === "l";
export function validAmount(n, unit, allowZero = true, max = 999) {
  return (
    typeof n === "number" &&
    Number.isFinite(n) &&
    n >= (allowZero ? 0 : weighted(unit) ? 0.001 : 1) &&
    n <= max &&
    (weighted(unit)
      ? Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-7
      : Number.isInteger(n))
  );
}
export const baseFactor = (p) => (p.unit === "pack" ? p.packSize : 1);
export const maxStock = (p) => 999 * baseFactor(p);
export const shortage = (p) =>
  roundQuantity(Math.max(0, p.targetCount - p.stockCount));
export function purchaseNeeded(p) {
  const missing = shortage(p);
  return p.unit === "pack" ? Math.ceil(missing / p.packSize) : missing;
}
export const purchaseToStock = (p, n) => roundQuantity(n * baseFactor(p));
export const stockUnit = (p) =>
  p.unit === "kg" ? "kg" : p.unit === "l" ? "l" : "ud.";
export const formatQuantity = (n) =>
  n.toLocaleString("es-ES", { maximumFractionDigits: 3 });
export const stockText = (p, n = p.stockCount) =>
  `${formatQuantity(n)} ${stockUnit(p)}`;
export const purchaseUnit = (p) =>
  p.unit === "pack" ? `pack de ${p.packSize}` : stockUnit(p);
export function purchaseText(p, n = p.toBuy) {
  return p.unit === "pack"
    ? `${formatQuantity(n)} ${n === 1 ? "pack" : "packs"} de ${p.packSize}`
    : `${formatQuantity(n)} ${purchaseUnit(p)}`;
}

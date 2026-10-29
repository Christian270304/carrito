export type QuantityUnit = "unit" | "kg" | "l" | "pack";
export type Measured = {
  unit: QuantityUnit;
  packSize: number;
  stockCount: number;
  targetCount: number;
  stockStep: number;
  toBuy: number;
};
export const quantityUnits: string[];
export function roundQuantity(n: number): number;
export function weighted(unit: string): boolean;
export function validAmount(
  n: unknown,
  unit: string,
  allowZero?: boolean,
  max?: number,
): boolean;
export function baseFactor(p: Pick<Measured, "unit" | "packSize">): number;
export function maxStock(p: Pick<Measured, "unit" | "packSize">): number;
export function shortage(
  p: Pick<Measured, "stockCount" | "targetCount">,
): number;
export function purchaseNeeded(
  p: Pick<Measured, "stockCount" | "targetCount" | "unit" | "packSize">,
): number;
export function purchaseToStock(
  p: Pick<Measured, "unit" | "packSize">,
  n: number,
): number;
export function stockUnit(p: Pick<Measured, "unit">): string;
export function formatQuantity(n: number): string;
export function stockText(
  p: Pick<Measured, "unit" | "stockCount">,
  n?: number,
): string;
export function purchaseUnit(p: Pick<Measured, "unit" | "packSize">): string;
export function purchaseText(
  p: Pick<Measured, "unit" | "packSize" | "toBuy">,
  n?: number,
): string;

export function parseMajorCurrencyToMinor(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : NaN;
  }

  if (typeof value !== "string") return NaN;
  const raw = value.trim().replace(/[^0-9.,-]/g, "");
  if (!raw || raw.startsWith("-")) return NaN;

  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  const separator = Math.max(comma, dot);
  let normalized: string;

  if (separator < 0) {
    normalized = raw;
  } else {
    const fraction = raw.slice(separator + 1).replace(/[.,]/g, "");
    const integer = raw.slice(0, separator).replace(/[.,]/g, "");
    normalized = fraction.length > 0 && fraction.length <= 2
      ? `${integer || "0"}.${fraction}`
      : `${integer}${fraction}`;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : NaN;
}

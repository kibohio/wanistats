/** Inclusive linear interpolation (Excel QUARTILE.INC, R type 7). Null for no values. */
export function quantile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const v = values.toSorted((a, b) => a - b);
  const pos = (v.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export const median = (values: number[]) => quantile(values, 0.5);

export function quartiles(values: number[]) {
  if (!values.length) return null;
  return {
    p25: quantile(values, 0.25)!,
    median: quantile(values, 0.5)!,
    p75: quantile(values, 0.75)!,
  };
}

export const mean = (values: number[]) =>
  values.length ? values.reduce((s, x) => s + x, 0) / values.length : null;

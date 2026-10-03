import { describe, expect, it } from 'vitest';
import { mean, median, quantile, quartiles } from './stats';

describe('quantile', () => {
  // Inclusive linear interpolation (Excel QUARTILE.INC, R type 7, numpy default):
  // position (n - 1) * p in the sorted values, interpolated between neighbours.
  it('matches QUARTILE.INC on a known set', () => {
    const v = [7, 1, 3, 5, 9, 11, 2];
    expect(quantile(v, 0.25)).toBe(2.5);
    expect(quantile(v, 0.5)).toBe(5);
    expect(quantile(v, 0.75)).toBe(8);
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
  });
  it('is null for no values', () => {
    expect(quantile([], 0.5)).toBeNull();
  });
});

describe('median, quartiles, mean', () => {
  it('handles even counts', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it('collapses to the value for a single level', () => {
    expect(quartiles([6.5])).toEqual({ p25: 6.5, median: 6.5, p75: 6.5 });
  });
  it('averages and is null when empty', () => {
    expect(mean([1, 2, 6])).toBe(3);
    expect(mean([])).toBeNull();
    expect(quartiles([])).toBeNull();
  });
});

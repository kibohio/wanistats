import { describe, expect, it } from 'vitest';
import { toggleLevel, toPaceOverrides } from './levelOverrides';

describe('level overrides', () => {
  it('maps the stored booleans to pace overrides', () => {
    expect(toPaceOverrides({ 3: true, 6: false })).toEqual({ 3: 'include', 6: 'exclude' });
  });

  it('stores a toggle only when it departs from the automatic rule', () => {
    const counted = { level: 4, included: true, autoExcluded: false };
    expect(toggleLevel({}, counted)).toEqual({ 4: false });
    expect(toggleLevel({ 4: false }, { ...counted, included: false })).toEqual({});

    const idle = { level: 6, included: false, autoExcluded: true };
    expect(toggleLevel({ 2: false }, idle)).toEqual({ 2: false, 6: true });
    expect(toggleLevel({ 6: true }, { ...idle, included: true })).toEqual({});
  });
});

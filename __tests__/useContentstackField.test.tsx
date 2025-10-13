/// <reference types="vitest" />
import { renderHook, waitFor } from '@testing-library/react';
import { useContentstackField } from '../lib/useContentstackField';

import { vi, describe, it, expect } from 'vitest';

// Mock the UI Extensions SDK module
vi.mock('@contentstack/ui-extensions-sdk', () => {
  const sdk = {
    window: { updateHeight: vi.fn() },
    field: {
      getData: vi.fn().mockReturnValue('initial'),
      setData: vi.fn(),
      setInvalid: vi.fn(),
      setDirty: vi.fn(),
      schema: { extensions: { field: { config: { foo: 'bar' } } } }
    },
    config: { some: 'config' }
  };
  return {
    init: () => Promise.resolve(sdk),
    // default export variant
    default: { init: () => Promise.resolve(sdk) }
  };
});

describe('useContentstackField', () => {
  it('initializes and returns sdk & ready=true', async () => {
    const { result } = renderHook(() => useContentstackField());
    expect(result.current.sdk).toBeNull();
    expect(result.current.ready).toBe(false);
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.sdk).not.toBeNull();
    });
    expect(result.current.sdk!.window.updateHeight).toHaveBeenCalled();
  });
});

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '@/hooks/usePagination';

describe('usePagination', () => {
  it('inicia na página 1 com limit padrão 20', () => {
    const { result } = renderHook(() => usePagination());
    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(20);
  });

  it('aceita limit customizado', () => {
    const { result } = renderHook(() => usePagination(50));
    expect(result.current.limit).toBe(50);
  });

  it('setPage atualiza a página', () => {
    const { result } = renderHook(() => usePagination());
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
  });

  it('reset volta para página 1', () => {
    const { result } = renderHook(() => usePagination());
    act(() => result.current.setPage(5));
    act(() => result.current.reset());
    expect(result.current.page).toBe(1);
  });
});

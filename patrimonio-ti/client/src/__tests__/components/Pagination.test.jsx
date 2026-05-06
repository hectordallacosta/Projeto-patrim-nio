import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '@/components/shared/Pagination';

const makePagination = (page, pages, total = pages * 20, limit = 20) => ({
  page, pages, total, limit,
});

describe('Pagination', () => {
  it('não renderiza quando só há 1 página', () => {
    const { container } = render(
      <Pagination pagination={makePagination(1, 1, 10)} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('não renderiza sem pagination', () => {
    const { container } = render(<Pagination pagination={null} onPageChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('exibe botões de navegação com múltiplas páginas', () => {
    render(<Pagination pagination={makePagination(2, 5)} onPageChange={vi.fn()} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('chama onPageChange ao clicar em uma página', () => {
    const onPageChange = vi.fn();
    render(<Pagination pagination={makePagination(1, 3)} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText('2'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('exibe range de registros corretamente', () => {
    render(<Pagination pagination={makePagination(2, 3, 55)} onPageChange={vi.fn()} />);
    expect(screen.getByText('21–40 de 55')).toBeInTheDocument();
  });
});

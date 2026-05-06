import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('não renderiza quando open=false', () => {
    render(<ConfirmDialog open={false} onClose={vi.fn()} onConfirm={vi.fn()} title="X" message="Y" />);
    expect(screen.queryByText('Y')).not.toBeInTheDocument();
  });

  it('exibe título e mensagem quando open=true', () => {
    render(<ConfirmDialog open={true} onClose={vi.fn()} onConfirm={vi.fn()} title="Excluir" message="Tem certeza?" />);
    expect(screen.getByText('Excluir')).toBeInTheDocument();
    expect(screen.getByText('Tem certeza?')).toBeInTheDocument();
  });

  it('chama onConfirm ao clicar em Confirmar', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open={true} onClose={vi.fn()} onConfirm={onConfirm} title="X" message="Y" />);
    fireEvent.click(screen.getByText('Confirmar'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('chama onClose ao clicar em Cancelar', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog open={true} onClose={onClose} onConfirm={vi.fn()} title="X" message="Y" />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('desabilita botões durante loading', () => {
    render(<ConfirmDialog open={true} onClose={vi.fn()} onConfirm={vi.fn()} title="X" message="Y" loading={true} />);
    expect(screen.getByText('Cancelar')).toBeDisabled();
    expect(screen.getByText('Confirmar')).toBeDisabled();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '@/components/shared/Modal';

describe('Modal', () => {
  it('não renderiza quando open=false', () => {
    render(<Modal open={false} onClose={vi.fn()} title="Teste"><p>conteúdo</p></Modal>);
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('renderiza título e conteúdo quando open=true', () => {
    render(<Modal open={true} onClose={vi.fn()} title="Meu Modal"><p>conteúdo</p></Modal>);
    expect(screen.getByText('Meu Modal')).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('chama onClose ao clicar no botão X', () => {
    const onClose = vi.fn();
    render(<Modal open={true} onClose={onClose} title="Teste"><p>x</p></Modal>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('chama onClose ao pressionar Escape', () => {
    const onClose = vi.fn();
    render(<Modal open={true} onClose={onClose} title="Teste"><p>x</p></Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

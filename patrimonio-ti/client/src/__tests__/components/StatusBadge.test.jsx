import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '@/components/shared/StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['available', 'Disponível'],
    ['assigned', 'Atribuído'],
    ['maintenance', 'Manutenção'],
    ['decommissioned', 'Desativado'],
  ])('exibe label correto para status "%s"', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('exibe o status bruto quando não reconhecido', () => {
    render(<StatusBadge status="unknown_status" />);
    expect(screen.getByText('unknown_status')).toBeInTheDocument();
  });
});

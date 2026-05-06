import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, statusLabel, statusColor, roleLabel } from '@/utils/formatters';

describe('formatDate', () => {
  it('formata data ISO para pt-BR', () => {
    expect(formatDate('2024-06-15T00:00:00.000Z')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('retorna "—" para null ou undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('retorna "—" para null', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('inclui hora na formatação', () => {
    const result = formatDateTime('2024-06-15T14:30:00.000Z');
    expect(result).toBeTruthy();
    expect(result).not.toBe('—');
  });
});

describe('statusLabel', () => {
  it('mapeia todos os status', () => {
    expect(statusLabel.available).toBe('Disponível');
    expect(statusLabel.assigned).toBe('Atribuído');
    expect(statusLabel.maintenance).toBe('Manutenção');
    expect(statusLabel.decommissioned).toBe('Desativado');
  });
});

describe('statusColor', () => {
  it('retorna classe CSS para cada status', () => {
    expect(statusColor.available).toContain('green');
    expect(statusColor.assigned).toContain('blue');
    expect(statusColor.maintenance).toContain('yellow');
    expect(statusColor.decommissioned).toContain('gray');
  });
});

describe('roleLabel', () => {
  it('mapeia roles', () => {
    expect(roleLabel.admin).toBe('Administrador');
    expect(roleLabel.user).toBe('Usuário');
  });
});

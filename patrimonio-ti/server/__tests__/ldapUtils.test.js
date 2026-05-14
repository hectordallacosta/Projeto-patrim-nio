const { extractSectorAcronym, extractSectorFullName } = require('../utils/ldapUtils');

describe('extractSectorAcronym', () => {
  test('retorna sigla em maiúsculas quando já está em maiúsculas', () => {
    const dn =
      'CN=joao,OU=Gerência de TI - GETIC,OU=Diretoria,DC=empresa,DC=com,DC=br';
    expect(extractSectorAcronym(dn)).toBe('GETIC');
  });

  test('retorna sigla em maiúsculas quando o texto após o hífen é misto (Blumenau)', () => {
    const dn =
      'CN=maria,OU=Urss - Blumenau,OU=Urss SC,OU=Diretoria de Saúde do Servidor,DC=empresa,DC=com,DC=br';
    expect(extractSectorAcronym(dn)).toBe('BLUMENAU');
  });

  test('suporta caracteres acentuados portugueses — ç (Joaçaba)', () => {
    const dn =
      'CN=pedro,OU=Urss - Joaçaba,OU=Urss SC,OU=Diretoria de Saúde do Servidor,DC=empresa,DC=com,DC=br';
    expect(extractSectorAcronym(dn)).toBe('JOAÇABA');
  });

  test('percorre os segmentos e usa a primeira OU com padrão " - sigla"', () => {
    const dn =
      'CN=pedro,OU=Gerência de Contabilidade - GECON,OU=Diretoria Financeira - DIFIN,DC=corp,DC=br';
    expect(extractSectorAcronym(dn)).toBe('GECON');
  });

  test('retorna null quando OU não tem padrão " - SIGLA" (OU sem hífen)', () => {
    const dn =
      'CN=ana,OU=Diretoria de Saúde do Servidor,OU=ORGAO,DC=empresa,DC=com,DC=br';
    expect(extractSectorAcronym(dn)).toBeNull();
  });

  test('retorna null quando OU é apenas sigla isolada sem nome precedido de hífen', () => {
    const dn = 'CN=joao,OU=ORGAO,DC=corp,DC=br';
    expect(extractSectorAcronym(dn)).toBeNull();
  });

  test('retorna null quando nenhum segmento OU tem o padrão', () => {
    const dn = 'CN=joao,OU=Usuarios,OU=Corp,DC=corp,DC=br';
    expect(extractSectorAcronym(dn)).toBeNull();
  });

  test('retorna null para DN vazio ou nulo', () => {
    expect(extractSectorAcronym(null)).toBeNull();
    expect(extractSectorAcronym('')).toBeNull();
  });
});

describe('extractSectorFullName', () => {
  test('retorna o nome completo antes do hífen (sigla maiúscula)', () => {
    const dn =
      'CN=joao,OU=Gerência de Tecnologia da Informação - GETIC,OU=Diretoria,DC=empresa,DC=com,DC=br';
    expect(extractSectorFullName(dn)).toBe('Gerência de Tecnologia da Informação');
  });

  test('retorna o nome completo antes do hífen (texto misto após hífen)', () => {
    const dn =
      'CN=maria,OU=Urss - Blumenau,OU=Urss SC,OU=Diretoria de Saúde do Servidor,DC=empresa,DC=com,DC=br';
    expect(extractSectorFullName(dn)).toBe('Urss');
  });

  test('retorna o nome completo quando sigla tem acento (Joaçaba)', () => {
    const dn =
      'CN=pedro,OU=Urss - Joaçaba,OU=Urss SC,DC=empresa,DC=com,DC=br';
    expect(extractSectorFullName(dn)).toBe('Urss');
  });

  test('retorna null quando nenhum segmento OU tem o padrão', () => {
    const dn = 'CN=joao,OU=Usuarios,DC=corp,DC=br';
    expect(extractSectorFullName(dn)).toBeNull();
  });
});

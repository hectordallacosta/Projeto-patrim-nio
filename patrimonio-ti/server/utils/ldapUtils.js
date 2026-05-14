/**
 * Extrai a sigla do setor a partir do distinguishedName do AD.
 *
 * Regra: percorre os segmentos OU= do DN (do mais específico ao mais geral)
 * e retorna a sigla após o último " - " da primeira OU que contiver esse padrão.
 * Suporta caracteres acentuados portugueses (flag /u + \p{L}).
 *
 * Exemplos:
 *   "CN=joao,OU=Gerência de TI - GETIC,..."        → "GETIC"
 *   "CN=maria,OU=Urss - Joaçaba,..."               → "JOAÇABA"
 *
 * Retorna null se nenhuma OU tiver o padrão " - SIGLA".
 */
function extractSectorAcronym(distinguishedName) {
  if (!distinguishedName) return null;

  const ouSegments = distinguishedName
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.toUpperCase().startsWith('OU='))
    .map((s) => s.substring(3));

  for (const ou of ouSegments) {
    const match = ou.match(/\s-\s([\p{L}0-9]+(?:\s[\p{L}0-9]+)*)\s*$/u);
    if (match) return match[1].trim().toUpperCase();
  }

  return null;
}

/**
 * Extrai o nome completo do setor (antes do hífen) para usar como description.
 * Suporta caracteres acentuados portugueses (flag /u + \p{L}).
 *
 * Exemplo:
 *   "Gerência de Tecnologia da Informação do Centro Administrativo - GETIC"
 *   Retorna: "Gerência de Tecnologia da Informação do Centro Administrativo"
 */
function extractSectorFullName(distinguishedName) {
  if (!distinguishedName) return null;

  const ouSegments = distinguishedName
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.toUpperCase().startsWith('OU='))
    .map((s) => s.substring(3));

  for (const ou of ouSegments) {
    const match = ou.match(/^(.+?)\s-\s[\p{L}0-9]+(?:\s[\p{L}0-9]+)*\s*$/u);
    if (match) return match[1].trim();
  }

  return null;
}

module.exports = { extractSectorAcronym, extractSectorFullName };

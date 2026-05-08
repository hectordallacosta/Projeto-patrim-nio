/**
 * Extrai a sigla do setor a partir do distinguishedName do AD.
 *
 * Regra: percorre os segmentos OU= do DN (do mais específico ao mais geral)
 * e retorna a sigla após o último " - " da primeira OU que contiver esse padrão.
 *
 * Exemplo:
 *   DN: "CN=joao,OU=Gerência de Tecnologia da Informação - GETIC,OU=Diretoria,...,DC=seasc,..."
 *   Retorna: "GETIC"
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
    const match = ou.match(/\s-\s([A-Z0-9]+)\s*$/);
    if (match) return match[1].trim();
  }

  return null;
}

/**
 * Extrai o nome completo do setor (antes do hífen) para usar como description.
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
    const match = ou.match(/^(.+?)\s-\s[A-Z0-9]+\s*$/);
    if (match) return match[1].trim();
  }

  return null;
}

module.exports = { extractSectorAcronym, extractSectorFullName };

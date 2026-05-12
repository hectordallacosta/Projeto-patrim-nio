/**
 * Script de diagnóstico LDAP — rode com:
 *   node test-ldap.js <username> "<senha>"
 *
 * Exemplo:
 *   node test-ldap.js usuario.exemplo "SuaSenha@123"
 */

require('dotenv').config();
const { Client } = require('ldapts');

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error('\nUso: node test-ldap.js <username> "<senha>"\n');
  process.exit(1);
}

const cfg = {
  url:            process.env.LDAP_URL,
  baseDN:         process.env.LDAP_BASE_DN,
  bindDN:         process.env.LDAP_BIND_DN,
  bindPassword:   process.env.LDAP_BIND_PASSWORD,
  searchBase:     process.env.LDAP_USER_SEARCH_BASE,
  domain:         process.env.LDAP_DOMAIN,
};

function val(v) {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

async function run() {
  console.log('\n════════════════════════════════════════════');
  console.log('  DIAGNÓSTICO LDAP');
  console.log('════════════════════════════════════════════');
  console.log('URL        :', cfg.url);
  console.log('Search Base:', cfg.searchBase);
  console.log('Bind DN    :', cfg.bindDN);
  console.log('Domain     :', cfg.domain);
  console.log('Usuário    :', username);
  console.log('────────────────────────────────────────────\n');

  // ── Etapa 1: conectar e bind como service account ──
  console.log('[1/4] Conectando e bind com a conta de serviço...');
  const clientSvc = new Client({
    url: cfg.url,
    tlsOptions: { rejectUnauthorized: false },
    connectTimeout: 8000,
  });

  try {
    await clientSvc.bind(cfg.bindDN, cfg.bindPassword);
    console.log('      ✓ Bind da conta de serviço OK\n');
  } catch (err) {
    console.error('      ✗ FALHOU:', err.message);
    console.error('        Código :', err.code ?? err.name);
    console.error('\n→ Verifique LDAP_BIND_DN e LDAP_BIND_PASSWORD no .env\n');
    process.exit(1);
  }

  // ── Etapa 2: buscar o usuário ──
  console.log(`[2/4] Buscando usuário "${username}" em ${cfg.searchBase} ...`);
  let entry;
  try {
    const { searchEntries } = await clientSvc.search(cfg.searchBase, {
      scope: 'sub',
      filter: `(sAMAccountName=${username})`,
      attributes: [
        'displayName', 'mail', 'department',
        'sAMAccountName', 'distinguishedName',
        'userPrincipalName', 'memberOf',
      ],
    });

    if (!searchEntries.length) {
      console.error(`      ✗ Usuário "${username}" NÃO encontrado na OU configurada.`);
      console.error(`\n→ Possíveis causas:`);
      console.error(`  1. Usuário está em uma OU diferente de "${cfg.searchBase}"`);
      console.error(`  2. O sAMAccountName não corresponde (tente variações do login)`);
      console.error(`  3. A conta de serviço não tem permissão de leitura nessa OU\n`);

      // Tenta busca mais ampla a partir do domínio raiz
      const rootBase = 'DC=' + cfg.domain.split('.').join(',DC=');
      console.log(`      Tentando busca ampla na raiz "${rootBase}"...`);
      const { searchEntries: wide } = await clientSvc.search(rootBase, {
        scope: 'sub',
        filter: `(sAMAccountName=${username})`,
        attributes: ['distinguishedName', 'displayName'],
      });
      if (wide.length) {
        console.log(`      ✓ Usuário encontrado em OU diferente:`);
        console.log(`        DN: ${val(wide[0].distinguishedName)}`);
        console.log(`\n→ Atualize LDAP_USER_SEARCH_BASE no .env para incluir esta OU\n`);
      } else {
        console.error(`      ✗ Usuário também NÃO encontrado na busca ampla.\n`);
      }
      await clientSvc.unbind();
      process.exit(1);
    }

    entry = searchEntries[0];
    console.log('      ✓ Usuário encontrado!\n');
    console.log('      DN             :', val(entry.dn) || val(entry.distinguishedName));
    console.log('      sAMAccountName :', val(entry.sAMAccountName));
    console.log('      displayName    :', val(entry.displayName));
    console.log('      mail           :', val(entry.mail));
    console.log('      department     :', val(entry.department));
    console.log('      userPrincipalName:', val(entry.userPrincipalName));
    console.log('\n      Todas as chaves do objeto entry (para identificar o nome do atributo DN):');
    console.log(`        ${Object.keys(entry).join(', ')}`);
    console.log('\n      Atributos brutos (para debug):');
    for (const [k, v] of Object.entries(entry)) {
      console.log(`        ${k}: ${JSON.stringify(v)}`);
    }
    console.log();
  } catch (err) {
    console.error('      ✗ Erro na busca:', err.message);
    await clientSvc.unbind();
    process.exit(1);
  }

  await clientSvc.unbind();

  // ── Etapa 3: bind com credenciais do usuário (cliente NOVO) ──
  const upn = `${username}@${cfg.domain}`;
  console.log(`[3/4] Validando senha via bind como "${upn}"...`);
  const clientUser = new Client({
    url: cfg.url,
    tlsOptions: { rejectUnauthorized: false },
    connectTimeout: 8000,
  });

  try {
    await clientUser.bind(upn, password);
    console.log('      ✓ Bind com credenciais do usuário OK — senha correta!\n');
  } catch (err) {
    console.error('      ✗ Bind falhou:', err.message);
    console.error('        Código :', err.code ?? err.name);
    if (err.code === 49) {
      console.error('\n→ Senha incorreta ou conta bloqueada/expirada no AD\n');
    } else {
      // Tenta com o DN completo em vez do UPN
      const dn = val(entry.dn) || val(entry.distinguishedName);
      if (dn) {
        console.log(`\n      Tentando bind com DN completo: "${dn}"...`);
        try {
          await clientUser.bind(dn, password);
          console.log('      ✓ Bind com DN completo OK!');
          console.log('\n→ O sistema deve usar o DN completo para o bind do usuário, não o UPN.\n');
        } catch (err2) {
          console.error('      ✗ Bind com DN também falhou:', err2.message, '\n');
        }
      }
    }
    await clientUser.unbind().catch(() => {});
    process.exit(1);
  }

  await clientUser.unbind();

  // ── Etapa 4: resumo ──
  console.log('[4/5] Resumo — dados que serão salvos no MongoDB:');
  console.log('      username     :', val(entry.sAMAccountName));
  console.log('      displayName  :', val(entry.displayName) || username);
  console.log('      email        :', val(entry.mail) || `${username}@${cfg.domain}`);
  console.log('      adDepartment :', val(entry.department));
  console.log();

  // ── Etapa 5: diagnóstico de distinguishedName e extração de setor ──
  const { extractSectorAcronym } = require('./utils/ldapUtils');

  console.log('[5/5] Diagnóstico de distinguishedName → extração de setor:');
  console.log('─────────────────────────────────────────────────────────────');

  // Mostra entry.dn (propriedade built-in que o ldapts sempre popula com o DN do protocolo LDAP)
  console.log('\n[LDAP] entry.dn  (built-in do ldapts):');
  console.log(`  tipo : ${typeof entry.dn}`);
  console.log(`  valor: ${JSON.stringify(entry.dn)}`);

  // Mostra entry.distinguishedName (atributo retornado pelo servidor AD, se listado em attributes)
  console.log('\n[LDAP] entry.distinguishedName  (atributo explícito):');
  console.log(`  tipo : ${typeof entry.distinguishedName}`);
  console.log(`  valor: ${JSON.stringify(entry.distinguishedName)}`);

  // Determina qual DN usar (mesma lógica do ldapService)
  const dnUsed = val(entry.distinguishedName) || (typeof entry.dn === 'string' ? entry.dn : null);
  console.log(`\n[LDAP] DN efetivo usado para extração:\n  ${dnUsed ?? '(NULO — nenhum DN disponível!)'}`);

  if (dnUsed) {
    const segments = dnUsed
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.toUpperCase().startsWith('OU='))
      .map((s) => s.substring(3));

    console.log(`\n[LDAP] Segmentos OU= encontrados (${segments.length}):`);
    if (segments.length === 0) {
      console.log('  (nenhum — verifique o formato do DN acima)');
    }
    segments.forEach((seg, i) => {
      const match = seg.match(/\s-\s([A-Z0-9]+)\s*$/);
      console.log(`  [${i}] ${seg}  ${match ? `→ sigla candidata: "${match[1]}"` : '(sem padrão " - SIGLA")'}`);
    });
  } else {
    console.log('\n  ✗ DN indisponível — o ldapts não está retornando o DN.');
    console.log('  → Verificar se "distinguishedName" está no array attributes da busca.');
  }

  const sigla = extractSectorAcronym(dnUsed);
  console.log(`\n[LDAP] extractSectorAcronym() retornou: ${sigla != null ? `"${sigla}"` : '(null)'}`);
  if (sigla == null && dnUsed) {
    console.log('  → Nenhuma OU correspondeu ao padrão /\\s-\\s([A-Z0-9]+)\\s*$/');
    console.log('  → Possíveis causas:');
    console.log('    • A sigla contém letras minúsculas ou caracteres especiais (ex: "GETIC-TI")');
    console.log('    • O separador não é " - " (espaço-hífen-espaço): verifique o DN acima');
    console.log('    • A OU relevante não segue o padrão "Nome Completo - SIGLA"');
  }
  console.log('─────────────────────────────────────────────────────────────');
  console.log('\n✓ AUTENTICAÇÃO LDAP COMPLETA — tudo funcionando!\n');
}

run().catch((err) => {
  console.error('\n✗ Erro inesperado:', err.message, '\n');
  process.exit(1);
});

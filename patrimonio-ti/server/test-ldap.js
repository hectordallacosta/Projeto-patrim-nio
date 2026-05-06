/**
 * Script de diagnóstico LDAP — rode com:
 *   node test-ldap.js <username> "<senha>"
 *
 * Exemplo:
 *   node test-ldap.js hector.dallacosta "MinhaSenh@123"
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
    console.log('\n      Atributos brutos (para debug):');
    for (const [k, v] of Object.entries(entry)) {
      if (k === 'dn') continue;
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
  console.log('[4/4] Resumo — dados que serão salvos no MongoDB:');
  console.log('      username     :', val(entry.sAMAccountName));
  console.log('      displayName  :', val(entry.displayName) || username);
  console.log('      email        :', val(entry.mail) || `${username}@${cfg.domain}`);
  console.log('      adDepartment :', val(entry.department));
  console.log('\n✓ AUTENTICAÇÃO LDAP COMPLETA — tudo funcionando!\n');
}

run().catch((err) => {
  console.error('\n✗ Erro inesperado:', err.message, '\n');
  process.exit(1);
});

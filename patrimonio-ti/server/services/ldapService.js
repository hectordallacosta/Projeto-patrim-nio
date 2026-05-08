const { Client } = require('ldapts');
const ldapConfig = require('../config/ldap');

// ldapts v7 pode retornar atributos como array — normaliza para string
function val(v) {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function newClient() {
  return new Client({
    url: ldapConfig.url,
    tlsOptions: { rejectUnauthorized: false },
    connectTimeout: 8000,
  });
}

/**
 * Autentica um usuário no Active Directory e retorna seus atributos.
 * Lança erro com código específico se as credenciais forem inválidas.
 */
async function authenticateUser(username, password) {
  const userPrincipalName = `${username}@${ldapConfig.domain}`;

  // ── Etapa 1: service account — busca o usuário ──
  const clientSvc = newClient();
  let entry;

  try {
    await clientSvc.bind(ldapConfig.bindDN, ldapConfig.bindPassword);

    const { searchEntries } = await clientSvc.search(ldapConfig.userSearchBase, {
      scope: 'sub',
      filter: `(sAMAccountName=${username})`,
      attributes: ['displayName', 'mail', 'department', 'sAMAccountName', 'distinguishedName', 'userPrincipalName'],
    });

    if (!searchEntries.length) {
      const err = new Error('Usuário não encontrado no Active Directory');
      err.code = 'LDAP_AUTH_FAILED';
      err.statusCode = 401;
      throw err;
    }

    entry = searchEntries[0];
  } catch (err) {
    await clientSvc.unbind().catch(() => {});
    if (err.code === 'LDAP_AUTH_FAILED') throw err;
    throw err;
  } finally {
    await clientSvc.unbind().catch(() => {});
  }

  // ── Etapa 2: cliente NOVO — valida senha do usuário ──
  const clientUser = newClient();

  try {
    await clientUser.bind(userPrincipalName, password);
  } catch (err) {
    if (err.code === 49 || err.name === 'InvalidCredentialsError') {
      const dn = val(entry.dn) || val(entry.distinguishedName);
      if (dn) {
        try {
          await clientUser.bind(dn, password);
        } catch {
          await clientUser.unbind().catch(() => {});
          const authErr = new Error('Credenciais inválidas');
          authErr.code = 'LDAP_AUTH_FAILED';
          authErr.statusCode = 401;
          throw authErr;
        }
      } else {
        await clientUser.unbind().catch(() => {});
        const authErr = new Error('Credenciais inválidas');
        authErr.code = 'LDAP_AUTH_FAILED';
        authErr.statusCode = 401;
        throw authErr;
      }
    } else {
      await clientUser.unbind().catch(() => {});
      throw err;
    }
  } finally {
    await clientUser.unbind().catch(() => {});
  }

  return {
    username:     val(entry.sAMAccountName) || username,
    email:        val(entry.mail),
    displayName:  val(entry.displayName) || username,
    adDepartment: val(entry.department),
  };
}

/**
 * Busca dados de um usuário no AD usando apenas a service account.
 * Usada pela sincronização individual — não valida senha.
 */
async function findUser(username) {
  const client = newClient();
  try {
    await client.bind(ldapConfig.bindDN, ldapConfig.bindPassword);

    const { searchEntries } = await client.search(ldapConfig.userSearchBase, {
      scope: 'sub',
      filter: `(sAMAccountName=${username})`,
      attributes: ['displayName', 'mail', 'department', 'sAMAccountName'],
    });

    if (!searchEntries.length) return null;

    const entry = searchEntries[0];
    return {
      username:     val(entry.sAMAccountName) || username,
      email:        val(entry.mail),
      displayName:  val(entry.displayName) || username,
      adDepartment: val(entry.department),
    };
  } finally {
    await client.unbind().catch(() => {});
  }
}

/**
 * Busca usuários no AD por nome ou username (busca parcial).
 * Usada pela importação em lote — não valida senha.
 */
async function searchUsers(query) {
  if (!query || query.trim().length < 2) return [];

  const client = newClient();
  try {
    await client.bind(ldapConfig.bindDN, ldapConfig.bindPassword);

    // Escapa caracteres especiais do LDAP na query
    const safe = query.trim().replace(/[*()\\\x00]/g, '');
    const filter = `(&(objectClass=person)(!(objectClass=computer))(!(sAMAccountName=*$))(|(sAMAccountName=*${safe}*)(displayName=*${safe}*)(mail=*${safe}*)))`;

    const { searchEntries } = await client.search(ldapConfig.userSearchBase, {
      scope: 'sub',
      filter,
      attributes: ['displayName', 'mail', 'department', 'sAMAccountName'],
      sizeLimit: 25,
    });

    return searchEntries.map((entry) => ({
      username:     val(entry.sAMAccountName),
      email:        val(entry.mail),
      displayName:  val(entry.displayName),
      adDepartment: val(entry.department),
    })).filter((u) => u.username);
  } finally {
    await client.unbind().catch(() => {});
  }
}

/**
 * Retorna todos os usuários de uma OU específica.
 * Usada pela sincronização em lote — não valida senha.
 */
async function getUsersByOU(ouPath) {
  if (!ouPath || !ouPath.trim()) {
    const err = new Error('Caminho da OU é obrigatório');
    err.statusCode = 400;
    throw err;
  }

  const client = newClient();
  try {
    await client.bind(ldapConfig.bindDN, ldapConfig.bindPassword);

    const { searchEntries } = await client.search(ouPath.trim(), {
      scope: 'sub',
      filter: '(&(objectClass=person)(!(objectClass=computer))(!(sAMAccountName=*$))(sAMAccountName=*))',
      attributes: ['displayName', 'mail', 'department', 'sAMAccountName'],
    });

    return searchEntries
      .map((entry) => ({
        username:     val(entry.sAMAccountName),
        email:        val(entry.mail),
        displayName:  val(entry.displayName),
        adDepartment: val(entry.department),
      }))
      .filter((u) => u.username);
  } finally {
    await client.unbind().catch(() => {});
  }
}

module.exports = { authenticateUser, findUser, searchUsers, getUsersByOU };

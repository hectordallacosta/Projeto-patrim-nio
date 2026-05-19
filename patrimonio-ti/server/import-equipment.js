/**
 * Script de importação de equipamentos a partir de planilha Excel
 *
 * Colunas esperadas na planilha:
 *   Tipo | Marca | Modelo | Patrimônio Getic | Patrimônio | Nº Série | Status | Servidor | Órgão | Área | Setor
 *
 * Execução:
 *   cd server
 *   node import-equipment.js ../equipamentos.xlsx
 *
 * O script:
 *  1. Lê a planilha Excel
 *  2. Cria EquipmentType se não existir (coluna "Tipo")
 *  3. Cria EquipmentModel se não existir (Tipo + Marca + Modelo)
 *  4. Cria Sector se não existir (coluna "Setor")
 *  5. Busca o User pelo "Servidor" (username ou displayName)
 *  6. Cria um Stock padrão de importação se necessário
 *  7. Cria o Equipment com as regras de negócio do sistema
 *  8. Vincula ao usuário/setor conforme os dados
 */

require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');

// ── Modelos ────────────────────────────────────────────────────────────────
const Equipment      = require('./models/Equipment');
const EquipmentModel = require('./models/EquipmentModel');
const EquipmentType  = require('./models/EquipmentType');
const Sector         = require('./models/Sector');
const Stock          = require('./models/Stock');
const User           = require('./models/User');

// ── Mapeamento de status ───────────────────────────────────────────────────
const STATUS_MAP = {
  'em uso':          'assigned',
  'ativo':           'available',
  'disponível':      'available',
  'manutenção':      'maintenance',
  'manutencao':      'maintenance',
  'desativado':      'decommissioned',
  'baixado':         'decommissioned',
  'estoque':         'in_stock',
  'em estoque':      'in_stock',
};

function normalizeStatus(raw) {
  if (!raw) return 'in_stock';
  const key = raw.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove acentos para comparação
  for (const [k, v] of Object.entries(STATUS_MAP)) {
    const kNorm = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (key === kNorm) return v;
  }
  return 'in_stock'; // fallback seguro
}

function cell(row, ...keys) {
  for (const k of keys) {
    const val = row[k];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return null;
}

// ── Caches em memória para evitar buscas repetidas ─────────────────────────
const cacheType    = new Map(); // name → ObjectId
const cacheModel   = new Map(); // "brand|model|typeId" → ObjectId
const cacheSector  = new Map(); // name → ObjectId
const cacheUser    = new Map(); // username/displayName → ObjectId | false
let   importStock  = null;      // Stock de importação (criado uma vez)

async function getOrCreateType(name) {
  if (!name) return null;
  const key = name.toLowerCase();
  if (cacheType.has(key)) return cacheType.get(key);
  let doc = await EquipmentType.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
  if (!doc) {
    doc = await EquipmentType.create({ name });
    console.log(`  [TIPO CRIADO] ${name}`);
  }
  cacheType.set(key, doc._id);
  return doc._id;
}

async function getOrCreateModel(typeId, brand, model) {
  const key = `${brand}|${model}|${typeId}`;
  if (cacheModel.has(key)) return cacheModel.get(key);
  let doc = await EquipmentModel.findOne(
    { type: typeId, brand, model },
    null,
    { collation: { locale: 'pt', strength: 2 } }
  );
  if (!doc) {
    doc = await EquipmentModel.create({ type: typeId, brand, model, isActive: true });
    console.log(`  [MODELO CRIADO] ${brand} ${model}`);
  }
  cacheModel.set(key, doc._id);
  return doc._id;
}

async function getOrCreateSector(name) {
  if (!name) return null;
  const key = name.toLowerCase();
  if (cacheSector.has(key)) return cacheSector.get(key);
  let doc = await Sector.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
  if (!doc) {
    doc = await Sector.create({ name, isActive: true });
    console.log(`  [SETOR CRIADO] ${name}`);
  }
  cacheSector.set(key, doc._id);
  return doc._id;
}

async function findUser(servidor) {
  if (!servidor) return null;
  const key = servidor.toLowerCase();
  if (cacheUser.has(key)) return cacheUser.get(key);

  // Tenta várias estratégias de busca em ordem
  let doc = null;

  // 1. Username exato
  doc = await User.findOne({ username: { $regex: `^${servidor}$`, $options: 'i' }, isActive: true });

  // 2. DisplayName exato
  if (!doc) doc = await User.findOne({ displayName: { $regex: `^${servidor}$`, $options: 'i' }, isActive: true });

  // 3. Email exato
  if (!doc) doc = await User.findOne({ email: { $regex: `^${servidor}$`, $options: 'i' }, isActive: true });

  // 4. DisplayName contém o valor (ex: "João Silva" encontra "João Silva Santos")
  if (!doc) doc = await User.findOne({ displayName: { $regex: servidor, $options: 'i' }, isActive: true });

  // 5. O valor contém o primeiro nome + sobrenome do displayName
  if (!doc) {
    const partes = servidor.trim().split(/\s+/);
    if (partes.length >= 2) {
      const regex = partes.map(p => `(?=.*${p})`).join('');
      doc = await User.findOne({ displayName: { $regex: regex, $options: 'i' }, isActive: true });
    }
  }

  if (!doc) console.log(`  [NÃO ENCONTRADO] "${servidor}" → equipamento ficará no estoque`);

  const id = doc ? doc._id : null;
  cacheUser.set(key, id);
  return id;
}

async function getImportStock() {
  if (importStock) return importStock;
  const name = 'Importação Planilha';
  let doc = await Stock.findOne({ name });
  if (!doc) {
    doc = await Stock.create({ name, description: 'Estoque criado automaticamente na importação da planilha', isActive: true });
    console.log(`  [ESTOQUE CRIADO] "${name}"`);
  }
  importStock = doc._id;
  return importStock;
}

// ── Lógica principal ───────────────────────────────────────────────────────
async function importRow(row, rowNum) {
  const tipo       = cell(row, 'Tipo', 'tipo', 'TIPO');
  const marca      = cell(row, 'Marca', 'marca', 'MARCA');
  const modelo     = cell(row, 'Modelo', 'modelo', 'MODELO');
  const patGetic   = cell(row, 'Patrimônio Getic', 'Patrimonio Getic', 'patrimonio_getic', 'PATRIMÔNIO GETIC');
  const pat        = cell(row, 'Patrimônio', 'Patrimonio', 'patrimonio', 'PATRIMÔNIO');
  const serie      = cell(row, 'Nº Série', 'N° Série', 'N Série', 'serie', 'NºSérie', 'Nº Serie', 'N Serie');
  const statusRaw  = cell(row, 'Status', 'status', 'STATUS');
  const servidor   = cell(row, 'Servidor', 'servidor', 'SERVIDOR');
  const orgao      = cell(row, 'Órgão', 'Orgao', 'orgao', 'ÓRGÃO');
  const area       = cell(row, 'Área', 'Area', 'area', 'ÁREA');
  const setor      = cell(row, 'Setor', 'setor', 'SETOR');

  // Patrimônio obrigatório — usa Patrimônio Getic ou Patrimônio
  const patrimony = patGetic || pat;
  if (!patrimony) {
    return { ok: false, reason: 'Sem número de patrimônio' };
  }
  if (!marca || !modelo) {
    return { ok: false, reason: 'Marca ou Modelo ausente' };
  }

  // Verifica duplicata
  const exists = await Equipment.findOne({ patrimonyNumber: patrimony });
  if (exists) {
    return { ok: false, reason: `Patrimônio ${patrimony} já existe` };
  }

  // 1. Tipo
  const typeId = await getOrCreateType(tipo || 'Não classificado');

  // 2. Modelo
  const modelId = await getOrCreateModel(typeId, marca, modelo);

  // 3. Status
  const status = normalizeStatus(statusRaw);

  // 4. Estoque padrão
  const stockId = await getImportStock();

  // 5. Notas extras: agrega Órgão + Área como observações
  const notes = [
    orgao  ? `Órgão: ${orgao}`  : null,
    area   ? `Área: ${area}`    : null,
    patGetic && pat ? `Pat. GETIC: ${patGetic} | Pat.: ${pat}` : null,
  ].filter(Boolean).join(' | ');

  // 6. Monta o documento
  const doc = {
    equipmentModel:  modelId,
    patrimonyNumber: patrimony,
    serialNumber:    serie || undefined,
    status:          'in_stock', // começa em estoque — vinculação feita abaixo
    stock:           stockId,
    notes,
  };

  const equip = await Equipment.create(doc);

  // 7. Vincula somente ao usuário (setor ignorado — dados da planilha não são confiáveis)
  const assignedTo = servidor ? await findUser(servidor) : null;

  if (assignedTo) {
    equip.assignedTo     = assignedTo;
    equip.assignedSector = null;
    equip.assignmentDate = new Date();
    equip.stock          = null;
    equip.status         = 'assigned';
    equip.assignmentHistory.push({
      assignedTo,
      assignedSector: null,
      assignedAt:  new Date(),
      returnedAt:  new Date(),
      note: 'Importado via planilha',
      fromStock: stockId,
      action: 'assigned',
    });
    await equip.save();
  }

  return { ok: true };
}

// ── Entrada ────────────────────────────────────────────────────────────────
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: node import-equipment.js <caminho-para-planilha.xlsx>');
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  console.log(`\nLendo planilha: ${absPath}`);

  const wb   = XLSX.readFile(absPath);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  console.log(`Linhas encontradas: ${rows.length}`);

  if (rows.length === 0) {
    console.error('Planilha vazia ou sem dados.');
    process.exit(1);
  }

  // Mostra as colunas detectadas para conferência
  console.log(`Colunas detectadas: ${Object.keys(rows[0]).join(' | ')}\n`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado ao MongoDB\n');

  let ok = 0, skip = 0, errors = 0;
  const errosList = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // linha 1 é cabeçalho
    try {
      const result = await importRow(rows[i], rowNum);
      if (result.ok) {
        ok++;
        if (ok % 10 === 0) console.log(`  ... ${ok} importados`);
      } else {
        skip++;
        errosList.push(`  Linha ${rowNum}: ${result.reason}`);
      }
    } catch (err) {
      errors++;
      errosList.push(`  Linha ${rowNum} [ERRO]: ${err.message}`);
    }
  }

  console.log('\n══════════════════════════════════════');
  console.log(`✅  Importados com sucesso : ${ok}`);
  console.log(`⚠️  Ignorados (sem dados)  : ${skip}`);
  console.log(`❌  Erros                  : ${errors}`);
  console.log('══════════════════════════════════════');

  if (errosList.length > 0) {
    console.log('\nDetalhes dos ignorados/erros:');
    errosList.forEach((e) => console.log(e));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\nErro fatal:', err.message);
  process.exit(1);
});

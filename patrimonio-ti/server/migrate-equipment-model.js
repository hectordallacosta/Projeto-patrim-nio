/**
 * Script de migração: converte equipamentos do modelo antigo (brand/model/type direto)
 * para o novo modelo (referência a EquipmentModel).
 *
 * Execução: cd server && node migrate-equipment-model.js
 *
 * Seguro para re-execução — equipamentos já migrados (com equipmentModel) são ignorados.
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado ao MongoDB');

  // Carrega os modelos após conectar
  const EquipmentType = require('./models/EquipmentType');
  const EquipmentModelDoc = require('./models/EquipmentModel');

  // Acessa a coleção diretamente para ler campos legados sem validação do schema novo
  const equipCollection = mongoose.connection.collection('equipments');

  const all = await equipCollection.find({}).toArray();
  console.log(`Total de equipamentos encontrados: ${all.length}`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const equip of all) {
    // Já migrado
    if (equip.equipmentModel) { skipped++; continue; }

    // Sem dados legados suficientes
    if (!equip.brand || !equip.model || !equip.type) {
      console.warn(`  [SKIP] ${equip._id} — sem brand/model/type legados`);
      skipped++;
      continue;
    }

    try {
      // Reutiliza EquipmentModel existente (mesmo tipo + marca + modelo) ou cria novo
      let em = await EquipmentModelDoc.findOne({
        type: equip.type,
        brand: equip.brand,
        model: equip.model,
      });

      if (!em) {
        em = await EquipmentModelDoc.create({
          type: equip.type,
          brand: equip.brand,
          model: equip.model,
          purchaseDate: equip.purchaseDate || null,
          warrantyExpiry: equip.warrantyExpiry || null,
          notes: '',
          isActive: true,
        });
        console.log(`  [NOVO MODELO] ${equip.brand} ${equip.model} → ${em._id}`);
      }

      await equipCollection.updateOne(
        { _id: equip._id },
        {
          $set: { equipmentModel: em._id },
          $unset: { brand: '', model: '', type: '', purchaseDate: '', warrantyExpiry: '' },
        }
      );
      migrated++;
    } catch (err) {
      console.error(`  [ERRO] ${equip._id}: ${err.message}`);
      errors++;
    }
  }

  console.log('');
  console.log(`Migração concluída:`);
  console.log(`  Migrados: ${migrated}`);
  console.log(`  Ignorados (já migrados ou sem dados): ${skipped}`);
  console.log(`  Erros: ${errors}`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});

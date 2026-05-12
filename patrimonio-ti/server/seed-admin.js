require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);

  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const hash = await bcrypt.hash(adminPassword, 10);

  const user = await User.findOneAndUpdate(
    { username: 'admin' },
    {
      username: 'admin',
      email: 'admin@local.dev',
      displayName: 'Administrador Local',
      role: 'admin',
      isActive: true,
      localPassword: hash,
    },
    { upsert: true, new: true }
  );

  console.log('');
  console.log('✓ Usuário admin criado/atualizado com sucesso!');
  console.log('  Login   : admin');
  console.log('  Senha   : (definida por ADMIN_PASSWORD ou padrão do .env)');
  console.log('  Role    : admin');
  console.log('  ID      :', user._id.toString());
  console.log('');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Erro ao criar admin:', err.message);
  process.exit(1);
});
// Para rodar: cd server && node seed-admin.js
// Cria ou reseta o usuário admin local. A senha é definida por ADMIN_PASSWORD no .env (padrão configurável).
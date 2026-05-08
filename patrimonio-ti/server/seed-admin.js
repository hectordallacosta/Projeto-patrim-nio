require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);

  const hash = await bcrypt.hash('Admin@1234', 10);

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
  console.log('  Senha   : Admin@1234');
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
// Cria ou reseta o usuário admin local. Login: admin / Admin@1234 
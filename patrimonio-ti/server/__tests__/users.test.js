const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const ldapService = require('../services/ldapService');
const User = require('../models/User');
const Equipment = require('../models/Equipment');
const EquipmentType = require('../models/EquipmentType');

jest.mock('../services/ldapService');

const MONGO_URI = 'mongodb://localhost:27017/patrimonio_ti_test';

let adminToken;
let userToken;
let userId;
let adminId;

beforeAll(async () => {
  await mongoose.connect(MONGO_URI);

  // Cria admin
  ldapService.authenticateUser.mockResolvedValue({
    username: 'admin.users', email: 'admin@emp.com', displayName: 'Admin', adDepartment: 'TI',
  });
  let res = await request(app).post('/api/auth/login').send({ username: 'admin.users', password: '123' });
  await User.findOneAndUpdate({ username: 'admin.users' }, { role: 'admin' });
  res = await request(app).post('/api/auth/login').send({ username: 'admin.users', password: '123' });
  adminToken = res.body.data.token;
  adminId = res.body.data.user.id;

  // Cria usuário comum
  ldapService.authenticateUser.mockResolvedValue({
    username: 'user.comum', email: 'user@emp.com', displayName: 'Usuário Comum', adDepartment: 'RH',
  });
  res = await request(app).post('/api/auth/login').send({ username: 'user.comum', password: '123' });
  userToken = res.body.data.token;
  userId = res.body.data.user.id;
});

afterAll(async () => {
  await User.deleteMany({});
  await Equipment.deleteMany({});
  await EquipmentType.deleteMany({});
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('GET /api/users', () => {
  it('admin lista todos os usuários', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('usuário comum não pode listar', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/users/:id', () => {
  it('usuário comum acessa o próprio perfil', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('user.comum');
  });

  it('usuário comum não acessa perfil de outro', async () => {
    const res = await request(app)
      .get(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('admin acessa qualquer perfil', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/users/me/equipment', () => {
  it('retorna equipamentos do usuário logado', async () => {
    const et = await EquipmentType.create({ name: 'Desktop' });
    await Equipment.create({
      type: et._id, brand: 'Dell', model: 'OptiPlex', serialNumber: 'SN-ME-01',
      status: 'assigned', assignedTo: userId, assignmentDate: new Date(),
    });

    const res = await request(app)
      .get('/api/users/me/equipment')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);

    await Equipment.deleteMany({});
    await EquipmentType.deleteMany({});
  });
});

describe('PUT /api/users/:id', () => {
  it('admin altera role do usuário', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('admin');

    // Reverte
    await User.findByIdAndUpdate(userId, { role: 'user' });
  });
});

describe('PATCH /api/users/:id/deactivate + activate', () => {
  it('admin desativa e reativa usuário', async () => {
    let res = await request(app)
      .patch(`/api/users/${userId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    res = await request(app)
      .patch(`/api/users/${userId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);
  });
});

describe('POST /api/users/sync/:username', () => {
  it('sincroniza usuário do AD', async () => {
    ldapService.findUser.mockResolvedValue({
      username: 'novo.usuario', email: 'novo@emp.com', displayName: 'Novo Usuário', adDepartment: 'Vendas',
    });

    const res = await request(app)
      .post('/api/users/sync/novo.usuario')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('novo.usuario');
    expect(res.body.data.adImported).toBe(true);

    await User.deleteOne({ username: 'novo.usuario' });
  });

  it('retorna 404 se usuário não existe no AD', async () => {
    ldapService.findUser.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/users/sync/nao.existe')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND_AD');
  });
});

describe('GET /api/users/search-ad', () => {
  it('retorna usuários encontrados no AD', async () => {
    ldapService.searchUsers.mockResolvedValue([
      { username: 'joao.silva', email: 'joao@emp.com', displayName: 'João Silva', adDepartment: 'TI' },
      { username: 'joao.santos', email: 'joao.santos@emp.com', displayName: 'João Santos', adDepartment: 'RH' },
    ]);

    const res = await request(app)
      .get('/api/users/search-ad?q=joao')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].username).toBe('joao.silva');
  });

  it('retorna lista vazia para query com menos de 2 caracteres', async () => {
    const res = await request(app)
      .get('/api/users/search-ad?q=j')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('usuário comum não pode buscar no AD', async () => {
    const res = await request(app)
      .get('/api/users/search-ad?q=joao')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/users/import-ad', () => {
  it('importa usuários do AD para o MongoDB', async () => {
    ldapService.findUser
      .mockResolvedValueOnce({
        username: 'maria.silva', email: 'maria@emp.com', displayName: 'Maria Silva', adDepartment: 'Vendas',
      })
      .mockResolvedValueOnce({
        username: 'carlos.lima', email: 'carlos@emp.com', displayName: 'Carlos Lima', adDepartment: 'TI',
      });

    const res = await request(app)
      .post('/api/users/import-ad')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ usernames: ['maria.silva', 'carlos.lima'] });

    expect(res.status).toBe(200);
    expect(res.body.data.imported).toBe(2);
    expect(await User.countDocuments({ username: { $in: ['maria.silva', 'carlos.lima'] } })).toBe(2);

    await User.deleteMany({ username: { $in: ['maria.silva', 'carlos.lima'] } });
  });

  it('conta usuários já existentes como "updated" em vez de "imported"', async () => {
    // Cria o usuário antes da importação
    ldapService.authenticateUser.mockResolvedValue({
      username: 'ja.existe', email: 'jaexiste@emp.com', displayName: 'Já Existe', adDepartment: 'TI',
    });
    await request(app).post('/api/auth/login').send({ username: 'ja.existe', password: '123' });

    ldapService.findUser.mockResolvedValue({
      username: 'ja.existe', email: 'jaexiste@emp.com', displayName: 'Já Existe', adDepartment: 'TI',
    });

    const res = await request(app)
      .post('/api/users/import-ad')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ usernames: ['ja.existe'] });

    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(1);
    expect(res.body.data.imported).toBe(0);

    await User.deleteOne({ username: 'ja.existe' });
  });

  it('rejeita body sem usernames', async () => {
    const res = await request(app)
      .post('/api/users/import-ad')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('usuário comum não pode importar', async () => {
    const res = await request(app)
      .post('/api/users/import-ad')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ usernames: ['alguem'] });

    expect(res.status).toBe(403);
  });
});

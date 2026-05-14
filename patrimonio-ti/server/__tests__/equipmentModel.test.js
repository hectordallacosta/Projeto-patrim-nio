const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const ldapService = require('../services/ldapService');
const User = require('../models/User');
const EquipmentType = require('../models/EquipmentType');
const EquipmentModel = require('../models/EquipmentModel');
const Equipment = require('../models/Equipment');

jest.mock('../services/ldapService');

const MONGO_URI = 'mongodb://localhost:27018/patrimonio_ti_test';

let adminToken;
let userToken;
let equipmentTypeId;

beforeAll(async () => {
  await mongoose.connect(MONGO_URI);

  ldapService.authenticateUser.mockResolvedValue({
    username: 'admin.em', email: 'admin@emp.com', displayName: 'Admin', adDepartment: 'TI',
  });
  let res = await request(app).post('/api/auth/login').send({ username: 'admin.em', password: '123' });
  await User.findOneAndUpdate({ username: 'admin.em' }, { role: 'admin' });
  res = await request(app).post('/api/auth/login').send({ username: 'admin.em', password: '123' });
  adminToken = res.body.data.token;

  ldapService.authenticateUser.mockResolvedValue({
    username: 'user.em', email: 'user@emp.com', displayName: 'User', adDepartment: 'RH',
  });
  res = await request(app).post('/api/auth/login').send({ username: 'user.em', password: '123' });
  userToken = res.body.data.token;

  const et = await EquipmentType.create({ name: 'Desktop' });
  equipmentTypeId = et._id.toString();
});

afterEach(async () => {
  await EquipmentModel.deleteMany({});
  await Equipment.deleteMany({});
  jest.clearAllMocks();
});

afterAll(async () => {
  await User.deleteMany({});
  await EquipmentType.deleteMany({});
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('POST /api/equipment-models', () => {
  it('admin cria modelo de equipamento', async () => {
    const res = await request(app)
      .post('/api/equipment-models')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: equipmentTypeId, brand: 'Dell', model: 'OptiPlex', lot: 'SEA 01/2026' });

    expect(res.status).toBe(201);
    expect(res.body.data.brand).toBe('Dell');
    expect(res.body.data.model).toBe('OptiPlex');
    expect(res.body.data.lot).toBe('SEA 01/2026');
    expect(res.body.data.type.name).toBe('Desktop');
  });

  it('usuário comum não pode criar', async () => {
    const res = await request(app)
      .post('/api/equipment-models')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ type: equipmentTypeId, brand: 'HP', model: 'EliteDesk' });

    expect(res.status).toBe(403);
  });

  it('rejeita criação sem marca', async () => {
    const res = await request(app)
      .post('/api/equipment-models')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: equipmentTypeId, model: 'OptiPlex' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejeita criação sem modelo', async () => {
    const res = await request(app)
      .post('/api/equipment-models')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: equipmentTypeId, brand: 'Dell' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('aceita data de garantia no formato AAAA-MM-DD', async () => {
    const res = await request(app)
      .post('/api/equipment-models')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: equipmentTypeId, brand: 'Lenovo', model: 'ThinkPad', warrantyExpiry: '2027-12-31' });

    expect(res.status).toBe(201);
    expect(res.body.data.warrantyExpiry).toBeDefined();
  });
});

describe('GET /api/equipment-models', () => {
  it('lista modelos com paginação', async () => {
    await EquipmentModel.create({ type: equipmentTypeId, brand: 'Dell', model: 'OptiPlex' });
    await EquipmentModel.create({ type: equipmentTypeId, brand: 'HP', model: 'ProDesk' });

    const res = await request(app)
      .get('/api/equipment-models')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toBeDefined();
  });

  it('filtra por tipo', async () => {
    await EquipmentModel.create({ type: equipmentTypeId, brand: 'Dell', model: 'OptiPlex' });
    const et2 = await EquipmentType.create({ name: 'Notebook' });
    await EquipmentModel.create({ type: et2._id, brand: 'Dell', model: 'Latitude' });

    const res = await request(app)
      .get(`/api/equipment-models?type=${equipmentTypeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].model).toBe('OptiPlex');

    await EquipmentType.deleteOne({ _id: et2._id });
  });

  it('inclui contagem de equipamentos vinculados', async () => {
    const em = await EquipmentModel.create({ type: equipmentTypeId, brand: 'Dell', model: 'OptiPlex' });
    await Equipment.create({ equipmentModel: em._id, serialNumber: 'SN-COUNT-01', patrimonyNumber: 'PAT-COUNT-01' });
    await Equipment.create({ equipmentModel: em._id, serialNumber: 'SN-COUNT-02', patrimonyNumber: 'PAT-COUNT-02' });

    const res = await request(app)
      .get('/api/equipment-models')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const found = res.body.data.find((m) => m._id === em._id.toString());
    expect(found.equipmentCount).toBe(2);
  });

  it('usuário comum pode listar', async () => {
    const res = await request(app)
      .get('/api/equipment-models')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/equipment-models/all', () => {
  it('retorna todos os modelos ativos sem paginação', async () => {
    await EquipmentModel.create({ type: equipmentTypeId, brand: 'Dell', model: 'OptiPlex', isActive: true });
    await EquipmentModel.create({ type: equipmentTypeId, brand: 'HP', model: 'ProDesk', isActive: false });

    const res = await request(app)
      .get('/api/equipment-models/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Deve retornar apenas os ativos
    expect(res.body.data.every((m) => m.isActive === true)).toBe(true);
  });
});

describe('GET /api/equipment-models/:id', () => {
  it('retorna modelo por id', async () => {
    const em = await EquipmentModel.create({ type: equipmentTypeId, brand: 'Dell', model: 'OptiPlex' });

    const res = await request(app)
      .get(`/api/equipment-models/${em._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.brand).toBe('Dell');
  });

  it('retorna 404 para id inexistente', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .get(`/api/equipment-models/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/equipment-models/:id', () => {
  it('admin atualiza modelo', async () => {
    const em = await EquipmentModel.create({ type: equipmentTypeId, brand: 'Dell', model: 'OptiPlex' });

    const res = await request(app)
      .put(`/api/equipment-models/${em._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ lot: 'SEA 99/2026' });

    expect(res.status).toBe(200);
    expect(res.body.data.lot).toBe('SEA 99/2026');
    expect(res.body.data.brand).toBe('Dell');
  });

  it('usuário comum não pode atualizar', async () => {
    const em = await EquipmentModel.create({ type: equipmentTypeId, brand: 'Dell', model: 'OptiPlex' });

    const res = await request(app)
      .put(`/api/equipment-models/${em._id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lot: 'SEA 99/2026' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/equipment-models/:id', () => {
  it('admin exclui modelo sem equipamentos', async () => {
    const em = await EquipmentModel.create({ type: equipmentTypeId, brand: 'Dell', model: 'OptiPlex' });

    const res = await request(app)
      .delete(`/api/equipment-models/${em._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(await EquipmentModel.findById(em._id)).toBeNull();
  });

  it('bloqueia exclusão de modelo com equipamentos vinculados', async () => {
    const em = await EquipmentModel.create({ type: equipmentTypeId, brand: 'Dell', model: 'OptiPlex' });
    await Equipment.create({ equipmentModel: em._id, serialNumber: 'SN-DEL-01', patrimonyNumber: 'PAT-DEL-01' });

    const res = await request(app)
      .delete(`/api/equipment-models/${em._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EQUIPMENT_MODEL_IN_USE');
  });

  it('retorna 404 para id inexistente', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .delete(`/api/equipment-models/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('usuário comum não pode excluir', async () => {
    const em = await EquipmentModel.create({ type: equipmentTypeId, brand: 'HP', model: 'ProDesk' });

    const res = await request(app)
      .delete(`/api/equipment-models/${em._id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

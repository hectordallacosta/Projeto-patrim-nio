const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const ldapService = require('../services/ldapService');
const User = require('../models/User');
const EquipmentType = require('../models/EquipmentType');
const EquipmentModel = require('../models/EquipmentModel');
const Equipment = require('../models/Equipment');
const Sector = require('../models/Sector');

jest.mock('../services/ldapService');

const MONGO_URI = 'mongodb://localhost:27017/patrimonio_ti_test';

let adminToken;
let userToken;
let equipmentModelId;
let sectorId;
let userId;

beforeAll(async () => {
  await mongoose.connect(MONGO_URI);

  // Cria admin via login mockado
  ldapService.authenticateUser.mockResolvedValue({
    username: 'admin.test',
    email: 'admin@empresa.com.br',
    displayName: 'Admin Teste',
    adDepartment: 'TI',
  });
  let res = await request(app).post('/api/auth/login').send({ username: 'admin.test', password: '123' });
  await User.findOneAndUpdate({ username: 'admin.test' }, { role: 'admin' }, { new: true });
  // Re-login para pegar token com role admin
  res = await request(app).post('/api/auth/login').send({ username: 'admin.test', password: '123' });
  adminToken = res.body.data.token;

  // Cria usuário comum
  ldapService.authenticateUser.mockResolvedValue({
    username: 'user.test',
    email: 'user@empresa.com.br',
    displayName: 'Usuário Teste',
    adDepartment: 'RH',
  });
  res = await request(app).post('/api/auth/login').send({ username: 'user.test', password: '123' });
  userToken = res.body.data.token;
  userId = res.body.data.user.id;

  // Cria tipo, modelo de equipamento e setor para os testes
  const et = await EquipmentType.create({ name: 'Notebook' });
  const em = await EquipmentModel.create({ type: et._id, brand: 'Dell', model: 'Latitude' });
  equipmentModelId = em._id.toString();

  const sector = await Sector.create({ name: 'TI' });
  sectorId = sector._id.toString();
});

afterEach(async () => {
  await Equipment.deleteMany({});
  jest.clearAllMocks();
});

afterAll(async () => {
  await User.deleteMany({});
  await Equipment.deleteMany({});
  await EquipmentModel.deleteMany({});
  await EquipmentType.deleteMany({});
  await Sector.deleteMany({});
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('POST /api/equipment', () => {
  it('admin cria equipamento', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ equipmentModel: equipmentModelId, serialNumber: 'SN001' });

    expect(res.status).toBe(201);
    expect(res.body.data.serialNumber).toBe('SN001');
  });

  it('usuário comum não pode criar', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ equipmentModel: equipmentModelId, serialNumber: 'SN002' });

    expect(res.status).toBe(403);
  });

  it('bloqueia serialNumber duplicado', async () => {
    await Equipment.create({ equipmentModel: equipmentModelId, serialNumber: 'SN-DUP' });
    const res = await request(app)
      .post('/api/equipment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ equipmentModel: equipmentModelId, serialNumber: 'SN-DUP' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SERIAL_NUMBER_DUPLICATE');
  });

  it('rejeita criação sem modelo de equipamento', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ serialNumber: 'SN-SEM-MODELO' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/equipment/:id/assign', () => {
  it('vincula equipamento a usuário', async () => {
    const eq = await Equipment.create({ equipmentModel: equipmentModelId, serialNumber: 'SN-A1' });

    const res = await request(app)
      .patch(`/api/equipment/${eq._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assignedTo: userId });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('assigned');
  });

  it('vincula equipamento a setor', async () => {
    const eq = await Equipment.create({ equipmentModel: equipmentModelId, serialNumber: 'SN-A2' });

    const res = await request(app)
      .patch(`/api/equipment/${eq._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assignedSector: sectorId });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('assigned');
  });

  it('bloqueia vínculo duplo (usuário e setor)', async () => {
    const eq = await Equipment.create({ equipmentModel: equipmentModelId, serialNumber: 'SN-A3' });

    const res = await request(app)
      .patch(`/api/equipment/${eq._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assignedTo: userId, assignedSector: sectorId });

    expect(res.status).toBe(400);
  });

  it('bloqueia vínculo em equipamento em manutenção', async () => {
    const eq = await Equipment.create({
      equipmentModel: equipmentModelId, serialNumber: 'SN-A4', status: 'maintenance',
    });

    const res = await request(app)
      .patch(`/api/equipment/${eq._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assignedTo: userId });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EQUIPMENT_UNAVAILABLE');
  });

  it('transfere equipamento já vinculado para outro usuário', async () => {
    const eq = await Equipment.create({
      equipmentModel: equipmentModelId, serialNumber: 'SN-A5',
      status: 'assigned', assignedTo: userId, assignmentDate: new Date(),
    });

    ldapService.authenticateUser.mockResolvedValue({
      username: 'outro.usuario', email: 'outro@empresa.com.br', displayName: 'Outro', adDepartment: 'TI',
    });
    let r = await request(app).post('/api/auth/login').send({ username: 'outro.usuario', password: '123' });
    const outroUserId = r.body.data.user.id;

    const res = await request(app)
      .patch(`/api/equipment/${eq._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assignedTo: outroUserId });

    expect(res.status).toBe(200);
    const updated = await Equipment.findById(eq._id);
    expect(updated.assignmentHistory).toHaveLength(1);

    await User.deleteOne({ username: 'outro.usuario' });
  });
});

describe('PATCH /api/equipment/:id/unassign', () => {
  it('desvincula e registra histórico', async () => {
    const eq = await Equipment.create({
      equipmentModel: equipmentModelId, serialNumber: 'SN-U1',
      status: 'assigned', assignedTo: userId, assignmentDate: new Date(),
    });

    const res = await request(app)
      .patch(`/api/equipment/${eq._id}/unassign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Devolvido pelo usuário' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('available');
    expect(res.body.data.assignedTo).toBeNull();

    const updated = await Equipment.findById(eq._id);
    expect(updated.assignmentHistory).toHaveLength(1);
  });
});

describe('PATCH /api/equipment/:id/status', () => {
  it('admin altera status para maintenance', async () => {
    const eq = await Equipment.create({ equipmentModel: equipmentModelId, serialNumber: 'SN-S1' });

    const res = await request(app)
      .patch(`/api/equipment/${eq._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'maintenance' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('maintenance');
  });

  it('rejeita status inválido', async () => {
    const eq = await Equipment.create({ equipmentModel: equipmentModelId, serialNumber: 'SN-S2' });

    const res = await request(app)
      .patch(`/api/equipment/${eq._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'invalido' });

    expect(res.status).toBe(422);
  });
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const ldapService = require('../services/ldapService');
const User = require('../models/User');

jest.mock('../services/ldapService');

const MONGO_URI = 'mongodb://localhost:27017/patrimonio_ti_test';

beforeAll(async () => {
  await mongoose.connect(MONGO_URI);
});

afterEach(async () => {
  await User.deleteMany({});
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('POST /api/auth/login', () => {
  it('retorna token com credenciais válidas', async () => {
    ldapService.authenticateUser.mockResolvedValue({
      username: 'joao.silva',
      email: 'joao.silva@empresa.com.br',
      displayName: 'João Silva',
      adDepartment: 'TI',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'joao.silva', password: 'Senha123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.username).toBe('joao.silva');
  });

  it('retorna 401 com credenciais inválidas', async () => {
    const err = new Error('Credenciais inválidas');
    err.code = 'LDAP_AUTH_FAILED';
    ldapService.authenticateUser.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'joao.silva', password: 'ErradA' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('LDAP_AUTH_FAILED');
  });

  it('retorna 422 sem body', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(422);
  });
});

describe('GET /api/auth/me', () => {
  it('retorna dados do usuário autenticado', async () => {
    ldapService.authenticateUser.mockResolvedValue({
      username: 'joao.silva',
      email: 'joao.silva@empresa.com.br',
      displayName: 'João Silva',
      adDepartment: 'TI',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'joao.silva', password: 'Senha123' });

    const token = loginRes.body.data.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('joao.silva');
  });

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_MISSING');
  });
});

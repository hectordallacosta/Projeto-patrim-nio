require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth.routes');
const sectorRoutes = require('./routes/sector.routes');
const equipmentTypeRoutes = require('./routes/equipmentType.routes');
const equipmentModelRoutes = require('./routes/equipmentModel.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const userRoutes = require('./routes/user.routes');
const auditLogRoutes = require('./routes/auditLog.routes');
const savedOURoutes = require('./routes/savedOU.routes');
const stockRoutes = require('./routes/stock.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/equipment-types', equipmentTypeRoutes);
app.use('/api/equipment-models', equipmentModelRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/saved-ous', savedOURoutes);
app.use('/api/stocks', stockRoutes);

app.use(errorHandler);

module.exports = app;

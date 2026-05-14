const mongoose = require('mongoose');

const assignmentHistorySchema = new mongoose.Schema(
  {
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedSector: { type: mongoose.Schema.Types.ObjectId, ref: 'Sector', default: null },
    assignedAt: { type: Date, required: true },
    returnedAt: { type: Date, required: true },
    note: { type: String, default: '' },
    fromStock: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock', default: null },
    action: { type: String, default: 'assigned' },
  },
  { _id: false }
);

const equipmentSchema = new mongoose.Schema(
  {
    equipmentModel: { type: mongoose.Schema.Types.ObjectId, ref: 'EquipmentModel', required: true },
    serialNumber: { type: String, unique: true, sparse: true, trim: true },
    patrimonyNumber: { type: String, required: [true, 'Número de patrimônio é obrigatório'], unique: true, trim: true },
    status: {
      type: String,
      enum: ['available', 'assigned', 'maintenance', 'decommissioned', 'in_stock'],
      default: 'in_stock',
    },
    stock: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock', default: null },
    // vinculado a usuário OU setor — nunca ambos (validado no service)
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedSector: { type: mongoose.Schema.Types.ObjectId, ref: 'Sector', default: null },
    assignmentDate: { type: Date, default: null },
    assignmentHistory: [assignmentHistorySchema],
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Equipment', equipmentSchema);

const mongoose = require('mongoose');

const assignmentHistorySchema = new mongoose.Schema(
  {
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedSector: { type: mongoose.Schema.Types.ObjectId, ref: 'Sector', default: null },
    assignedAt: { type: Date, required: true },
    returnedAt: { type: Date, required: true },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const equipmentSchema = new mongoose.Schema(
  {
    equipmentModel: { type: mongoose.Schema.Types.ObjectId, ref: 'EquipmentModel', required: true },
    serialNumber: { type: String, required: true, unique: true, trim: true },
    patrimonyNumber: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ['available', 'assigned', 'maintenance', 'decommissioned'],
      default: 'available',
    },
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

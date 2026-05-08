const mongoose = require('mongoose');

const equipmentModelSchema = new mongoose.Schema(
  {
    type: { type: mongoose.Schema.Types.ObjectId, ref: 'EquipmentType', required: true },
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    lot: { type: String, trim: true, default: null },
    purchaseDate: { type: Date, default: null },
    warrantyExpiry: { type: Date, default: null },
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

equipmentModelSchema.index(
  { brand: 1, model: 1, type: 1 },
  { unique: true, collation: { locale: 'pt', strength: 2 } }
);

module.exports = mongoose.model('EquipmentModel', equipmentModelSchema);

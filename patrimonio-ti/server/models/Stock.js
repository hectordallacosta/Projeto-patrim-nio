const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

stockSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'pt', strength: 2 } }
);

module.exports = mongoose.model('Stock', stockSchema);

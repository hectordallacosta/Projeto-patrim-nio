const mongoose = require('mongoose');

const savedOUSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ouPath: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastSyncAt: { type: Date, default: null },
    lastSyncResult: {
      total:    { type: Number, default: null },
      imported: { type: Number, default: null },
      updated:  { type: Number, default: null },
      errors:   { type: Number, default: null },
    },
  },
  { timestamps: true }
);

savedOUSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'pt', strength: 2 } }
);

module.exports = mongoose.model('SavedOU', savedOUSchema);

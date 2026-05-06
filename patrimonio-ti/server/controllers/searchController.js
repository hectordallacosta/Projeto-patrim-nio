const Equipment = require('../models/Equipment');
const EquipmentModel = require('../models/EquipmentModel');
const User = require('../models/User');
const Sector = require('../models/Sector');
const { success } = require('../utils/apiResponse');

const search = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);

    if (!q) {
      return success(res, { equipment: [], users: [], sectors: [] });
    }

    const regex = { $regex: q, $options: 'i' };

    // Busca modelos cujo brand/model/lot coincide com a query
    const matchingModels = await EquipmentModel.find({
      $or: [{ brand: regex }, { model: regex }, { lot: regex }],
    }).select('_id').lean();

    const [equipment, users, sectors] = await Promise.all([
      Equipment.find({
        $or: [
          { serialNumber: regex },
          { patrimonyNumber: regex },
          { equipmentModel: { $in: matchingModels.map((m) => m._id) } },
        ],
      })
        .populate({
          path: 'equipmentModel',
          select: 'brand model lot type',
          populate: { path: 'type', select: 'name' },
        })
        .select('serialNumber patrimonyNumber status equipmentModel')
        .limit(limit)
        .lean(),

      User.find({
        isActive: true,
        $or: [{ displayName: regex }, { username: regex }, { email: regex }],
      })
        .populate('sector', 'name')
        .select('displayName username email sector adImported')
        .limit(limit)
        .lean(),

      Sector.find({ name: regex, isActive: true })
        .select('name description')
        .limit(limit)
        .lean(),
    ]);

    return success(res, { equipment, users, sectors });
  } catch (err) {
    next(err);
  }
};

module.exports = { search };

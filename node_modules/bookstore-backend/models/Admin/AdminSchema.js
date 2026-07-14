const mongoose = require('../config');

const AdminSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  permissions: [{ type: String }]
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'admin'
  }
});

module.exports = mongoose.model('Admin', AdminSchema);

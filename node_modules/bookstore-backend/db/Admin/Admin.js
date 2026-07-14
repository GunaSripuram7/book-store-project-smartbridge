const mongoose = require('../config');

const adminSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'admin'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('admin', adminSchema);

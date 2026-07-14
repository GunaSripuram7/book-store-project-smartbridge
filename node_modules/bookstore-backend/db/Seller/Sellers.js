const mongoose = require('../config');

const sellerSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'vendor'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Seller', sellerSchema);

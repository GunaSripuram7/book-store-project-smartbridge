const mongoose = require('../config');

const sellerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storeName: { type: String, default: '' },
  storefront: { type: String, default: '' },
  rating: { type: Number, default: 0 }
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'vendor'
  }
});

module.exports = mongoose.model('Seller', sellerSchema);

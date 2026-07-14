const mongoose = require('../config');

const wishlistItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true }
  itemImage: String,
  title: String
}, { timestamps: true });

module.exports = mongoose.model('WishlistItem', wishlistItemSchema);

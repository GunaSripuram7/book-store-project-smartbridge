const mongoose = require('../config');

const wishlistItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'books' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    userName: String,
    itemImage: String,
    title: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('WishlistItem', wishlistItemSchema);

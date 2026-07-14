const mongoose = require('../config');

const addItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    author: { type: String, required: true },
    genre: { type: String, required: true },
    itemImage: String,
    description: String,
    price: String,
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('books', addItemSchema);

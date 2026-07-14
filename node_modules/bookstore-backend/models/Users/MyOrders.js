const mongoose = require('../config');

const orderSchema = new mongoose.Schema({
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  buyerName: { type: String, required: true },
  buyerEmail: { type: String, required: true },
  status: { type: String, default: 'processing' },
  orderedAt: { type: Date, default: Date.now },
  expectedDelivery: { type: Date },
  shipping: {
    name: String,
    address: String,
    city: String,
    state: String,
    pincode: String
  },
  items: [{
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    title: String,
    author: String,
    price: Number,
    quantity: Number,
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sellerName: String
  }],
  subtotal: Number,
  shippingFee: Number,
  total: Number
}, { timestamps: true });

module.exports = mongoose.model('MyOrder', orderSchema);

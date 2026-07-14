const mongoose = require('../config');

const orderSchema = new mongoose.Schema(
  {
    flatno: String,
    pincode: String,
    city: String,
    state: String,
    totalamount: String,
    seller: String,
    sellerId: String,
    booktitle: String,
    bookauthor: String,
    bookgenre: String,
    itemImage: String,
    description: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    userName: String,
    BookingDate: {
      type: String,
      default: () => new Date().toLocaleDateString('hi-IN')
    },
    Delivery: {
      type: String,
      default: () => {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() + 7);
        const day = currentDate.getDate();
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();
        return `${month}/${day}/${year}`;
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('myorders', orderSchema);

const mongoose = require('../config');

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('users', userSchema);

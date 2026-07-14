const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/BookBound';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connection established');
  })
  .catch((error) => {
    console.log(`MongoDB connection unavailable: ${error.message}`);
  });

module.exports = mongoose;

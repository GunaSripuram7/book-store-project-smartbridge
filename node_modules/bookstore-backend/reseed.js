const mongoose = require('./db/config');
const User = require('./models/Users/UserSchema');
const Book = require('./models/Seller/BookSchema');
const Order = require('./models/Users/MyOrders');
const bcrypt = require('bcryptjs');

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

const users = [
  {
    name: "Admin",
    email: "admin@bookbound.local",
    passwordHash: hashPassword('password123'),
    role: "admin",
    wishlist: [],
    cart: []
  },
  {
    name: "Priya Sen",
    email: "seller1@bookbound.local",
    passwordHash: hashPassword('password123'),
    role: "seller",
    wishlist: [],
    cart: []
  },
  {
    name: "Sara Khan",
    email: "user@bookbound.local",
    passwordHash: hashPassword('password123'),
    role: "user",
    wishlist: [],
    cart: []
  }
];

const books = [
  {
    title: "Atomic Habits",
    author: "James Clear",
    genre: "Self Help",
    price: 500,
    rating: 4.8,
    stock: 17,
    description: "A practical guide to building good habits and breaking bad ones.",
    featured: true,
    badge: "Bestseller",
    itemImage: "/images/atomic habits book.jpg"
  },
  {
    title: "Clean Code",
    author: "Robert C. Martin",
    genre: "Technology",
    price: 899,
    rating: 4.9,
    stock: 5,
    description: "A Handbook of Agile Software Craftsmanship.",
    featured: true,
    badge: "Trending",
    itemImage: "/images/clean code.jpg"
  },
  {
    title: "Rich Dad Poor Dad",
    author: "Robert T. Kiyosaki",
    genre: "Finance",
    price: 399,
    rating: 4.7,
    stock: 22,
    description: "What the Rich Teach Their Kids About Money.",
    featured: true,
    badge: "Classic",
    itemImage: "/images/rich dad poor dad book.jpg"
  },
  {
    title: "The 48 Laws of Power",
    author: "Robert Greene",
    genre: "Self Help",
    price: 650,
    rating: 4.6,
    stock: 10,
    description: "Amoral, cunning, ruthless, and instructive.",
    featured: false,
    badge: "",
    itemImage: "/images/the 48 laws of power.jpg"
  },
  {
    title: "The Alchemist",
    author: "Paulo Coelho",
    genre: "Fiction",
    price: 349,
    rating: 4.8,
    stock: 30,
    description: "A fable about following your dream.",
    featured: false,
    badge: "Must Read",
    itemImage: "/images/the alchemits.jpg"
  },
  {
    title: "The Art of Thinking Clearly",
    author: "Rolf Dobelli",
    genre: "Psychology",
    price: 499,
    rating: 4.5,
    stock: 15,
    description: "Better decision making.",
    featured: false,
    badge: "",
    itemImage: "/images/the art of thinking clearly.jpg"
  },
  {
    title: "The Millionaire Fastlane",
    author: "MJ DeMarco",
    genre: "Finance",
    price: 599,
    rating: 4.6,
    stock: 8,
    description: "Crack the Code to Wealth and Live Rich for a Lifetime.",
    featured: false,
    badge: "",
    itemImage: "/images/the millionaire fastlane.jpg"
  },
  {
    title: "The Secret",
    author: "Rhonda Byrne",
    genre: "Self Help",
    price: 450,
    rating: 4.3,
    stock: 12,
    description: "The law of attraction.",
    featured: false,
    badge: "",
    itemImage: "/images/the secret.jpg"
  }
];

async function reseed() {
  await mongoose.connection.dropDatabase();
  console.log("Dropped DB");

  const createdUsers = await User.insertMany(users);
  console.log("Created users");

  const seller = createdUsers.find(u => u.role === 'seller');
  
  const booksWithSeller = books.map(b => ({
    ...b,
    sellerId: seller._id,
    sellerName: seller.name
  }));

  await Book.insertMany(booksWithSeller);
  console.log("Created books");

  process.exit(0);
}

reseed();

require('dotenv').config();
require('../db/config');

const express = require('express');
const cors = require('cors');

const User = require('../models/Users/UserSchema');
const Book = require('../models/Seller/BookSchema');
const Order = require('../models/Users/MyOrders');
const seed = require('./data/seed');
const {
  createAuthMiddleware,
  hashPassword,
  issueToken,
  requireRole,
  verifyPassword
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : ['http://localhost:5173', 'http://localhost:5174'];

async function registerAccount(req, res, role = 'user') {
  const { name, email, password } = req.body || {};
  const normalizedName = String(name || '').trim();
  const normalizedEmail = normalizeText(email);

  if (!normalizedName || !normalizedEmail || !String(password || '').trim()) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  if (!['user', 'seller', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Only user, seller, and admin registrations are allowed.' });
  }

  const alreadyExists = await User.findOne({ email: normalizedEmail });
  if (alreadyExists) {
    return res.status(409).json({ message: 'An account with that email already exists.' });
  }

  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    role,
    wishlist: []
  });

  const token = issueToken(user);
  return res.status(201).json({ token, user: safeUser(user) });
}

async function loginAccount(req, res, role) {
  const { email, password } = req.body || {};
  const normalizedEmail = normalizeText(email);
  const user = await User.findOne({
    email: normalizedEmail,
    ...(role ? { role } : {})
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const token = issueToken(user);
  return res.json({ token, user: safeUser(user) });
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function safeUser(user) {
  if (!user) return null;
  const plain = typeof user.toObject === 'function' ? user.toObject() : user;
  return {
    id: String(plain._id || plain.id),
    name: plain.name,
    email: plain.email,
    role: plain.role,
    status: plain.status || 'approved',
    wishlist: (plain.wishlist || []).map((value) => String(value)),
    createdAt: plain.createdAt || null
  };
}

function publicBook(book) {
  const plain = typeof book.toObject === 'function' ? book.toObject() : book;
  return {
    id: String(plain._id || plain.id),
    title: plain.title,
    author: plain.author,
    genre: plain.genre,
    description: plain.description,
    price: plain.price,
    rating: plain.rating,
    stock: plain.stock,
    badge: plain.badge,
    featured: plain.featured,
    sellerId: String(plain.sellerId?._id || plain.sellerId || ''),
    sellerName: plain.sellerName,
    cover: plain.cover || {},
    tags: plain.tags || [],
    itemImage: plain.itemImage || '',
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}

function publicOrder(order) {
  const plain = typeof order.toObject === 'function' ? order.toObject() : order;
  return {
    id: String(plain._id || plain.id),
    buyerId: String(plain.buyerId?._id || plain.buyerId || ''),
    buyerName: plain.buyerName,
    buyerEmail: plain.buyerEmail,
    status: plain.status,
    orderedAt: plain.orderedAt,
    expectedDelivery: plain.expectedDelivery,
    shipping: plain.shipping,
    items: (plain.items || []).map((item) => ({
      bookId: String(item.bookId?._id || item.bookId || ''),
      title: item.title,
      author: item.author,
      price: item.price,
      quantity: item.quantity,
      sellerId: String(item.sellerId?._id || item.sellerId || ''),
      sellerName: item.sellerName
    })),
    subtotal: plain.subtotal,
    shippingFee: plain.shippingFee,
    total: plain.total,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}

function formatStoreSummary(users, books, orders) {
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const pendingSellers = users.filter((u) => u.role === 'seller' && u.status === 'pending').length;
  const suspendedSellers = users.filter((u) => u.role === 'seller' && u.status === 'suspended').length;
  const approvedSellers = users.filter((u) => u.role === 'seller' && u.status === 'approved').length;
  const avgBookRating = books.length
    ? (books.reduce((sum, b) => sum + (Number(b.rating) || 0), 0) / books.length).toFixed(1)
    : '0.0';
  return {
    users: users.filter((user) => user.role === 'user').length,
    sellers: users.filter((user) => user.role === 'seller').length,
    books: books.length,
    orders: orders.length,
    totalRevenue,
    pendingSellers,
    suspendedSellers,
    approvedSellers,
    avgBookRating,
    wishlistItems: users.reduce((count, user) => count + (user.wishlist?.length || 0), 0)
  };
}

async function seedDatabase() {
  const userCount = await User.countDocuments();
  const bookCount = await Book.countDocuments();
  const orderCount = await Order.countDocuments();

  if (!userCount) {
    await User.insertMany(seed.users.map((user) => ({ ...user })));
  }

  const users = await User.find().lean();
  const userMap = new Map(users.map((user) => [user.email, user]));
  const sellerUsers = users.filter((user) => user.role === 'seller');

  if (!bookCount) {
    const createdBooks = seed.books.map((book, index) => {
      const seller = sellerUsers[index % sellerUsers.length];
      return {
        ...book,
        sellerId: seller._id,
        sellerName: book.sellerName || seller.name,
        price: toNumber(book.price),
        rating: toNumber(book.rating, 4.5),
        stock: toNumber(book.stock, 0)
      };
    });

    await Book.insertMany(createdBooks);
  }

  const books = await Book.find().lean();

  if (!orderCount) {
    const mappedOrders = seed.orders.map((order, index) => {
      const buyer = userMap.get(order.buyerEmail) || users.find((user) => user.role === 'user');
      const items = (order.items || []).map((item) => {
        const book = books.find((entry) => normalizeText(entry.title) === normalizeText(item.title));
        return {
          bookId: book?._id,
          title: item.title,
          author: item.author,
          price: toNumber(item.price),
          quantity: Math.max(1, toNumber(item.quantity, 1)),
          sellerId: book?.sellerId,
          sellerName: item.sellerName || book?.sellerName || ''
        };
      });

      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const fallbackFee = subtotal >= 999 ? 0 : 49;

      return {
        buyerId: buyer?._id || users[index % users.length]?._id,
        buyerName: buyer?.name || order.shipping?.name || 'Customer',
        buyerEmail: buyer?.email || order.buyerEmail || 'user@bookbound.local',
        status: order.status || 'processing',
        orderedAt: new Date(order.orderedAt || Date.now()),
        expectedDelivery: new Date(order.expectedDelivery || daysFromNow(5)),
        shipping: order.shipping,
        items,
        subtotal,
        shippingFee: toNumber(order.shippingFee, fallbackFee),
        total: toNumber(order.total, subtotal + fallbackFee)
      };
    });

    await Order.insertMany(mappedOrders);
  }
}

const auth = createAuthMiddleware(async (id) => User.findById(id), safeUser);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (/^http:\/\/localhost:\d+$/.test(origin) || CLIENT_ORIGIN.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'booknest-api' });
});

app.post('/api/auth/register', (req, res) => registerAccount(req, res, req.body?.role || 'user'));

app.post('/api/auth/login', (req, res) => loginAccount(req, res, req.body?.role));

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/books', async (req, res) => {
  const { q, genre, author, sort, minPrice, maxPrice } = req.query;
  const query = {};

  if (genre) {
    query.genre = new RegExp(`^${String(genre).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  }

  if (author) {
    query.author = new RegExp(String(author).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = toNumber(minPrice);
    if (maxPrice) query.price.$lte = toNumber(maxPrice);
  }

  let books = await Book.find(query).sort({ featured: -1, rating: -1, createdAt: -1 });

  if (q) {
    const term = normalizeText(q);
    books = books.filter((book) => {
      const haystack = [book.title, book.author, book.genre, book.description, ...(book.tags || [])].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }

  switch (sort) {
    case 'price-asc':
      books.sort((a, b) => Number(a.price) - Number(b.price));
      break;
    case 'price-desc':
      books.sort((a, b) => Number(b.price) - Number(a.price));
      break;
    case 'rating':
      books.sort((a, b) => Number(b.rating) - Number(a.rating));
      break;
    case 'newest':
      books.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    default:
      break;
  }

  res.json({ books: books.map(publicBook) });
});

app.get('/api/books/:id', async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  res.json({ book: publicBook(book) });
});

app.post('/api/books', auth, requireRole('seller', 'admin'), async (req, res) => {
  const { title, author, genre, price, description, rating = 4.6, stock = 10, badge, cover, tags = [], itemImage } = req.body || {};

  if (!title || !author || !genre || !description) {
    return res.status(400).json({ message: 'Title, author, genre, and description are required.' });
  }

  const book = await Book.create({
    title: String(title).trim(),
    author: String(author).trim(),
    genre: String(genre).trim(),
    price: toNumber(price),
    rating: Math.max(0, Math.min(5, toNumber(rating, 4.6))),
    stock: toNumber(stock, 10),
    description: String(description).trim(),
    sellerId: req.rawUser._id,
    sellerName: req.user.name,
    featured: false,
    badge: String(badge || 'Fresh Pick').trim(),
    cover: cover || {
      primary: '#2d3142',
      secondary: '#ef8354',
      accent: '#4f5d75'
    },
    tags: Array.isArray(tags) ? tags : [],
    itemImage: itemImage || ''
  });

  res.status(201).json({ book: publicBook(book) });
});

app.put('/api/books/:id', auth, requireRole('seller', 'admin'), async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  if (req.user.role === 'seller' && String(book.sellerId) !== String(req.rawUser._id)) {
    return res.status(403).json({ message: 'You can only edit your own books.' });
  }

  const updatable = ['title', 'author', 'genre', 'description', 'badge', 'itemImage'];
  updatable.forEach((field) => {
    if (req.body[field] !== undefined) {
      book[field] = String(req.body[field]).trim();
    }
  });

  if (req.body.price !== undefined) book.price = toNumber(req.body.price, book.price);
  if (req.body.rating !== undefined) book.rating = Math.max(0, Math.min(5, toNumber(req.body.rating, book.rating)));
  if (req.body.stock !== undefined) book.stock = Math.max(0, toNumber(req.body.stock, book.stock));
  if (req.body.cover) book.cover = req.body.cover;
  if (req.body.tags) book.tags = Array.isArray(req.body.tags) ? req.body.tags : book.tags;

  await book.save();
  res.json({ book: publicBook(book) });
});

app.delete('/api/books/:id', auth, requireRole('seller', 'admin'), async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  if (req.user.role === 'seller' && String(book.sellerId) !== String(req.rawUser._id)) {
    return res.status(403).json({ message: 'You can only delete your own books.' });
  }

  await Book.deleteOne({ _id: book._id });
  await User.updateMany({}, { $pull: { wishlist: book._id } });
  res.json({ message: 'Book deleted.' });
});

app.get('/api/wishlist', auth, async (req, res) => {
  const user = await User.findById(req.rawUser._id).populate('wishlist');
  res.json({ books: (user?.wishlist || []).map(publicBook) });
});

app.post('/api/wishlist/:bookId', auth, async (req, res) => {
  const book = await Book.findById(req.params.bookId);
  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  await User.updateOne({ _id: req.rawUser._id }, { $addToSet: { wishlist: book._id } });
  const user = await User.findById(req.rawUser._id).populate('wishlist');
  res.json({ books: (user?.wishlist || []).map(publicBook) });
});

app.delete('/api/wishlist/:bookId', auth, async (req, res) => {
  await User.updateOne({ _id: req.rawUser._id }, { $pull: { wishlist: req.params.bookId } });
  const user = await User.findById(req.rawUser._id).populate('wishlist');
  res.json({ books: (user?.wishlist || []).map(publicBook) });
});

app.post('/api/orders', auth, async (req, res) => {
  const { items = [], shipping = {} } = req.body || {};

  if (!items.length) {
    return res.status(400).json({ message: 'Add at least one book before checkout.' });
  }

  const bookIds = items.map((item) => item.bookId || item.id);
  const books = await Book.find({ _id: { $in: bookIds } });

  const normalizedItems = items
    .map((item) => {
      const book = books.find((entry) => String(entry._id) === String(item.bookId || item.id));
      if (!book) return null;

      return {
        bookId: book._id,
        title: book.title,
        author: book.author,
        price: Number(book.price),
        quantity: Math.max(1, toNumber(item.quantity, 1)),
        sellerId: book.sellerId,
        sellerName: book.sellerName
      };
    })
    .filter(Boolean);

  if (!normalizedItems.length) {
    return res.status(400).json({ message: 'None of the selected books are available.' });
  }

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = subtotal >= 999 ? 0 : 49;

  const order = await Order.create({
    buyerId: req.rawUser._id,
    buyerName: req.user.name,
    buyerEmail: req.user.email,
    status: 'processing',
    orderedAt: new Date(),
    expectedDelivery: daysFromNow(5),
    shipping: {
      name: String(shipping.name || req.user.name).trim(),
      address: String(shipping.address || '').trim(),
      city: String(shipping.city || '').trim(),
      state: String(shipping.state || '').trim(),
      pincode: String(shipping.pincode || '').trim()
    },
    items: normalizedItems,
    subtotal,
    shippingFee,
    total: subtotal + shippingFee
  });

  await Promise.all(
    normalizedItems.map((item) => Book.updateOne({ _id: item.bookId }, { $inc: { stock: -item.quantity } }))
  );

  // Clear cart after checkout
  await User.updateOne({ _id: req.rawUser._id }, { $set: { cart: [] } });

  res.status(201).json({ order: publicOrder(order) });
});

app.get('/api/orders/me', auth, async (req, res) => {
  const orders = await Order.find({ buyerId: req.rawUser._id }).sort({ createdAt: -1 });
  res.json({ orders: orders.map(publicOrder) });
});

app.get('/api/orders/inbox', auth, requireRole('seller', 'admin'), async (req, res) => {
  const query = req.user.role === 'admin' ? {} : { 'items.sellerId': req.rawUser._id };
  const orders = await Order.find(query).sort({ createdAt: -1 });

  const filtered = orders.map((order) => {
    const serialized = publicOrder(order);
    if (req.user.role === 'admin') return serialized;

    return {
      ...serialized,
      items: serialized.items.filter((item) => String(item.sellerId) === String(req.rawUser._id))
    };
  });

  res.json({ orders: filtered });
});

app.patch('/api/orders/:id/status', auth, requireRole('seller', 'admin'), async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  if (req.user.role === 'seller' && !order.items.some((item) => String(item.sellerId) === String(req.rawUser._id))) {
    return res.status(403).json({ message: 'You can only update orders linked to your books.' });
  }

  order.status = String(req.body.status || order.status).trim();
  await order.save();
  res.json({ order: publicOrder(order) });
});

app.get('/api/admin/dashboard', auth, requireRole('admin'), async (req, res) => {
  const [users, books, orders] = await Promise.all([User.find().sort({ createdAt: -1 }), Book.find().sort({ createdAt: -1 }), Order.find().sort({ createdAt: -1 })]);

  res.json({
    summary: formatStoreSummary(users, books, orders),
    recentBooks: books.slice(0, 5).map(publicBook),
    recentOrders: orders.slice(0, 10).map(publicOrder),
    users: users.map(safeUser),
    allOrders: orders.map(publicOrder)
  });
});

app.patch('/api/admin/users/:id/status', auth, requireRole('admin'), async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'pending', 'suspended'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Must be approved, pending, or suspended.' });
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (user.role === 'admin') {
    return res.status(403).json({ message: 'Cannot change admin status.' });
  }

  user.status = status;
  await user.save();
  res.json({ user: safeUser(user) });
});

app.get('/api/admin/users', auth, requireRole('admin'), async (req, res) => {
  const users = await User.find();
  res.json({ users: users.map(safeUser) });
});

app.get('/api/admin/books', auth, requireRole('admin'), async (req, res) => {
  const books = await Book.find().sort({ createdAt: -1 });
  res.json({ books: books.map(publicBook) });
});

app.delete('/api/admin/users/:id', auth, requireRole('admin'), async (req, res) => {
  const deleted = await User.findOneAndDelete({ _id: req.params.id, role: { $ne: 'admin' } });
  if (!deleted) {
    return res.status(404).json({ message: 'User not found.' });
  }

  await Book.updateMany({ sellerId: deleted._id }, { $set: { featured: false } });
  await Order.updateMany({ buyerId: deleted._id }, { $set: { status: 'cancelled' } });
  res.json({ message: 'User removed.' });
});

app.post('/signup', (req, res) => registerAccount(req, res, 'user'));
app.post('/login', (req, res) => loginAccount(req, res));
app.post('/ssignup', (req, res) => registerAccount(req, res, 'seller'));
app.post('/slogin', (req, res) => loginAccount(req, res, 'seller'));
app.post('/asignup', (req, res) => registerAccount(req, res, 'seller'));
app.post('/alogin', (req, res) => loginAccount(req, res, 'admin'));

app.get('/item', async (req, res) => {
  const books = await Book.find().sort({ featured: -1, rating: -1, createdAt: -1 });
  res.json(books.map(publicBook));
});

app.get('/item/:id', async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  res.json(publicBook(book));
});

app.post('/items', auth, requireRole('seller', 'admin'), async (req, res) => {
  const payload = {
    title: String(req.body.title || '').trim(),
    author: String(req.body.author || '').trim(),
    genre: String(req.body.genre || '').trim(),
    description: String(req.body.description || '').trim(),
    price: toNumber(req.body.price),
    sellerId: req.rawUser._id,
    sellerName: req.user.name,
    itemImage: req.body.itemImage || ''
  };

  if (!payload.title || !payload.author || !payload.genre) {
    return res.status(400).json({ error: 'Failed to create item' });
  }

  const book = await Book.create(payload);
  res.status(201).json(publicBook(book));
});

app.get('/getitem/:userId', async (req, res) => {
  const books = await Book.find({ sellerId: req.params.userId });
  res.json(books.map(publicBook));
});

app.delete('/itemdelete/:id', auth, requireRole('seller', 'admin'), async (req, res) => {
  await Book.deleteOne({ _id: req.params.id });
  res.sendStatus(200);
});

app.get('/orders', auth, requireRole('admin'), async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders.map(publicOrder));
});

app.get('/getsellerorders/:userId', async (req, res) => {
  const orders = await Order.find({ 'items.sellerId': req.params.userId }).sort({ createdAt: -1 });
  res.json(orders.map(publicOrder));
});

app.post('/userorder', auth, async (req, res) => {
  const { flatno, city, state, pincode, totalamount, seller, sellerId, Delivery, userName, booktitle, bookauthor, bookgenre } = req.body || {};

  const order = await Order.create({
    buyerId: req.rawUser._id,
    buyerName: userName || req.user.name,
    buyerEmail: req.user.email,
    status: 'processing',
    orderedAt: new Date(),
    expectedDelivery: new Date(Delivery || daysFromNow(7)),
    shipping: {
      name: userName || req.user.name,
      address: String(flatno || '').trim(),
      city: String(city || '').trim(),
      state: String(state || '').trim(),
      pincode: String(pincode || '').trim()
    },
    items: [
      {
        title: String(booktitle || '').trim(),
        author: String(bookauthor || '').trim(),
        price: toNumber(totalamount),
        quantity: 1,
        sellerId,
        sellerName: seller || ''
      }
    ],
    subtotal: toNumber(totalamount),
    shippingFee: 0,
    total: toNumber(totalamount)
  });

  res.status(201).json(publicOrder(order));
});

app.get('/getorders/:userId', async (req, res) => {
  const orders = await Order.find({ buyerId: req.params.userId }).sort({ createdAt: -1 });
  res.json(orders.map(publicOrder));
});

app.get('/wishlist', auth, async (req, res) => {
  const user = await User.findById(req.rawUser._id).populate('wishlist');
  res.json({ books: (user?.wishlist || []).map(publicBook) });
});

app.get('/wishlist/:userId', async (req, res) => {
  const user = await User.findById(req.params.userId).populate('wishlist');
  res.json({ books: (user?.wishlist || []).map(publicBook) });
});

app.post('/wishlist/add', auth, async (req, res) => {
  const book = await Book.findById(req.body.itemId);
  if (!book) {
    return res.status(404).json({ message: 'Item not found.' });
  }

  await User.updateOne({ _id: req.rawUser._id }, { $addToSet: { wishlist: book._id } });
  res.json({ itemId: String(book._id), title: book.title, itemImage: book.itemImage || '', userName: req.user.name });
});

app.post('/wishlist/remove', auth, async (req, res) => {
  await User.updateOne({ _id: req.rawUser._id }, { $pull: { wishlist: req.body.itemId } });
  res.json({ msg: 'Item removed from wishlist' });
});

app.get('/api/cart', auth, async (req, res) => {
  const user = await User.findById(req.rawUser._id).populate('cart.bookId');
  const normalizedCart = (user?.cart || []).map(item => {
    if (!item.bookId) return null;
    const book = item.bookId;
    return {
      id: String(book._id),
      title: book.title,
      author: book.author,
      price: book.price,
      cover: book.cover,
      itemImage: book.itemImage,
      quantity: item.quantity
    };
  }).filter(Boolean);
  res.json({ cart: normalizedCart });
});

app.post('/api/cart', auth, async (req, res) => {
  const { bookId, quantity = 1 } = req.body;
  const user = await User.findById(req.rawUser._id);
  const existingItem = user.cart.find(c => String(c.bookId) === String(bookId));

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    user.cart.push({ bookId, quantity });
  }

  await user.save();
  res.json({ message: 'Cart updated' });
});

app.put('/api/cart/:bookId', auth, async (req, res) => {
  const { quantity } = req.body;
  const user = await User.findById(req.rawUser._id);
  const existingItem = user.cart.find(c => String(c.bookId) === String(req.params.bookId));

  if (existingItem) {
    if (quantity > 0) {
      existingItem.quantity = quantity;
    } else {
      user.cart = user.cart.filter(c => String(c.bookId) !== String(req.params.bookId));
    }
    await user.save();
  }

  res.json({ message: 'Cart updated' });
});

app.delete('/api/cart/:bookId', auth, async (req, res) => {
  const user = await User.findById(req.rawUser._id);
  user.cart = user.cart.filter(c => String(c.bookId) !== String(req.params.bookId));
  await user.save();
  res.json({ message: 'Item removed from cart' });
});

app.get('/users', auth, requireRole('admin'), async (req, res) => {
  const users = await User.find({ role: 'user' });
  res.status(200).json(users.map(safeUser));
});

app.get('/sellers', auth, requireRole('admin'), async (req, res) => {
  const users = await User.find({ role: 'seller' });
  res.status(200).json(users.map(safeUser));
});

app.delete('/userdelete/:id', auth, requireRole('admin'), async (req, res) => {
  await User.deleteOne({ _id: req.params.id, role: 'user' });
  res.sendStatus(200);
});

app.delete('/sellerdelete/:id', auth, requireRole('admin'), async (req, res) => {
  await User.deleteOne({ _id: req.params.id, role: 'seller' });
  res.sendStatus(200);
});

app.delete('/userorderdelete/:id', auth, requireRole('admin'), async (req, res) => {
  await Order.deleteOne({ _id: req.params.id });
  res.sendStatus(200);
});

app.delete('/useritemdelete/:id', auth, requireRole('admin'), async (req, res) => {
  await Book.deleteOne({ _id: req.params.id });
  res.sendStatus(200);
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

async function start() {
  try {
    await seedDatabase();
  } catch (error) {
    console.log(`Seeding skipped: ${error.message}`);
  }

  app.listen(PORT, () => {
    console.log(`BookNest API running on http://localhost:${PORT}`);
  });
}

start();
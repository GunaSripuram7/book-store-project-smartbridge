import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation
} from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const initialFilters = {
  q: '',
  genre: 'All',
  sort: 'featured',
  minPrice: '',
  maxPrice: ''
};
const initialShipping = {
  name: '',
  address: '',
  city: '',
  state: '',
  pincode: ''
};
const demoAccessNote = 'Seeded demo accounts are available in the local MongoDB database during development.';

const AppContext = createContext(null);

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function apiRequest(path, { token, body, method = 'GET' } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Something went wrong.');
  }

  return payload;
}

function colorFromBook(book) {
  const palette = book?.cover || {};
  return {
    primary: palette.primary || '#314755',
    secondary: palette.secondary || '#d4a373',
    accent: palette.accent || '#f4a261'
  };
}

function matchesFilters(book, filters) {
  const term = filters.q.trim().toLowerCase();
  const genre = filters.genre;
  const minPrice = filters.minPrice ? Number(filters.minPrice) : null;
  const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null;

  if (term) {
    const haystack = [book.title, book.author, book.genre, book.description, ...(book.tags || [])]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(term)) {
      return false;
    }
  }

  if (genre !== 'All' && book.genre !== genre) {
    return false;
  }

  if (minPrice !== null && Number(book.price) < minPrice) {
    return false;
  }

  if (maxPrice !== null && Number(book.price) > maxPrice) {
    return false;
  }

  return true;
}

function sortBooks(items, sort) {
  const books = [...items];

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
      books.sort((a, b) => String(b.createdAt || b.id).localeCompare(String(a.createdAt || a.id)));
      break;
    default:
      books.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.rating) - Number(a.rating));
      break;
  }

  return books;
}

function AppProvider({ children }) {
  const [session, setSession] = useState({ token: null, user: null, ready: false });
  const [books, setBooks] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [orders, setOrders] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const stored = readJson('bookbound-session', null);
    if (stored?.token && stored?.user) {
      setSession({ token: stored.token, user: stored.user, ready: true });
      return;
    }

    setSession({ token: null, user: null, ready: true });
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadBooks() {
      try {
        const payload = await apiRequest('/books');
        if (!ignore) {
          setBooks(payload.books || []);
        }
      } catch (error) {
        if (!ignore) {
          setMessage(error.message);
        }
      }
    }

    loadBooks();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!session.ready || !session.token) {
      return undefined;
    }

    let ignore = false;

    async function loadAccountData() {
      try {
        const profile = await apiRequest('/auth/me', { token: session.token });
        if (ignore) return;

        const user = profile.user;
        setSession({ token: session.token, user, ready: true });
        localStorage.setItem('bookbound-session', JSON.stringify({ token: session.token, user }));

        const wishlistPromise = apiRequest('/wishlist', { token: session.token });
        const cartPromise = apiRequest('/cart', { token: session.token });
        const ordersPromise =
          user.role === 'seller' || user.role === 'admin'
            ? apiRequest('/orders/inbox', { token: session.token })
            : apiRequest('/orders/me', { token: session.token });
        const dashboardPromise =
          user.role === 'admin'
            ? apiRequest('/admin/dashboard', { token: session.token })
            : Promise.resolve(null);

        const [wishlistPayload, cartPayload, ordersPayload, dashboardPayload] = await Promise.all([
          wishlistPromise,
          cartPromise,
          ordersPromise,
          dashboardPromise
        ]);

        if (ignore) return;
        setWishlist(wishlistPayload.books || []);
        setCart(cartPayload.cart || []);
        setOrders(ordersPayload.orders || []);
        setDashboard(dashboardPayload);
      } catch {
        if (!ignore) {
          localStorage.removeItem('bookbound-session');
          setSession({ token: null, user: null, ready: true });
          setWishlist([]);
          setOrders([]);
          setDashboard(null);
        }
      }
    }

    loadAccountData();

    return () => {
      ignore = true;
    };
  }, [session.ready, session.token]);

  const visibleBooks = useMemo(() => sortBooks(books.filter((book) => matchesFilters(book, filters)), filters.sort), [books, filters]);
  const featuredBooks = useMemo(() => books.filter((book) => book.featured).slice(0, 4), [books]);
  const genres = useMemo(() => ['All', ...new Set(books.map((book) => book.genre))], [books]);
  const wishlistIds = useMemo(() => new Set(wishlist.map((book) => book.id)), [wishlist]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  function persistSession(token, user) {
    localStorage.setItem('bookbound-session', JSON.stringify({ token, user }));
    setSession({ token, user, ready: true });
  }

  async function refreshAccountData(token = session.token, role = session.user?.role) {
    if (!token || !role) {
      return;
    }

    const wishlistPromise = apiRequest('/wishlist', { token });
    const cartPromise = apiRequest('/cart', { token });
    const ordersPromise =
      role === 'seller' || role === 'admin'
        ? apiRequest('/orders/inbox', { token })
        : apiRequest('/orders/me', { token });
    const dashboardPromise = role === 'admin' ? apiRequest('/admin/dashboard', { token }) : Promise.resolve(null);

    const [wishlistPayload, cartPayload, ordersPayload, dashboardPayload] = await Promise.all([
      wishlistPromise,
      cartPromise,
      ordersPromise,
      dashboardPromise
    ]);

    setWishlist(wishlistPayload.books || []);
    setCart(cartPayload.cart || []);
    setOrders(ordersPayload.orders || []);
    setDashboard(dashboardPayload);
  }

  async function refreshBooks() {
    const payload = await apiRequest('/books');
    setBooks(payload.books || []);
  }

  async function login(values) {
    const payload = await apiRequest('/auth/login', { method: 'POST', body: values });
    persistSession(payload.token, payload.user);
    await refreshAccountData(payload.token, payload.user.role);
    return payload.user;
  }

  async function register(values) {
    const payload = await apiRequest('/auth/register', { method: 'POST', body: values });
    persistSession(payload.token, payload.user);
    await refreshAccountData(payload.token, payload.user.role);
    return payload.user;
  }

  function logout() {
    localStorage.removeItem('bookbound-session');
    setSession({ token: null, user: null, ready: true });
    setWishlist([]);
    setCart([]);
    setOrders([]);
    setDashboard(null);
    setCartOpen(false);
  }

  async function toggleWishlist(book) {
    if (!session.token) {
      throw new Error('Please log in first.');
    }

    if (wishlistIds.has(book.id)) {
      await apiRequest(`/wishlist/${book.id}`, { method: 'DELETE', token: session.token });
    } else {
      await apiRequest(`/wishlist/${book.id}`, { method: 'POST', token: session.token });
    }

    await refreshAccountData();
  }

  async function addToCart(book) {
    if (!session.token) {
      throw new Error('Please log in first.');
    }
    await apiRequest('/cart', { method: 'POST', token: session.token, body: { bookId: book.id, quantity: 1 } });
    await refreshAccountData();
    setCartOpen(true);
  }

  async function updateCartQuantity(bookId, quantity) {
    if (!session.token) return;
    await apiRequest(`/cart/${bookId}`, { method: 'PUT', token: session.token, body: { quantity } });
    await refreshAccountData();
  }

  async function removeFromCart(bookId) {
    if (!session.token) return;
    await apiRequest(`/cart/${bookId}`, { method: 'DELETE', token: session.token });
    await refreshAccountData();
  }

  async function checkout(shipping) {
    if (!session.token) {
      throw new Error('Please log in to check out.');
    }

    if (!cart.length) {
      throw new Error('Your cart is empty.');
    }

    await apiRequest('/orders', {
      method: 'POST',
      token: session.token,
      body: {
        items: cart.map((item) => ({ bookId: item.id, quantity: item.quantity })),
        shipping
      }
    });

    setCart([]);
    setCartOpen(false);
    await refreshAccountData();
  }

  async function saveBook(values) {
    if (!session.token) {
      throw new Error('Please log in first.');
    }

    const method = values.id ? 'PUT' : 'POST';
    const endpoint = values.id ? `/books/${values.id}` : '/books';
    await apiRequest(endpoint, {
      method,
      token: session.token,
      body: values
    });

    await Promise.all([refreshBooks(), refreshAccountData()]);
  }

  async function deleteBook(bookId) {
    if (!session.token) {
      throw new Error('Please log in first.');
    }

    await apiRequest(`/books/${bookId}`, { method: 'DELETE', token: session.token });
    await Promise.all([refreshBooks(), refreshAccountData()]);
  }

  async function changeOrderStatus(orderId, status) {
    if (!session.token) {
      throw new Error('Please log in first.');
    }

    await apiRequest(`/orders/${orderId}/status`, {
      method: 'PATCH',
      token: session.token,
      body: { status }
    });

    await refreshAccountData();
  }

  async function removeUser(userId) {
    if (!session.token) {
      throw new Error('Please log in first.');
    }

    await apiRequest(`/admin/users/${userId}`, { method: 'DELETE', token: session.token });
    await refreshAccountData();
  }

  async function changeUserStatus(userId, status) {
    if (!session.token) {
      throw new Error('Please log in first.');
    }

    await apiRequest(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      token: session.token,
      body: { status }
    });
    await refreshAccountData();
  }

  const value = {
    session,
    books,
    visibleBooks,
    featuredBooks,
    genres,
    wishlist,
    wishlistIds,
    orders,
    dashboard,
    filters,
    setFilters,
    cart,
    cartCount,
    cartTotal,
    cartOpen,
    setCartOpen,
    message,
    setMessage,
    login,
    register,
    logout,
    toggleWishlist,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    checkout,
    saveBook,
    deleteBook,
    changeOrderStatus,
    removeUser,
    changeUserStatus,
    refreshBooks,
    colorFromBook,
    money,
    formatDate
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function useBookStore() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useBookStore must be used inside AppProvider.');
  }

  return context;
}

function Shell() {
  const { session, cartCount, setCartOpen, cartOpen, logout, message, setMessage } = useBookStore();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const isSeller = session.user?.role === 'seller';
  const isAdmin = session.user?.role === 'admin';

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brandMark">B</span>
          <span>
            <strong>BookNest</strong>
            <small>Readers, sellers, and curators in one place</small>
          </span>
        </Link>

        <nav className="topnav">
          {isAdmin ? (
            <>
              <Link to="/dashboard?tab=dashboard" className={location.pathname === '/dashboard' && activeTab === 'dashboard' ? 'active' : ''}>Dashboard</Link>
              <Link to="/dashboard?tab=users" className={location.pathname === '/dashboard' && activeTab === 'users' ? 'active' : ''}>Users</Link>
              <Link to="/dashboard?tab=sellers" className={location.pathname === '/dashboard' && activeTab === 'sellers' ? 'active' : ''}>Sellers</Link>
              <button className="navTabButton" onClick={logout}>Logout</button>
            </>
          ) : isSeller ? (
            <>
              <Link to="/dashboard?tab=dashboard" className={location.pathname === '/dashboard' && activeTab === 'dashboard' ? 'active' : ''}>Dashboard</Link>
              <Link to="/dashboard?tab=inventory" className={location.pathname === '/dashboard' && activeTab === 'inventory' ? 'active' : ''}>Inventory</Link>
              <Link to="/dashboard?tab=add-book" className={location.pathname === '/dashboard' && activeTab === 'add-book' ? 'active' : ''}>Add Book</Link>
              <Link to="/dashboard?tab=orders" className={location.pathname === '/dashboard' && activeTab === 'orders' ? 'active' : ''}>Orders</Link>
              <Link to="/dashboard?tab=profile" className={location.pathname === '/dashboard' && activeTab === 'profile' ? 'active' : ''}>Profile</Link>
              <button className="navTabButton" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <NavLink to="/" end>Home</NavLink>
              <NavLink to="/catalog">Books</NavLink>
              <NavLink to="/orders">My Orders</NavLink>
              {session.user && <NavLink to="/wishlist">Wishlist</NavLink>}
              <button className="navTabButton" onClick={() => setCartOpen(true)}>Cart {cartCount > 0 ? `(${cartCount})` : ''}</button>
              {session.user && <NavLink to="/dashboard">Profile</NavLink>}
              {session.user ? (
                <button className="navTabButton" onClick={logout}>Logout</button>
              ) : (
                <NavLink to="/login">Login</NavLink>
              )}
            </>
          )}
        </nav>
      </header>

      {message ? (
        <div className="systemBanner">
          <span>{message}</span>
          <button onClick={() => setMessage('')}>Dismiss</button>
        </div>
      ) : null}

      <main className="pageFrame">
        <Outlet />
      </main>

      <footer className="footer">
        <div>
          <strong>BookNest</strong>
          <p>Distinct, modern, and purpose-built for a bookstore project that needs its own identity.</p>
        </div>
        <div>
          <p>Local demo access</p>
          <code>{demoAccessNote}</code>
        </div>
      </footer>

      {cartOpen ? <CartDrawer /> : null}
    </div>
  );
}

function CartDrawer() {
  const { cart, cartCount, cartTotal, setCartOpen, updateCartQuantity, removeFromCart, checkout, session, money } = useBookStore();
  const navigate = useNavigate();
  const [shipping, setShipping] = useState(initialShipping);
  const [status, setStatus] = useState('');

  async function handleCheckout(event) {
    event.preventDefault();
    setStatus('');

    if (!session.user) {
      alert('Please log in to proceed with checkout.');
      setCartOpen(false);
      navigate('/login');
      return;
    }

    try {
      await checkout(shipping);
      setShipping(initialShipping);
      alert('Order successfully placed!');
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <aside className="cartDrawer">
      <div className="cartHeader">
        <h2>Basket</h2>
        <button className="ghostButton" onClick={() => setCartOpen(false)}>
          Close
        </button>
      </div>

      <div className="cartList">
        {cart.length ? (
          cart.map((item) => {
            const palette = colorFromBook(item);
            return (
              <article className="cartItem" key={item.id}>
                <div className="miniCoverImageContainer">
                  <img src={item.itemImage} alt={item.title} className="miniCoverImage" />
                </div>
                <div className="cartItemBody">
                  <strong>{item.title}</strong>
                  <span>{item.author}</span>
                  <div className="cartRow">
                    <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)}>+</button>
                    <button className="textButton" onClick={() => removeFromCart(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
                <strong>{money(item.price * item.quantity)}</strong>
              </article>
            );
          })
        ) : (
          <div className="emptyState compact">
            <p>Your basket is empty. Add a few books to continue.</p>
          </div>
        )}
      </div>

      <form className="checkoutForm" onSubmit={handleCheckout}>
        <div className="checkoutSummary">
          <span>{cartCount} item(s)</span>
          <strong>{money(cartTotal)}</strong>
        </div>
        <h3>Shipping</h3>
        <input
          value={shipping.name}
          onChange={(event) => setShipping({ ...shipping, name: event.target.value })}
          placeholder="Full name"
          required
        />
        <input
          value={shipping.address}
          onChange={(event) => setShipping({ ...shipping, address: event.target.value })}
          placeholder="Address"
          required
        />
        <div className="gridTwo">
          <input
            value={shipping.city}
            onChange={(event) => setShipping({ ...shipping, city: event.target.value })}
            placeholder="City"
            required
          />
          <input
            value={shipping.state}
            onChange={(event) => setShipping({ ...shipping, state: event.target.value })}
            placeholder="State"
            required
          />
        </div>
        <input
          value={shipping.pincode}
          onChange={(event) => setShipping({ ...shipping, pincode: event.target.value })}
          placeholder="Pincode"
          required
        />
        <button className="solidButton wide" type="submit" disabled={!cart.length}>
          Checkout
        </button>
        {status ? <p className="statusNote">{status}</p> : null}
      </form>
    </aside>
  );
}

function HeroBookStrip({ books }) {
  const { money } = useBookStore();

  return (
    <div className="heroStrip">
      {books.map((book) => {
        const palette = colorFromBook(book);
        return (
          <article className="heroCard" key={book.id} style={{ '--hero-a': palette.primary, '--hero-b': palette.secondary }}>
            <div className="heroCardCover">
              <img src={book.itemImage} alt={book.title} className="heroImage" />
            </div>
            <strong>{book.title}</strong>
            <p>{money(book.price)}</p>
          </article>
        );
      })}
    </div>
  );
}

function BookCard({ book }) {
  const { wishlistIds, toggleWishlist, addToCart, money } = useBookStore();
  const palette = colorFromBook(book);
  const wished = wishlistIds.has(book.id);

  return (
    <article className="bookCard">
      <div className="coverArtImageContainer">
        {book.badge && <span className="coverBadge">{book.badge}</span>}
        <img src={book.itemImage} alt={book.title} className="bookCoverImage" />
      </div>
      <div className="cardBody">
        <div className="cardMeta">
          <span>{book.genre}</span>
          <span>★ {Number(book.rating || 0).toFixed(1)}</span>
        </div>
        <h3>{book.title}</h3>
        <p>{book.description}</p>
        <div className="cardFooter">
          <strong>{money(book.price)}</strong>
          <div className="cardActions">
            <Link className="textButton" to={`/book/${book.id}`}>
              View
            </Link>
            <button className={wished ? 'solidButton muted' : 'solidButton'} onClick={() => toggleWishlist(book)}>
              {wished ? 'Saved' : 'Wishlist'}
            </button>
            <button className="solidButton subtle" onClick={() => addToCart(book)}>
              Add
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function HomePage() {
  const { featuredBooks, visibleBooks, books } = useBookStore();
  const navigate = useNavigate();

  return (
    <div className="homePage">
      <section className="heroPanel">
        <div className="heroCopy">
          <div className="eyebrow">Independent bookstore platform</div>
          <h1>Books, shelves, and checkout flow reimagined with a warmer editorial feel.</h1>
          <p>
            BookNest is a full-stack marketplace for readers, sellers, and admins. Explore curated titles, manage your
            inventory, place orders, and keep the entire journey visually distinct from a standard bookstore clone.
          </p>
          <div className="heroButtons">
            <button className="solidButton" onClick={() => navigate('/catalog')}>
              Explore catalog
            </button>
            <button className="ghostButton" onClick={() => navigate('/login')}>
              Open demo accounts
            </button>
          </div>
          <div className="heroStats">
            <div>
              <strong>{books.length}</strong>
              <span>Books live</span>
            </div>
            <div>
              <strong>3</strong>
              <span>Roles</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>Custom UI</span>
            </div>
          </div>
        </div>
        <div className="heroVisual">
          <div className="orb orbOne" />
          <div className="orb orbTwo" />
          <div className="glassPanel">
            <span>Today&apos;s featured reading</span>
            <h2>{featuredBooks[0]?.title || 'The Aurora Ledger'}</h2>
            <p>{featuredBooks[0]?.description || 'A stylized marketplace for books, not a mirrored reference project.'}</p>
          </div>
        </div>
      </section>

      <section className="sectionBlock">
        <div className="sectionHeading">
          <h2>Featured shelves</h2>
          <Link to="/catalog">Browse all</Link>
        </div>
        <HeroBookStrip books={featuredBooks.length ? featuredBooks : books.slice(0, 4)} />
      </section>

      <section className="sectionBlock splitGrid">
        <article className="infoCard">
          <h3>Why this build is different</h3>
          <p>
            Instead of copying the reference screenshots, this version uses a fresh visual language, generated cover art,
            and a layout centered on a modern storefront narrative.
          </p>
        </article>
        <article className="infoCard alt">
          <h3>What it supports</h3>
          <p>Authentication, browsing, searching, wishlist, cart, checkout, order tracking, inventory management, and admin controls.</p>
        </article>
      </section>
    </div>
  );
}

function CatalogPage() {
  const { filters, setFilters, genres, visibleBooks } = useBookStore();

  return (
    <div className="catalogPage">
      <div className="sectionHeading stacked">
        <h2>Catalog</h2>
        <p>Search, sort, and filter the library. Every card is based on its own generated cover palette.</p>
      </div>

      <section className="filterBar">
        <input
          value={filters.q}
          onChange={(event) => setFilters({ ...filters, q: event.target.value })}
          placeholder="Search title, author, or topic"
        />
        <select value={filters.genre} onChange={(event) => setFilters({ ...filters, genre: event.target.value })}>
          {genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
        <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
          <option value="featured">Featured first</option>
          <option value="rating">Top rated</option>
          <option value="price-asc">Price low to high</option>
          <option value="price-desc">Price high to low</option>
          <option value="newest">Newest first</option>
        </select>
        <input
          value={filters.minPrice}
          onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })}
          placeholder="Min price"
          type="number"
        />
        <input
          value={filters.maxPrice}
          onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })}
          placeholder="Max price"
          type="number"
        />
        <button className="ghostButton" onClick={() => setFilters(initialFilters)}>
          Reset
        </button>
      </section>

      <section className="bookGrid">
        {visibleBooks.length ? (
          visibleBooks.map((book) => <BookCard book={book} key={book.id} />)
        ) : (
          <div className="emptyState">
            <h3>No books matched your search.</h3>
            <p>Try a different keyword or reset the filters.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function BookPage() {
  const { id } = useParams();
  const { books, addToCart, toggleWishlist, wishlistIds, money, colorFromBook } = useBookStore();
  const [book, setBook] = useState(books.find((item) => item.id === id) || null);
  const wished = book ? wishlistIds.has(book.id) : false;

  useEffect(() => {
    let ignore = false;

    async function loadBook() {
      if (book) return;
      const response = await apiRequest(`/books/${id}`);
      if (!ignore) {
        setBook(response.book);
      }
    }

    loadBook().catch(() => {
      if (!ignore) {
        setBook(null);
      }
    });

    return () => {
      ignore = true;
    };
  }, [id, book]);

  if (!book) {
    return (
      <div className="emptyState">
        <h3>Book not found.</h3>
        <Link className="solidButton" to="/catalog">
          Back to catalog
        </Link>
      </div>
    );
  }

  const palette = colorFromBook(book);
  const related = books.filter((item) => item.genre === book.genre && item.id !== book.id).slice(0, 3);

  return (
    <div className="detailPage">
      <div className="detailHero">
        <div className="detailCoverImageContainer">
          <img src={book.itemImage} alt={book.title} className="bookDetailImage" />
        </div>
        <div className="detailCopy">
          <div className="eyebrow">{book.badge || 'Curated title'}</div>
          <h2>{book.title}</h2>
          <p>{book.description}</p>
          <div className="detailFacts">
            <span>{book.genre}</span>
            <span>★ {Number(book.rating).toFixed(1)}</span>
            <span>{book.sellerName}</span>
            <span>{book.stock} in stock</span>
          </div>
          <strong className="detailPrice">{money(book.price)}</strong>
          <div className="heroButtons">
            <button className="solidButton" onClick={() => addToCart(book)}>
              Add to basket
            </button>
            <button className={wished ? 'solidButton muted' : 'ghostButton'} onClick={() => toggleWishlist(book)}>
              {wished ? 'Saved to wishlist' : 'Save to wishlist'}
            </button>
          </div>
        </div>
      </div>

      <section className="splitGrid">
        <article className="infoCard">
          <h3>About this book</h3>
          <p>{book.description}</p>
          <p>
            Price is shown in INR, and the cover art is generated from the book palette so the product never relies on
            copied screenshots or external assets.
          </p>
        </article>
        <article className="infoCard alt">
          <h3>Details</h3>
          <ul className="detailList">
            <li>Author: {book.author}</li>
            <li>Genre: {book.genre}</li>
            <li>Seller: {book.sellerName}</li>
            <li>Rating: {Number(book.rating).toFixed(1)}</li>
            <li>Tags: {(book.tags || []).join(', ') || 'N/A'}</li>
          </ul>
        </article>
      </section>

      {related.length ? (
        <section className="sectionBlock">
          <div className="sectionHeading stacked">
            <h2>More in this lane</h2>
            <p>Related books from the same genre.</p>
          </div>
          <div className="bookGrid compactGrid">
            {related.map((item) => (
              <BookCard book={item} key={item.id} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AuthPage() {
  const { session, login, register } = useBookStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('user');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session.user) {
    return <Navigate to={session.user.role === 'user' ? '/catalog' : '/dashboard'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {

      const payload = {
        email: form.email,
        password: form.password,
        role
      };

      let loggedInUser;
      if (mode === 'register') {
        payload.name = form.name;
        loggedInUser = await register(payload);
      } else {
        loggedInUser = await login(payload);
      }

      if (loggedInUser && loggedInUser.role !== 'user') {
        navigate('/dashboard');
      } else {
        navigate('/catalog');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authPage">
      <section className="authCard">
        <div className="sectionHeading stacked">
          <h2>{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
          <p>Distinct login flow for user, seller, and admin roles.</p>
        </div>

        <div className="roleTabs">
          <button className={role === 'user' ? 'tab active' : 'tab'} onClick={() => setRole('user')}>
            User
          </button>
          <button className={role === 'seller' ? 'tab active' : 'tab'} onClick={() => setRole('seller')}>
            Seller
          </button>
          <button className={role === 'admin' ? 'tab active' : 'tab'} onClick={() => setRole('admin')}>
            Admin
          </button>
        </div>

        <form className="authForm" onSubmit={handleSubmit}>
          {mode === 'register' ? (
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          ) : null}
          <input
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
          <button className="solidButton wide" type="submit" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
          {error ? <p className="errorText">{error}</p> : null}
        </form>

        <div className="authSwitch">
          <span>{mode === 'login' ? 'Need a new account?' : 'Already have an account?'}</span>
          <button className="textButton" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Register' : 'Back to login'}
          </button>
        </div>
      </section>

      <aside className="authSide">
        <div className="infoCard">
          <h3>Local demo login</h3>
          <p>{demoAccessNote}</p>
        </div>
        <div className="infoCard alt">
          <h3>What happens next</h3>
          <p>User accounts browse and buy, sellers manage their own titles, and admins get system-level visibility.</p>
        </div>
      </aside>
    </div>
  );
}

function OrdersPage() {
  const { orders, session, changeOrderStatus, money, formatDate } = useBookStore();

  if (!session.user) {
    return <Navigate to="/login" replace />;
  }

  if (session.user.role === 'seller') {
    return <Navigate to="/dashboard?tab=orders" replace />;
  }

  return (
    <div className="ordersPage">
      <div className="sectionHeading stacked">
        <h2>Orders</h2>
        <p>{session.user.role === 'user' ? 'Your order history.' : 'Orders linked to your inventory.'}</p>
      </div>

      <div className="ordersStack">
        {orders.length ? (
          orders.map((order) => (
            <article className="orderCard" key={order.id}>
              <div className="orderHeader">
                <div>
                  <strong>{order.id}</strong>
                  <p>{session.user.role === 'user' ? order.buyerName : order.shipping.name}</p>
                </div>
                <span className={`statusTag ${order.status}`}>{order.status}</span>
              </div>
              <div className="orderMeta">
                <span>Placed: {formatDate(order.orderedAt)}</span>
                <span>Delivery: {formatDate(order.expectedDelivery)}</span>
                <span>Total: {money(order.total)}</span>
              </div>
              <div className="orderItems">
                {order.items.map((item) => (
                  <div className="orderItem" key={`${order.id}-${item.bookId}`}>
                    <strong>{item.title}</strong>
                    <span>x{item.quantity}</span>
                    <span>{money(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="orderFooter">
                <span>
                  Ship to: {order.shipping.city}, {order.shipping.state}
                </span>
                {session.user.role !== 'user' ? (
                  <select value={order.status} onChange={(event) => changeOrderStatus(order.id, event.target.value)}>
                    <option value="processing">processing</option>
                    <option value="packed">packed</option>
                    <option value="shipped">shipped</option>
                    <option value="delivered">delivered</option>
                  </select>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="emptyState">
            <h3>No orders yet.</h3>
            <p>Complete checkout to see your order history here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SellerGraphs() {
  return (
    <div className="sellerGraphsContainer">
      <article className="infoCard graphCard">
        <h3>Monthly Earnings</h3>
        <div className="chartWrapper">
          <svg viewBox="0 0 500 200" className="svgChart">
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <line x1="40" y1="20" x2="480" y2="20" stroke="var(--line)" strokeDasharray="4 4" />
            <line x1="40" y1="70" x2="480" y2="70" stroke="var(--line)" strokeDasharray="4 4" />
            <line x1="40" y1="120" x2="480" y2="120" stroke="var(--line)" strokeDasharray="4 4" />
            <line x1="40" y1="170" x2="480" y2="170" stroke="var(--line)" />

            <path
              d="M 40 170 C 100 130, 150 140, 200 90 C 250 40, 300 70, 350 50 C 400 30, 450 40, 480 20 L 480 170 Z"
              fill="url(#areaGradient)"
            />
            <path
              d="M 40 170 C 100 130, 150 140, 200 90 C 250 40, 300 70, 350 50 C 400 30, 450 40, 480 20"
              fill="none"
              stroke="var(--brand)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            <circle cx="200" cy="90" r="5" fill="var(--brand-strong)" stroke="#fff" strokeWidth="2" />
            <circle cx="350" cy="50" r="5" fill="var(--brand-strong)" stroke="#fff" strokeWidth="2" />
            <circle cx="480" cy="20" r="5" fill="var(--brand-strong)" stroke="#fff" strokeWidth="2" />

            <text x="40" y="190" fill="var(--muted)" fontSize="11" textAnchor="middle">Jan</text>
            <text x="128" y="190" fill="var(--muted)" fontSize="11" textAnchor="middle">Feb</text>
            <text x="216" y="190" fill="var(--muted)" fontSize="11" textAnchor="middle">Mar</text>
            <text x="304" y="190" fill="var(--muted)" fontSize="11" textAnchor="middle">Apr</text>
            <text x="392" y="190" fill="var(--muted)" fontSize="11" textAnchor="middle">May</text>
            <text x="480" y="190" fill="var(--muted)" fontSize="11" textAnchor="middle">Jun</text>
          </svg>
        </div>
      </article>

      <article className="infoCard graphCard">
        <h3>Orders by Genre</h3>
        <div className="chartWrapper">
          <svg viewBox="0 0 500 200" className="svgChart">
            <line x1="40" y1="20" x2="480" y2="20" stroke="var(--line)" strokeDasharray="4 4" />
            <line x1="40" y1="70" x2="480" y2="70" stroke="var(--line)" strokeDasharray="4 4" />
            <line x1="40" y1="120" x2="480" y2="120" stroke="var(--line)" strokeDasharray="4 4" />
            <line x1="40" y1="170" x2="480" y2="170" stroke="var(--line)" />

            <rect x="60" y="40" width="40" height="130" rx="6" fill="var(--rose)" />
            <text x="80" y="190" fill="var(--muted)" fontSize="11" textAnchor="middle">Self Help</text>

            <rect x="170" y="80" width="40" height="90" rx="6" fill="var(--leaf)" />
            <text x="190" y="190" fill="var(--muted)" fontSize="11" textAnchor="middle">Technology</text>

            <rect x="280" y="110" width="40" height="60" rx="6" fill="var(--gold)" />
            <text x="300" y="190" fill="var(--muted)" fontSize="11" textAnchor="middle">Finance</text>

            <rect x="390" y="60" width="40" height="110" rx="6" fill="var(--ink)" />
            <text x="410" y="190" fill="var(--muted)" fontSize="11" textAnchor="middle">Fiction</text>
          </svg>
        </div>
      </article>
    </div>
  );
}

function AdminRevenueChart({ orders, money }) {
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyRevenue = Array(12).fill(0);

  (orders || []).forEach((order) => {
    const date = new Date(order.orderedAt);
    if (!isNaN(date.getTime())) {
      monthlyRevenue[date.getMonth()] += Number(order.total || 0);
    }
  });

  const maxRevenue = Math.max(...monthlyRevenue, 1);
  const chartHeight = 160;
  const barWidth = 32;
  const gap = 10;
  const startX = 50;
  const colors = ['var(--rose)', 'var(--leaf)', 'var(--gold)', 'var(--ink)', 'var(--brand)', 'var(--brand-soft)',
    'var(--rose)', 'var(--leaf)', 'var(--gold)', 'var(--ink)', 'var(--brand)', 'var(--brand-soft)'];

  const activeMonths = monthlyRevenue.map((val, i) => ({ val, i })).filter(m => m.val > 0);
  const displayMonths = activeMonths.length > 0 ? monthlyRevenue.map((v, i) => i).slice(0, Math.max(activeMonths[activeMonths.length - 1].i + 1, 6)) : [0, 1, 2, 3, 4, 5];

  const totalWidth = startX + displayMonths.length * (barWidth + gap) + 20;

  return (
    <article className="infoCard graphCard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Platform Revenue Trend</h3>
      </div>
      <div className="chartWrapper">
        <svg viewBox={`0 0 ${totalWidth} 210`} className="svgChart">
          <line x1={startX} y1="20" x2={totalWidth - 20} y2="20" stroke="var(--line)" strokeDasharray="4 4" />
          <line x1={startX} y1="70" x2={totalWidth - 20} y2="70" stroke="var(--line)" strokeDasharray="4 4" />
          <line x1={startX} y1="120" x2={totalWidth - 20} y2="120" stroke="var(--line)" strokeDasharray="4 4" />
          <line x1={startX} y1="180" x2={totalWidth - 20} y2="180" stroke="var(--line)" />

          <text x="5" y="24" fill="var(--muted)" fontSize="10">{money(maxRevenue)}</text>
          <text x="5" y="74" fill="var(--muted)" fontSize="10">{money(maxRevenue * 0.66)}</text>
          <text x="5" y="124" fill="var(--muted)" fontSize="10">{money(maxRevenue * 0.33)}</text>
          <text x="5" y="184" fill="var(--muted)" fontSize="10">₹0</text>

          {displayMonths.map((monthIdx, i) => {
            const val = monthlyRevenue[monthIdx];
            const barHeight = Math.max((val / maxRevenue) * chartHeight, 2);
            const x = startX + i * (barWidth + gap);
            const y = 180 - barHeight;
            return (
              <g key={monthIdx}>
                <rect x={x} y={y} width={barWidth} height={barHeight} rx="6" fill={colors[monthIdx % colors.length]} opacity={val > 0 ? 0.9 : 0.2} />
                <text x={x + barWidth / 2} y="196" fill="var(--muted)" fontSize="10" textAnchor="middle">{monthLabels[monthIdx]}</text>
                {val > 0 && (
                  <text x={x + barWidth / 2} y={y - 5} fill="var(--text)" fontSize="9" textAnchor="middle" fontWeight="600">{money(val)}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </article>
  );
}

function AdminDashboardView({ activeTab, dashboard, adminUsers, adminSellers, allOrders, books, removeUser, changeUserStatus, changeOrderStatus, money, formatDate, session }) {
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [sellerSearch, setSellerSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');
  const [viewingOrdersFor, setViewingOrdersFor] = useState(null);
  const [viewingBooksFor, setViewingBooksFor] = useState(null);

  const summary = dashboard?.summary || {};
  const recentOrders = dashboard?.recentOrders || [];

  const filteredUsers = adminUsers.filter(u => {
    const matchSearch = !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase());
    if (userFilter === 'all') return matchSearch;
    if (userFilter === 'active') return matchSearch && u.status === 'approved';
    return matchSearch;
  });

  const filteredSellers = adminSellers.filter(s => {
    return !sellerSearch || s.name.toLowerCase().includes(sellerSearch.toLowerCase()) || s.email.toLowerCase().includes(sellerSearch.toLowerCase());
  });

  const filteredOrders = allOrders.filter(order => {
    if (orderFilter === 'all') return true;
    return order.status === orderFilter;
  });

  const pendingSellerCount = adminSellers.filter(s => s.status === 'pending').length;

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="dashboardPage adminDashboard">
      <div className="adminPageHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div className="sectionHeading stacked" style={{ marginBottom: 0 }}>
          {activeTab === 'dashboard' && (
            <>
              <h2>Platform Overview</h2>
              <p style={{ color: 'var(--muted)', margin: '0.3rem 0 0' }}>{currentDate}</p>
            </>
          )}
          {activeTab === 'users' && (
            <>
              <h2>Account Management</h2>
              <p style={{ color: 'var(--muted)', margin: '0.3rem 0 0' }}>View and manage registered reader accounts</p>
            </>
          )}
          {activeTab === 'sellers' && (
            <>
              <h2>Seller Management</h2>
              <p style={{ color: 'var(--muted)', margin: '0.3rem 0 0' }}>Moderate and view registered seller storefronts</p>
            </>
          )}
        </div>

        <div className="adminUserBadge" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div className="avatarCircle" style={{ width: '40px', height: '40px', fontSize: '1rem', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand), var(--rose))', color: '#fff', fontWeight: 'bold', display: 'grid', placeItems: 'center' }}>
            {session.user.name.charAt(0).toUpperCase()}{session.user.name.split(' ')[1]?.charAt(0).toUpperCase() || ''}
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: '0.95rem' }}>{session.user.name}</strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--brand)', fontWeight: 600, textTransform: 'uppercase' }}>Admin</span>
          </div>
        </div>
      </div>

      {/* ======================== DASHBOARD TAB ======================== */}
      {activeTab === 'dashboard' && (
        <div className="tabContent adminDashboardTab">
          <div className="statsRow">
            <StatTile title="Total Readers" value={summary.users ?? 0} tone="rose" />
            <StatTile title="Active Sellers" value={summary.approvedSellers ?? summary.sellers ?? 0} tone="leaf" />
            <StatTile title="Books Listed" value={summary.books ?? 0} tone="gold" />
            <StatTile title="Total Orders" value={summary.orders ?? 0} tone="ink" />
          </div>

          <div className="sellerGraphsContainer" style={{ margin: '1.5rem 0' }}>
            <AdminRevenueChart orders={allOrders} money={money} />

            <article className="infoCard graphCard">
              <h3>Pending Actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0', borderBottom: '1px solid var(--line)' }}>
                  <span>Seller Approvals</span>
                  <span className="statusTag" style={{ background: pendingSellerCount > 0 ? 'rgba(142, 52, 40, 0.12)' : 'rgba(95, 127, 54, 0.12)', color: pendingSellerCount > 0 ? '#8e3428' : '#48612a', fontWeight: 700, fontSize: '0.9rem', minWidth: '28px', textAlign: 'center' }}>{pendingSellerCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0', borderBottom: '1px solid var(--line)' }}>
                  <span>Active Wishlists</span>
                  <span className="statusTag" style={{ background: 'rgba(196, 149, 83, 0.12)', color: '#7c5f2b', fontWeight: 700, fontSize: '0.9rem', minWidth: '28px', textAlign: 'center' }}>{summary.wishlistItems ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0', borderBottom: '1px solid var(--line)' }}>
                  <span>Platform Revenue</span>
                  <strong style={{ color: 'var(--brand-strong)' }}>{money(summary.totalRevenue ?? 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0', borderBottom: '1px solid var(--line)' }}>
                  <span>Avg. Book Rating</span>
                  <strong>★ {summary.avgBookRating ?? '0.0'} / 5.0</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0' }}>
                  <span>Platform Status</span>
                  <span className="statusTag successText" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Operational</span>
                </div>
              </div>
            </article>
          </div>

          <article className="infoCard" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.7rem' }}>
              <h3 style={{ margin: 0 }}>Orders Overview</h3>
              <div className="roleTabs" style={{ marginBottom: 0 }}>
                {['all', 'processing', 'packed', 'shipped', 'delivered'].map(status => (
                  <button
                    key={status}
                    className={orderFilter === status ? 'tab active' : 'tab'}
                    onClick={() => setOrderFilter(status)}
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
                  >
                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="tableList">
              <div className="tableRow" style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr 1fr 0.8fr 0.7fr 0.7fr', alignItems: 'center', gap: '0.8rem', fontWeight: 700, fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--line)' }}>
                <span>Order ID</span>
                <span>Book / Item</span>
                <span>Buyer</span>
                <span>Seller</span>
                <span>Amount</span>
                <span>Status</span>
              </div>
              {filteredOrders.length ? (
                filteredOrders.slice(0, 15).map((order) => (
                  <div className="tableRow" key={order.id} style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr 1fr 0.8fr 0.7fr 0.7fr', alignItems: 'center', gap: '0.8rem', padding: '0.65rem 0', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>#{order.id?.slice(-6)}</span>
                    <span>{order.items?.map(i => i.title).join(', ') || 'N/A'}</span>
                    <span>{order.buyerName}</span>
                    <span>{order.items?.[0]?.sellerName || 'N/A'}</span>
                    <strong>{money(order.total)}</strong>
                    <span className={`statusTag ${order.status}`} style={{ fontSize: '0.78rem', textAlign: 'center' }}>{order.status}</span>
                  </div>
                ))
              ) : (
                <p style={{ padding: '1rem 0', textAlign: 'center', color: 'var(--muted)' }}>No orders match the selected filter.</p>
              )}
            </div>
          </article>
        </div>
      )}

      {/* ======================== USERS TAB ======================== */}
      {activeTab === 'users' && (
        <div className="tabContent adminUsersTab">
          <div className="statsRow" style={{ marginBottom: '1.5rem' }}>
            <StatTile title="Total Users" value={adminUsers.length} tone="rose" />
            <StatTile title="Active This Month" value={adminUsers.filter(u => {
              if (!u.createdAt) return true;
              const created = new Date(u.createdAt);
              const now = new Date();
              return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
            }).length} tone="leaf" />
            <StatTile title="With Wishlists" value={adminUsers.filter(u => u.wishlist?.length > 0).length} tone="gold" />
            <StatTile title="Suspended" value={adminUsers.filter(u => u.status === 'suspended').length} tone="ink" />
          </div>

          <article className="infoCard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.7rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
                <input
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{ maxWidth: '350px', borderRadius: '16px', border: '1px solid var(--line)', padding: '0.7rem 1rem', background: 'rgba(255,255,255,0.75)' }}
                />
                <div className="roleTabs" style={{ marginBottom: 0 }}>
                  {['all', 'active'].map(f => (
                    <button
                      key={f}
                      className={userFilter === f ? 'tab active' : 'tab'}
                      onClick={() => setUserFilter(f)}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
                    >
                      {f === 'all' ? 'All' : 'Active'}
                    </button>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="tableList">
              <div className="tableRow" style={{ display: 'grid', gridTemplateColumns: '0.3fr 1.5fr 1.3fr 0.7fr 0.8fr 1fr', alignItems: 'center', gap: '0.8rem', fontWeight: 700, fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--line)', padding: '0.5rem 0' }}>
                <span>#</span>
                <span>Reader</span>
                <span>Email</span>
                <span>Role</span>
                <span>Date Joined</span>
                <span>Actions</span>
              </div>
              {filteredUsers.length ? (
                filteredUsers.map((user, index) => (
                  <div className="tableRow" key={user.id} style={{ display: 'grid', gridTemplateColumns: '0.3fr 1.5fr 1.3fr 0.7fr 0.8fr 1fr', alignItems: 'center', gap: '0.8rem', padding: '0.7rem 0', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--muted)' }}>{index + 1}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-soft), var(--gold))', color: '#5f2e0e', fontWeight: 700, display: 'grid', placeItems: 'center', fontSize: '0.85rem', flexShrink: 0 }}>
                        {user.name.charAt(0).toUpperCase()}{user.name.split(' ')[1]?.charAt(0).toUpperCase() || ''}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.92rem' }}>{user.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>#{user.id.slice(-6).toUpperCase()}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.88rem' }}>{user.email}</span>
                    <span className="statusTag" style={{ background: 'rgba(53, 67, 95, 0.1)', color: '#35435f', fontSize: '0.78rem', fontWeight: 600, justifySelf: 'start' }}>Customer</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{user.createdAt ? formatDate(user.createdAt) : '—'}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button className="ghostButton" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', borderRadius: '10px' }} onClick={() => setViewingOrdersFor(viewingOrdersFor === user.id ? null : user.id)}>
                        👁 Orders
                      </button>
                      <button className="textButton danger" style={{ fontSize: '0.82rem' }} onClick={() => {
                        if (window.confirm(`Remove "${user.name}" from the platform?`)) {
                          removeUser(user.id);
                        }
                      }}>🗑</button>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--muted)' }}>No users match your search.</p>
              )}
            </div>

            {viewingOrdersFor && (
              <div style={{ marginTop: '1.5rem', padding: '1.2rem', background: 'rgba(241, 232, 215, 0.6)', borderRadius: '18px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Orders for {adminUsers.find(u => u.id === viewingOrdersFor)?.name || 'User'}</h3>
                  <button className="ghostButton" onClick={() => setViewingOrdersFor(null)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Close</button>
                </div>
                <div className="tableList">
                  {allOrders.filter(o => o.buyerId === viewingOrdersFor).length ? (
                    allOrders.filter(o => o.buyerId === viewingOrdersFor).map((order) => (
                      <div className="tableRow" key={order.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 0.7fr 0.7fr', alignItems: 'center', gap: '0.7rem', fontSize: '0.88rem' }}>
                        <strong>#{order.id.slice(-6)}</strong>
                        <span>{order.items?.map(i => i.title).join(', ')}</span>
                        <strong>{money(order.total)}</strong>
                        <span className={`statusTag ${order.status}`} style={{ fontSize: '0.78rem' }}>{order.status}</span>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--muted)', padding: '0.5rem 0' }}>This user has no orders.</p>
                  )}
                </div>
              </div>
            )}
          </article>
        </div>
      )}

      {/* ======================== SELLERS TAB ======================== */}
      {activeTab === 'sellers' && (
        <div className="tabContent adminSellersTab">
          <article className="infoCard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.7rem' }}>
              <input
                placeholder="Search by store or email..."
                value={sellerSearch}
                onChange={(e) => setSellerSearch(e.target.value)}
                style={{ maxWidth: '380px', borderRadius: '16px', border: '1px solid var(--line)', padding: '0.7rem 1rem', background: 'rgba(255,255,255,0.75)' }}
              />
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{filteredSellers.length} seller{filteredSellers.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="tableList">
              <div className="tableRow" style={{ display: 'grid', gridTemplateColumns: '0.3fr 1.5fr 1.3fr 0.7fr 1.5fr', alignItems: 'center', gap: '0.8rem', fontWeight: 700, fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--line)', padding: '0.5rem 0' }}>
                <span>#</span>
                <span>Store / Seller Name</span>
                <span>Email</span>
                <span>Status</span>
                <span>Operations</span>
              </div>
              {filteredSellers.length ? (
                filteredSellers.map((seller, index) => {
                  const sellerBookCount = books.filter(b => b.sellerId === seller.id).length;
                  const sellerStatus = seller.status || 'approved';
                  const statusColors = {
                    approved: { bg: 'rgba(95, 127, 54, 0.12)', color: '#48612a' },
                    pending: { bg: 'rgba(196, 149, 83, 0.15)', color: '#7c5f2b' },
                    suspended: { bg: 'rgba(142, 52, 40, 0.12)', color: '#8e3428' }
                  };
                  const statusStyle = statusColors[sellerStatus] || statusColors.approved;

                  return (
                    <div className="tableRow" key={seller.id} style={{ display: 'grid', gridTemplateColumns: '0.3fr 1.5fr 1.3fr 0.7fr 1.5fr', alignItems: 'center', gap: '0.8rem', padding: '0.7rem 0', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--muted)' }}>{index + 1}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--leaf), var(--ink))', color: '#fff', fontWeight: 700, display: 'grid', placeItems: 'center', fontSize: '0.85rem', flexShrink: 0 }}>
                          {seller.name.charAt(0).toUpperCase()}{seller.name.split(' ')[1]?.charAt(0).toUpperCase() || ''}
                        </div>
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.92rem' }}>{seller.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>#{seller.id.slice(-6).toUpperCase()}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.88rem' }}>{seller.email}</span>
                      <span className="statusTag" style={{ background: statusStyle.bg, color: statusStyle.color, fontSize: '0.78rem', fontWeight: 600, justifySelf: 'start' }}>
                        {sellerStatus.charAt(0).toUpperCase() + sellerStatus.slice(1)}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {sellerStatus === 'approved' ? (
                          <button
                            className="ghostButton"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', borderRadius: '10px', color: '#7c5f2b', borderColor: 'rgba(196, 149, 83, 0.35)' }}
                            onClick={() => {
                              if (window.confirm(`Suspend seller "${seller.name}"?`)) {
                                changeUserStatus(seller.id, 'suspended');
                              }
                            }}
                          >Suspend</button>
                        ) : (
                          <button
                            className="solidButton"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', borderRadius: '10px' }}
                            onClick={() => changeUserStatus(seller.id, 'approved')}
                          >Approve</button>
                        )}
                        <button className="ghostButton" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', borderRadius: '10px' }} onClick={() => setViewingBooksFor(viewingBooksFor === seller.id ? null : seller.id)}>
                          👁 View Books
                        </button>
                        <button className="textButton danger" style={{ fontSize: '0.82rem' }} onClick={() => {
                          if (window.confirm(`Remove seller "${seller.name}" and deactivate their listings?`)) {
                            removeUser(seller.id);
                          }
                        }}>🗑</button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--muted)' }}>No sellers match your search.</p>
              )}
            </div>

            {viewingBooksFor && (
              <div style={{ marginTop: '1.5rem', padding: '1.2rem', background: 'rgba(241, 232, 215, 0.6)', borderRadius: '18px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Books by {adminSellers.find(s => s.id === viewingBooksFor)?.name || 'Seller'}</h3>
                  <button className="ghostButton" onClick={() => setViewingBooksFor(null)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Close</button>
                </div>
                <div className="tableList">
                  {books.filter(b => b.sellerId === viewingBooksFor).length ? (
                    books.filter(b => b.sellerId === viewingBooksFor).map((book) => (
                      <div className="tableRow" key={book.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 0.6fr 0.5fr 0.6fr', alignItems: 'center', gap: '0.7rem', fontSize: '0.88rem' }}>
                        <div style={{ width: '35px', height: '48px', borderRadius: '8px', overflow: 'hidden' }}>
                          <img src={book.itemImage || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=400'} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <strong>{book.title}</strong>
                        <span>{book.genre}</span>
                        <span>{money(book.price)}</span>
                        <span className={book.stock <= 0 ? 'statusTag errorText' : 'statusTag successText'} style={{ fontSize: '0.78rem' }}>{book.stock} in stock</span>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--muted)', padding: '0.5rem 0' }}>This seller has no listed books.</p>
                  )}
                </div>
              </div>
            )}
          </article>
        </div>
      )}
    </div>
  );
}



function DashboardPage() {
  const { session, books, orders, dashboard, wishlist, saveBook, deleteBook, removeUser, changeUserStatus, changeOrderStatus, money, formatDate } = useBookStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';

  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState({
    title: '',
    author: '',
    genre: '',
    price: '',
    rating: '4.6',
    stock: '10',
    badge: 'Fresh Pick',
    description: '',
    itemImage: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!session.user) {
    return <Navigate to="/login" replace />;
  }

  const myBooks = books.filter((book) => book.sellerId === session.user.id);
  const myWishlist = wishlist;

  // Real revenue calculated only from seller's items in the orders
  const totalRevenue = orders.reduce((sum, order) => {
    const sellerItemsTotal = order.items
      .filter(item => String(item.sellerId) === String(session.user.id))
      .reduce((itemSum, item) => itemSum + (Number(item.price) * item.quantity), 0);
    return sum + sellerItemsTotal;
  }, 0);

  const currentStats = {
    books: myBooks.length,
    orders: orders.length,
    wishlist: myWishlist.length,
    revenue: totalRevenue,
    activeListings: myBooks.filter(book => Number(book.stock || 0) > 0).length
  };

  function beginEdit(book) {
    setEditingId(book.id);
    setForm({
      title: book.title,
      author: book.author,
      genre: book.genre,
      price: String(book.price),
      rating: String(book.rating),
      stock: String(book.stock),
      badge: book.badge || '',
      description: book.description,
      itemImage: book.itemImage || ''
    });
    setSearchParams({ tab: 'add-book' });
  }

  function resetForm() {
    setEditingId('');
    setForm({
      title: '',
      author: '',
      genre: '',
      price: '',
      rating: '4.6',
      stock: '10',
      badge: 'Fresh Pick',
      description: '',
      itemImage: ''
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await saveBook({
        id: editingId,
        title: form.title,
        author: form.author,
        genre: form.genre,
        price: form.price,
        rating: form.rating,
        stock: form.stock,
        badge: form.badge,
        description: form.description,
        itemImage: form.itemImage
      });
      resetForm();
      setSearchParams({ tab: 'inventory' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (session.user.role === 'admin') {
    const allUsers = dashboard?.users || [];
    const adminUsers = allUsers.filter(u => u.role === 'user');
    const adminSellers = allUsers.filter(u => u.role === 'seller');
    const allOrders = dashboard?.allOrders || [];

    return (
      <AdminDashboardView
        activeTab={activeTab}
        dashboard={dashboard}
        adminUsers={adminUsers}
        adminSellers={adminSellers}
        allOrders={allOrders}
        books={books}
        removeUser={removeUser}
        changeUserStatus={changeUserStatus}
        changeOrderStatus={changeOrderStatus}
        money={money}
        formatDate={formatDate}
        session={session}
      />
    );
  }

  // --- SELLER ROLE VIEW ---
  if (session.user.role === 'seller') {
    return (
      <div className="dashboardPage sellerPortal">
        <div className="sectionHeading stacked">
          <h2>Seller Workspace</h2>
          <p>Manage listings, track revenue, and fulfill orders in your seller studio.</p>
        </div>

        {activeTab === 'dashboard' && (
          <div className="tabContent dashboardTab">
            <div className="statsRow">
              <StatTile title="Total Books" value={currentStats.books} tone="rose" />
              <StatTile title="Total Orders" value={currentStats.orders} tone="leaf" />
              <StatTile title="Active Listings" value={currentStats.activeListings} tone="gold" />
              <StatTile title="Total Revenue" value={money(currentStats.revenue)} tone="ink" />
            </div>

            <SellerGraphs />

            <article className="infoCard recentOrdersCard">
              <h3>Recent Sales Orders</h3>
              <div className="miniFeed">
                {orders.length ? (
                  orders.slice(0, 5).map((order) => (
                    <div className="miniFeedRow stacked" key={order.id}>
                      <div className="orderRowHeader" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <strong>{order.id}</strong>
                        <span className={`statusTag ${order.status}`}>{order.status}</span>
                      </div>
                      <div className="orderRowDetails" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.9rem', opacity: 0.85 }}>
                        <span>Customer: {order.buyerName} ({order.buyerEmail})</span>
                        <span>Books: {order.items.map((item) => `${item.title} (x${item.quantity})`).join(', ')}</span>
                        <span>Date: {formatDate(order.orderedAt)}</span>
                        <strong>{money(order.items.reduce((sum, it) => sum + it.price * it.quantity, 0))}</strong>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No recent orders found.</p>
                )}
              </div>
            </article>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="tabContent inventoryTab">
            <article className="infoCard adminInventory">
              <div className="inventoryHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3>My Books Inventory</h3>
                <button className="solidButton" onClick={() => setSearchParams({ tab: 'add-book' })}>Add New Title</button>
              </div>
              <div className="tableList">
                {myBooks.length ? (
                  myBooks.map((book) => (
                    <div className="tableRow bookRow" key={book.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr 0.6fr 0.8fr auto', alignItems: 'center', gap: '1rem' }}>
                      <div className="inventoryBookInfo" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <div className="miniCoverImageContainer" style={{ width: '40px', height: '55px', borderRadius: '8px', overflow: 'hidden' }}>
                          <img src={book.itemImage || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=400'} alt={book.title} className="miniCoverImage" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <span style={{ fontWeight: 600 }}>{book.title}</span>
                      </div>
                      <span>{book.author}</span>
                      <span>{book.genre}</span>
                      <span>{money(book.price)}</span>
                      <span className={book.stock <= 0 ? 'statusTag errorText' : book.stock <= 5 ? 'statusTag warningText' : 'statusTag successText'} style={{ padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center' }}>
                        {book.stock} in stock
                      </span>
                      <div className="rowActions" style={{ display: 'flex', gap: '0.6rem' }}>
                        <button className="textButton" onClick={() => beginEdit(book)}>
                          Edit
                        </button>
                        <button className="textButton danger" onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${book.title}"?`)) {
                            deleteBook(book.id);
                          }
                        }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="emptyState">
                    <h3>Your inventory is empty.</h3>
                    <p>Click "Add New Title" above to list your first book.</p>
                  </div>
                )}
              </div>
            </article>
          </div>
        )}

        {activeTab === 'add-book' && (
          <div className="tabContent addBookTab">
            <article className="infoCard addEditBookCard">
              <div className="addBookLayout" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                <div>
                  <h3>{editingId ? 'Edit Book Details' : 'Publish a New Title'}</h3>
                  <form className="inventoryForm" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    <input placeholder="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
                    <input placeholder="Author" value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} required />
                    <div className="gridTwo">
                      <input placeholder="Genre" value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })} required />
                      <input placeholder="Price" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
                    </div>
                    <div className="gridTwo">
                      <input placeholder="Rating" type="number" step="0.1" value={form.rating} onChange={(event) => setForm({ ...form, rating: event.target.value })} />
                      <input placeholder="Stock" type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
                    </div>
                    <input placeholder="Badge (e.g. Bestseller, Fresh Pick)" value={form.badge} onChange={(event) => setForm({ ...form, badge: event.target.value })} />
                    
                    <div className="imageUploadSection" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px dashed var(--line)', padding: '1rem', borderRadius: '16px', background: 'rgba(255,255,255,0.4)' }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Book Cover Photo</label>
                      <div className="fileInputWrapper" style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setForm(prev => ({ ...prev, itemImage: reader.result }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }} 
                          style={{ fontSize: '100px', position: 'absolute', left: 0, top: 0, opacity: 0, cursor: 'pointer' }}
                        />
                        <button type="button" className="solidButton subtle" style={{ width: '100%' }}>Choose Local File</button>
                      </div>
                      <input placeholder="Or enter external cover Image URL" value={form.itemImage} onChange={(event) => setForm({ ...form, itemImage: event.target.value })} />
                    </div>

                    <textarea placeholder="Description" rows="5" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
                    <div className="heroButtons">
                      <button className="solidButton" type="submit" disabled={busy}>
                        {editingId ? 'Update Book' : 'Publish Book'}
                      </button>
                      <button className="ghostButton" type="button" onClick={() => { resetForm(); setSearchParams({ tab: 'inventory' }); }}>
                        Cancel
                      </button>
                    </div>
                    {error ? <p className="errorText">{error}</p> : null}
                  </form>
                </div>

                <div className="bookPreviewContainer" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, alignSelf: 'flex-start' }}>Live Cover Preview</h4>
                  <div className="bookCard" style={{ width: '280px', pointerEvents: 'none', boxShadow: 'var(--shadow)' }}>
                    <div className="coverArtImageContainer" style={{ height: '320px' }}>
                      {form.badge && <span className="coverBadge">{form.badge}</span>}
                      <img 
                        src={form.itemImage || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=400'} 
                        alt="Preview" 
                        className="bookCoverImage" 
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=400';
                        }} 
                      />
                    </div>
                    <div className="cardBody">
                      <div className="cardMeta" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted)' }}>
                        <span>{form.genre || 'Genre'}</span>
                        <span>★ {Number(form.rating || 4.6).toFixed(1)}</span>
                      </div>
                      <h3 style={{ fontSize: '1.1rem', margin: '0.4rem 0' }}>{form.title || 'Untitled Book'}</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', minHeight: '3.4rem', margin: 0 }}>
                        {form.description ? (form.description.slice(0, 80) + (form.description.length > 80 ? '...' : '')) : 'Book description preview...'}
                      </p>
                      <div className="cardFooter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem' }}>
                        <strong style={{ fontSize: '1.1rem' }}>{money(form.price || 0)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="tabContent ordersTab">
            <article className="infoCard sellerOrdersCard">
              <div className="inventoryHeader" style={{ marginBottom: '1.5rem' }}>
                <h3>Customer Orders</h3>
                <p style={{ color: 'var(--muted)', margin: 0 }}>Fulfill and update shipping status for orders linked to your book inventory.</p>
              </div>
              <div className="ordersStack" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {orders.length ? (
                  orders.map((order) => (
                    <div className="orderCard" key={order.id} style={{ border: '1px solid var(--line)', padding: '1.4rem', borderRadius: '20px', background: 'var(--panel-strong)' }}>
                      <div className="orderHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '0.8rem', marginBottom: '0.8rem' }}>
                        <div>
                          <strong style={{ fontSize: '1.1rem' }}>{order.id}</strong>
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', color: 'var(--muted)' }}>Buyer: {order.buyerName} ({order.buyerEmail})</p>
                        </div>
                        <span className={`statusTag ${order.status}`} style={{ fontWeight: 600, padding: '0.3rem 0.75rem', borderRadius: '12px' }}>{order.status}</span>
                      </div>
                      <div className="orderMeta" style={{ display: 'flex', gap: '1.5rem', color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.8rem' }}>
                        <span>Ordered: {formatDate(order.orderedAt)}</span>
                        <span>Delivery: {formatDate(order.expectedDelivery)}</span>
                        <span>Earnings Share: <strong>{money(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</strong></span>
                      </div>
                      <div className="orderItems" style={{ background: 'rgba(0,0,0,0.03)', padding: '0.8rem 1.2rem', borderRadius: '12px', marginBottom: '0.8rem' }}>
                        {order.items.map((item) => (
                          <div className="orderItem" key={`${order.id}-${item.bookId}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.95rem' }}>
                            <span><strong>{item.title}</strong> by {item.author}</span>
                            <span>x{item.quantity} ({money(item.price * item.quantity)})</span>
                          </div>
                        ))}
                      </div>
                      <div className="orderFooter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.8rem', borderTop: '1px solid var(--line)' }}>
                        <span style={{ fontSize: '0.9rem', maxWidth: '60%' }}>Ship To: <strong>{order.shipping.name}</strong>, {order.shipping.address}, {order.shipping.city}, {order.shipping.state} - {order.shipping.pincode}</span>
                        <div className="statusUpdateWrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Fulfillment Status:</span>
                          <select 
                            value={order.status} 
                            onChange={(event) => changeOrderStatus(order.id, event.target.value)}
                            style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid var(--line)', background: '#fff' }}
                          >
                            <option value="processing">processing</option>
                            <option value="packed">packed</option>
                            <option value="shipped">shipped</option>
                            <option value="delivered">delivered</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="emptyState">
                    <h3>No customer orders yet.</h3>
                    <p>Orders containing your listed books will display here.</p>
                  </div>
                )}
              </div>
            </article>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="tabContent profileTab">
            <article className="infoCard sellerProfileCard" style={{ padding: '2rem' }}>
              <div className="profileHeader" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="avatarCircle" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand), var(--rose))', color: '#fff', fontSize: '2.2rem', fontWeight: 'bold', display: 'grid', placeItems: 'center' }}>
                  {session.user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ margin: 0 }}>{session.user.name}</h2>
                  <span className="roleChip" style={{ background: 'var(--brand)', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-block', marginTop: '0.3rem' }}>
                    Seller Account
                  </span>
                </div>
              </div>
              
              <div className="profileDetailsGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--line)', paddingBottom: '2rem' }}>
                <div className="profileField" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Account ID</label>
                  <strong style={{ fontSize: '1.05rem', wordBreak: 'break-all' }}>{session.user.id}</strong>
                </div>
                <div className="profileField" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address</label>
                  <strong style={{ fontSize: '1.05rem' }}>{session.user.email}</strong>
                </div>
                <div className="profileField" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Registered Store</label>
                  <strong style={{ fontSize: '1.05rem' }}>{session.user.name}&apos;s Store</strong>
                </div>
              </div>

              <div className="profileStatsSection">
                <h3 style={{ marginBottom: '1.2rem' }}>Store Performance Summary</h3>
                <div className="statsRow">
                  <StatTile title="Total Books Listed" value={currentStats.books} tone="rose" />
                  <StatTile title="Total Orders Filled" value={currentStats.orders} tone="leaf" />
                  <StatTile title="Total Earnings" value={money(currentStats.revenue)} tone="ink" />
                </div>
              </div>
            </article>
          </div>
        )}
      </div>
    );
  }

  // --- READER/USER ROLE VIEW ---
  return (
    <div className="dashboardPage">
      <div className="sectionHeading stacked">
        <h2>{session.user.role === 'seller' ? 'Seller studio' : 'Reader profile'}</h2>
        <p>
          {session.user.role === 'seller'
            ? 'Create, edit, and ship books from a dedicated seller workspace.'
            : 'Track saved books and recent orders in one place.'}
        </p>
      </div>

      <div className="statsRow">
        <StatTile title="Books" value={currentStats.books} tone="rose" />
        <StatTile title="Orders" value={currentStats.orders} tone="leaf" />
        <StatTile title="Wishlist" value={currentStats.wishlist} tone="gold" />
        <StatTile title={session.user.role === 'seller' ? 'Revenue' : 'Saved value'} value={money(currentStats.revenue).replace('₹', '')} tone="ink" />
      </div>

      <section className="splitGrid">
        <article className="infoCard">
          <h3>Saved books</h3>
          <div className="miniFeed">
            {myWishlist.length ? myWishlist.map((book) => (
              <div className="miniFeedRow" key={book.id}>
                <strong>{book.title}</strong>
                <span>{book.genre}</span>
                <span>{money(book.price)}</span>
              </div>
            )) : <p>No saved books yet.</p>}
          </div>
        </article>
        <article className="infoCard alt">
          <h3>Recent orders</h3>
          <div className="miniFeed">
            {orders.length ? orders.map((order) => (
              <div className="miniFeedRow stacked" key={order.id}>
                <strong>{order.id}</strong>
                <span>{order.items.map((item) => item.title).join(', ')}</span>
                <span>{order.status}</span>
              </div>
            )) : <p>No orders yet.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}

function BookTableRow({ book, onEdit, onDelete, money }) {
  return (
    <div className="tableRow bookRow">
      <span>{book.title}</span>
      <span>{book.author}</span>
      <span>{money(book.price)}</span>
      <span>★ {Number(book.rating).toFixed(1)}</span>
      <div className="rowActions">
        <button className="textButton" onClick={() => onEdit(book)}>
          Edit
        </button>
        <button className="textButton danger" onClick={() => onDelete(book.id)}>
          Delete
        </button>
      </div>
    </div>
  );
}

function StatTile({ title, value, tone }) {
  return (
    <article className={`statTile ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ProtectedRoute() {
  const { session } = useBookStore();
  if (!session.user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/book/:id" element={<BookPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function WishlistPage() {
  const { wishlistIds, books } = useBookStore();
  const wishlistBooks = books.filter(b => wishlistIds.has(b.id));

  return (
    <div className="wishlistPage">
      <div className="sectionHeading stacked">
        <h2>Wishlist</h2>
        <p>Books you've saved for later.</p>
      </div>
      <section className="bookGrid">
        {wishlistBooks.length ? (
          wishlistBooks.map((book) => <BookCard book={book} key={book.id} />)
        ) : (
          <div className="emptyState">
            <h3>Your wishlist is empty.</h3>
          </div>
        )}
      </section>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}

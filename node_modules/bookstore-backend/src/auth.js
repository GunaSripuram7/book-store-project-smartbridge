const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'bookverse-local-secret';

function issueToken(user) {
  return jwt.sign(
    {
      sub: String(user._id || user.id),
      role: user.role
    },
    SECRET,
    { expiresIn: '7d' }
  );
}

function hashPassword(password) {
  return bcrypt.hashSync(String(password), 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function createAuthMiddleware(findUserById, safeUser) {
  return async function authMiddleware(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication token missing.' });
    }

    try {
      const payload = jwt.verify(token, SECRET);
      const currentUser = await findUserById(payload.sub);

      if (!currentUser) {
        return res.status(401).json({ message: 'Session expired. Please log in again.' });
      }

      req.user = safeUser(currentUser);
      req.rawUser = currentUser;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid authentication token.' });
    }
  };
}

function requireRole(...roles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You are not allowed to access this resource.' });
    }

    next();
  };
}

module.exports = {
  createAuthMiddleware,
  hashPassword,
  issueToken,
  requireRole,
  verifyPassword
};

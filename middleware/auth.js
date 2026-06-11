const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.redirect('/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
};

const authSocket = (socket, next) => {
  const token = socket.handshake.headers.cookie
    ?.split(';')
    .find(c => c.trim().startsWith('token='))
    ?.split('=')[1];

  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
};

module.exports = { authMiddleware, authSocket };

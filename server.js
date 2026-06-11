require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { engine } = require('express-handlebars');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const { initDB } = require('./models');
const { authSocket } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const chatHandler = require('./socket/chatHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: false },
});

// --- Middleware ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.jsdelivr.net", "unpkg.com"],
      scriptSrcElem: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "unpkg.com"],
      styleSrc:      ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com"],
      fontSrc:       ["'self'", "fonts.gstatic.com"],
      imgSrc:        ["'self'", "data:", "blob:", "cdn.jsdelivr.net"],
      connectSrc:    ["'self'", "ws:", "wss:", "cdn.jsdelivr.net", "https://cdn.jsdelivr.net"],
      workerSrc:     ["'self'", "blob:", "cdn.jsdelivr.net"],
      childSrc:      ["'self'", "blob:"],
    },
  },
}));
app.use(cors({ origin: false }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Handlebars ---
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  helpers: {
    isImage: (type) => type === 'image',
    formatTime: (date) => {
      if (!date) return '';
      return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    },
    eq: (a, b) => a === b,
    substr: (str, start, length) => {
      if (!str) return '';
      return String(str).substring(start, start + length).toUpperCase();
    },
  },
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// --- Routes ---
app.use('/', authRoutes);
app.use('/', chatRoutes);

// --- 404 ---
app.use((req, res) => {
  res.status(404).redirect('/login');
});

// --- Socket.io Auth ---
io.use(authSocket);
chatHandler(io);

// --- Start ---
const PORT = process.env.PORT || 3000;

initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('❌ Erreur de démarrage:', err);
  process.exit(1);
});

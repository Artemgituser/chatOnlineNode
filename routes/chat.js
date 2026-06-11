const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');
const { Room, Message, User } = require('../models');

// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Seules les images sont acceptées.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// --- Routes ---

// GET /chat — page principale
router.get('/chat', authMiddleware, async (req, res) => {
  try {
    const rooms = await Room.findAll({ order: [['id', 'ASC']] });
    res.render('chat', {
      layout: 'main',
      title: 'Chat — ChatApp',
      user: req.user,
      rooms: rooms.map(r => r.toJSON()),
    });
  } catch (err) {
    console.error('Chat page error:', err);
    res.status(500).send('Erreur serveur');
  }
});

// GET /api/rooms — liste des salons
router.get('/api/rooms', authMiddleware, async (req, res) => {
  try {
    const rooms = await Room.findAll({ order: [['id', 'ASC']] });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/messages/:roomId — messages paginés (infinite scroll)
router.get('/api/messages/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { before, limit = 30 } = req.query;

    const where = { roomId };
    if (before) {
      where.id = { [require('sequelize').Op.lt]: parseInt(before, 10) };
    }

    const messages = await Message.findAll({
      where,
      include: [{ model: User, as: 'author', attributes: ['id', 'username'] }],
      order: [['id', 'DESC']],
      limit: Math.min(parseInt(limit, 10), 50),
    });

    res.json(messages.reverse());
  } catch (err) {
    console.error('Messages error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/upload — upload image (max 5 Mo)
router.post('/api/upload', authMiddleware, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image trop volumineuse. Limite : 5 Mo.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier reçu.' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
  });
});

// Root redirect
router.get('/', (req, res) => res.redirect('/chat'));

module.exports = router;

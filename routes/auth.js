const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// GET /login
router.get('/login', (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      return res.redirect('/chat');
    } catch (_) {}
  }
  res.render('login', { layout: 'main', title: 'Connexion — ChatApp', error: req.query.error });
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('login', { layout: 'main', title: 'Connexion — ChatApp', error: 'Tous les champs sont requis.' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user || !(await user.validatePassword(password))) {
      return res.render('login', { layout: 'main', title: 'Connexion — ChatApp', error: 'Email ou mot de passe incorrect.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect('/chat');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { layout: 'main', title: 'Connexion — ChatApp', error: 'Une erreur est survenue. Réessayez.' });
  }
});

// GET /register
router.get('/register', (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      return res.redirect('/chat');
    } catch (_) {}
  }
  res.render('register', { layout: 'main', title: 'Inscription — ChatApp', error: req.query.error });
});

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.render('register', { layout: 'main', title: 'Inscription — ChatApp', error: 'Tous les champs sont requis.' });
    }

    if (password !== confirmPassword) {
      return res.render('register', { layout: 'main', title: 'Inscription — ChatApp', error: 'Les mots de passe ne correspondent pas.' });
    }

    if (password.length < 6) {
      return res.render('register', { layout: 'main', title: 'Inscription — ChatApp', error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    const existingUser = await User.findOne({
      where: { email: email.toLowerCase() }
    });
    if (existingUser) {
      return res.render('register', { layout: 'main', title: 'Inscription — ChatApp', error: 'Cet email est déjà utilisé.' });
    }

    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.render('register', { layout: 'main', title: 'Inscription — ChatApp', error: 'Ce nom d\'utilisateur est déjà pris.' });
    }

    await User.create({
      username,
      email: email.toLowerCase(),
      password,
    });

    res.redirect('/login?success=Compte créé avec succès. Connectez-vous.');
  } catch (err) {
    console.error('Register error:', err);
    if (err.name === 'SequelizeValidationError') {
      return res.render('register', { layout: 'main', title: 'Inscription — ChatApp', error: err.errors[0].message });
    }
    res.render('register', { layout: 'main', title: 'Inscription — ChatApp', error: 'Une erreur est survenue. Réessayez.' });
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

module.exports = router;

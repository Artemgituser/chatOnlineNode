# 💬 ChatApp

Application de chat en temps réel construite avec **Node.js**, **Socket.io**, **MySQL** et un design inspiré d'**Apple macOS/iOS**.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=flat-square&logo=socket.io&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql&logoColor=white)
![Sequelize](https://img.shields.io/badge/Sequelize-6.x-52B0E7?style=flat-square&logo=sequelize&logoColor=white)

---

## ✨ Fonctionnalités

- 🔐 **Authentification sécurisée** — JWT stocké en cookie `HTTP-Only`, mots de passe hachés avec `bcrypt`
- 💬 **Salons de discussion** — 4 salons prédéfinis (général, technologie, gaming, musique)
- ⚡ **Temps réel** — Messages instantanés via Socket.io
- ✍️ **Indicateur de frappe** — "X est en train d'écrire..."
- 🖼️ **Images par copier-coller** — Colle directement une image dans le chat (max 5 Mo)
- 😊 **Sélecteur d'emojis** — Intégré avec `emoji-picker-element`
- 📜 **Infinite Scroll** — Chargement progressif des messages anciens
- 🎨 **Design Apple** — Glassmorphism, dark mode iOS, animations fluides

---

## 🗂️ Structure du projet

```
chat/
├── config/
│   └── database.js          # Configuration Sequelize
├── middleware/
│   └── auth.js              # Vérification JWT (HTTP + Socket)
├── models/
│   ├── index.js             # Associations + seed des salons
│   ├── User.js              # Modèle utilisateur
│   ├── Room.js              # Modèle salon
│   └── Message.js           # Modèle message (text | image)
├── nginx/
│   └── artem-www.wywiwyg.net.conf   # Config Nginx production
├── public/
│   ├── css/style.css        # Design system Apple
│   └── js/chat.js           # Logique client (Socket, scroll, emoji)
├── routes/
│   ├── auth.js              # /login, /register, /logout
│   └── chat.js              # /chat, /api/messages, /api/upload
├── socket/
│   └── chatHandler.js       # Événements Socket.io
├── uploads/                 # Images uploadées (servies statiquement)
├── views/
│   ├── layouts/main.hbs     # Layout principal
│   ├── partials/message.hbs # Composant message
│   ├── login.hbs
│   ├── register.hbs
│   └── chat.hbs
├── .env.example
├── docker-compose.yml       # MySQL via Docker
└── server.js                # Point d'entrée
```

---

## 🚀 Installation — Développement

### Prérequis

- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (pour MySQL)

### 1. Cloner et installer

```bash
git clone <repo-url>
cd chat
npm install
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
```

Éditer `.env` selon vos besoins :

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=chatuser
DB_PASS=chatpassword
DB_NAME=chatdb

JWT_SECRET=changez_cette_valeur_en_production
JWT_EXPIRES_IN=7d
```

### 3. Démarrer la base de données (Docker)

```bash
docker-compose up -d
```

> MySQL sera disponible sur `localhost:3306`.
> Les tables et les salons par défaut sont créés automatiquement au démarrage.

### 4. Lancer l'application

```bash
npm run dev     # Développement (nodemon)
npm start       # Production
```

L'application est accessible sur **http://localhost:3000**

---

## 🌐 Déploiement — Production

### Stack recommandée

| Composant | Outil |
|-----------|-------|
| Reverse proxy | **Nginx** |
| SSL | **Let's Encrypt** (Certbot) |
| Process manager | **PM2** |
| Base de données | MySQL 8.0 (serveur dédié ou Docker) |

### 1. Déployer l'application

```bash
# Sur le serveur
git clone <repo-url> /home/artem/chatOnlineNode
cd /home/artem/chatOnlineNode
npm install --omit=dev

# Configurer .env en mode production
NODE_ENV=production
JWT_SECRET=<clé_très_longue_et_aléatoire>
```

### 2. Démarrer avec PM2

```bash
npm install -g pm2
pm2 start server.js --name chatapp
pm2 save
pm2 startup   # Auto-démarrage au boot
```

### 3. Configurer Nginx

```bash
sudo cp nginx/artem-www.wywiwyg.net.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/artem-www.wywiwyg.net.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Obtenir le certificat SSL

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d artem-www.wywiwyg.net
```

---

## 🔌 API & Événements Socket.io

### Routes HTTP

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `GET` | `/login` | ❌ | Page de connexion |
| `POST` | `/login` | ❌ | Connexion + cookie JWT |
| `GET` | `/register` | ❌ | Page d'inscription |
| `POST` | `/register` | ❌ | Création de compte |
| `POST` | `/logout` | ✅ | Déconnexion + clear cookie |
| `GET` | `/chat` | ✅ | Page principale du chat |
| `GET` | `/api/rooms` | ✅ | Liste des salons |
| `GET` | `/api/messages/:roomId` | ✅ | Messages paginés (`?before=<id>&limit=30`) |
| `POST` | `/api/upload` | ✅ | Upload image (max 5 Mo) |

### Événements Socket.io

**Client → Serveur**

| Événement | Payload | Description |
|-----------|---------|-------------|
| `join_room` | `roomId` | Rejoindre un salon |
| `send_message` | `{ roomId, content }` | Envoyer un message texte |
| `send_image` | `{ roomId, imageUrl }` | Envoyer une image uploadée |
| `typing_start` | `{ roomId }` | Début de frappe |
| `typing_stop` | `{ roomId }` | Fin de frappe |

**Serveur → Client**

| Événement | Payload | Description |
|-----------|---------|-------------|
| `new_message` | `Message` | Nouveau message dans la room |
| `typing_update` | `string[]` | Liste des utilisateurs en train d'écrire |
| `error_message` | `string` | Erreur à afficher |

---

## 🗄️ Modèles de données

```
User          Room          Message
────────      ────────      ──────────────
id            id            id
username      name          content
email         description   type (text|image)
password      icon          userId → User
createdAt     createdAt     roomId → Room
updatedAt     updatedAt     createdAt
                            updatedAt
```

---

## 🔒 Sécurité

- Mots de passe hachés avec **bcrypt** (`saltRounds = 12`)
- JWT en cookie **HttpOnly + SameSite=Strict**
- Headers sécurisés via **Helmet.js**
- Upload filtré par **type MIME** + limite **5 Mo**
- Échappement HTML côté client (protection XSS)
- CSP (Content Security Policy) configurée

---

## 📦 Dépendances principales

| Package | Version | Usage |
|---------|---------|-------|
| `express` | ^4.19 | Serveur HTTP |
| `socket.io` | ^4.7 | Temps réel WebSocket |
| `express-handlebars` | ^7.1 | Templates HTML |
| `sequelize` | ^6.37 | ORM MySQL |
| `mysql2` | ^3.9 | Driver MySQL |
| `jsonwebtoken` | ^9.0 | Authentification JWT |
| `bcrypt` | ^5.1 | Hashage mots de passe |
| `multer` | ^1.4 | Upload de fichiers |
| `helmet` | ^7.1 | Headers de sécurité |
| `cookie-parser` | ^1.4 | Lecture des cookies |
| `uuid` | ^10.0 | Noms de fichiers uniques |

---

## 📝 Licence

MIT — Projet éducatif DWWM

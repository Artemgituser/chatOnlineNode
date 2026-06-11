const sequelize = require('../config/database');
const User = require('./User');
const Room = require('./Room');
const Message = require('./Message');

// Associations
User.hasMany(Message, { foreignKey: 'userId', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'userId', as: 'author' });

Room.hasMany(Message, { foreignKey: 'roomId', as: 'messages' });
Message.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

// Seed default rooms
const seedRooms = async () => {
  const defaultRooms = [
    { name: 'général', description: 'Discussion générale ouverte à tous', icon: '💬' },
    { name: 'technologie', description: 'Tech, développement, et innovations', icon: '💻' },
    { name: 'gaming', description: 'Jeux vidéo et culture geek', icon: '🎮' },
    { name: 'musique', description: 'Partage musical et découvertes', icon: '🎵' },
  ];

  for (const room of defaultRooms) {
    await Room.findOrCreate({ where: { name: room.name }, defaults: room });
  }
};

const initDB = async () => {
  await sequelize.sync({ alter: true });
  await seedRooms();
  console.log('✅ Base de données synchronisée et salons initialisés');
};

module.exports = { sequelize, User, Room, Message, initDB };

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('text', 'image'),
    defaultValue: 'text',
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  roomId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'rooms',
      key: 'id',
    },
  },
}, {
  tableName: 'messages',
  timestamps: true,
});

module.exports = Message;

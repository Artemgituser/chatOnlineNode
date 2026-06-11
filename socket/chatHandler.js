const { Message, User } = require('../models');

const typingUsers = {}; // { roomId: Set<username> }

module.exports = (io) => {
  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`🔌 ${user.username} connecté (socket: ${socket.id})`);

    // --- Rejoindre un salon ---
    socket.on('join_room', async (roomId) => {
      // Quitter les anciens salons
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.leave(room);
          // Retirer l'utilisateur des indicateurs de frappe
          if (typingUsers[room]) {
            typingUsers[room].delete(user.username);
            io.to(room).emit('typing_update', [...(typingUsers[room] || [])]);
          }
        }
      }

      socket.join(String(roomId));
      socket.currentRoom = String(roomId);
      console.log(`📌 ${user.username} a rejoint le salon #${roomId}`);
    });

    // --- Envoyer un message texte ---
    socket.on('send_message', async ({ roomId, content }) => {
      if (!content || !content.trim() || !roomId) return;

      // Stop typing on message send
      if (typingUsers[roomId]) {
        typingUsers[roomId].delete(user.username);
        io.to(String(roomId)).emit('typing_update', [...typingUsers[roomId]]);
      }

      try {
        const message = await Message.create({
          content: content.trim(),
          type: 'text',
          userId: user.id,
          roomId: parseInt(roomId, 10),
        });

        const fullMessage = await Message.findByPk(message.id, {
          include: [{ model: User, as: 'author', attributes: ['id', 'username'] }],
        });

        io.to(String(roomId)).emit('new_message', fullMessage.toJSON());
      } catch (err) {
        console.error('send_message error:', err);
        socket.emit('error_message', 'Erreur lors de l\'envoi du message.');
      }
    });

    // --- Envoyer une image (après upload REST) ---
    socket.on('send_image', async ({ roomId, imageUrl }) => {
      if (!imageUrl || !roomId) return;

      try {
        const message = await Message.create({
          content: imageUrl,
          type: 'image',
          userId: user.id,
          roomId: parseInt(roomId, 10),
        });

        const fullMessage = await Message.findByPk(message.id, {
          include: [{ model: User, as: 'author', attributes: ['id', 'username'] }],
        });

        io.to(String(roomId)).emit('new_message', fullMessage.toJSON());
      } catch (err) {
        console.error('send_image error:', err);
        socket.emit('error_message', 'Erreur lors de l\'envoi de l\'image.');
      }
    });

    // --- Indicateur de frappe ---
    socket.on('typing_start', ({ roomId }) => {
      if (!roomId) return;
      if (!typingUsers[roomId]) typingUsers[roomId] = new Set();
      typingUsers[roomId].add(user.username);
      socket.to(String(roomId)).emit('typing_update', [...typingUsers[roomId]]);
    });

    socket.on('typing_stop', ({ roomId }) => {
      if (!roomId) return;
      if (typingUsers[roomId]) {
        typingUsers[roomId].delete(user.username);
        socket.to(String(roomId)).emit('typing_update', [...typingUsers[roomId]]);
      }
    });

    // --- Déconnexion ---
    socket.on('disconnect', () => {
      console.log(`🔴 ${user.username} déconnecté`);
      // Nettoyer les indicateurs de frappe
      for (const roomId in typingUsers) {
        if (typingUsers[roomId].has(user.username)) {
          typingUsers[roomId].delete(user.username);
          io.to(roomId).emit('typing_update', [...typingUsers[roomId]]);
        }
      }
    });
  });
};

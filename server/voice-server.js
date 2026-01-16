const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const players = {};

io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        players[socket.id] = { roomId, userId };
        
        // Notify others
        socket.to(roomId).emit('user-connected', socket.id);
        
        // Send list of existing users
        const usersInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []).filter(id => id !== socket.id);
        socket.emit('existing-users', usersInRoom);
    });

    socket.on('signal', (data) => {
        // Relay signal (offer/answer/candidate) to specific peer
        io.to(data.to).emit('signal', {
            signal: data.signal,
            from: socket.id
        });
    });

    socket.on('update-position', (data) => {
        // Relay position to others in room
        const player = players[socket.id];
        if (player) {
            socket.to(player.roomId).emit('player-moved', {
                id: socket.id,
                position: data.position,
                rotation: data.rotation,
                state: data.state // 'idle', 'walk', 'drive'
            });
        }
    });

    socket.on('disconnect', () => {
        const player = players[socket.id];
        if (player) {
            socket.to(player.roomId).emit('user-disconnected', socket.id);
            delete players[socket.id];
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Voice/Signaling Server running on port ${PORT}`);
});

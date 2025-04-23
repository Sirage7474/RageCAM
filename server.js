const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('.'));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const rooms = new Map();

io.on('connection', socket => {
    socket.on('join-room', ({ roomName, roomPassword, username }) => {
        if (!rooms.has(roomName)) {
            rooms.set(roomName, {
                password: roomPassword,
                users: new Map()
            });
        }

        const room = rooms.get(roomName);
        if (room.password !== roomPassword) {
            socket.emit('error', 'Invalid room password');
            return;
        }

        socket.join(roomName);
        room.users.set(socket.id, username);

        socket.to(roomName).emit('user-connected', socket.id);

        socket.on('disconnect', () => {
            if (rooms.has(roomName)) {
                const room = rooms.get(roomName);
                room.users.delete(socket.id);
                if (room.users.size === 0) {
                    rooms.delete(roomName);
                }
                socket.to(roomName).emit('user-disconnected', socket.id);
            }
        });
    });

    socket.on('offer', ({ offer, to }) => {
        socket.to(to).emit('offer', { offer, from: socket.id });
    });

    socket.on('answer', ({ answer, to }) => {
        socket.to(to).emit('answer', { answer, from: socket.id });
    });

    socket.on('ice-candidate', ({ candidate, to }) => {
        socket.to(to).emit('ice-candidate', { candidate, from: socket.id });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
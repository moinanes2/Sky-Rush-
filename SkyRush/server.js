const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const lobbies = new Map();

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (lobbies.has(code));
  return code;
}

function lobbyPayload(lobby) {
  return {
    code: lobby.code,
    hostName: lobby.hostName,
    guestName: lobby.guestName,
    hostReady: lobby.hostReady,
    guestReady: lobby.guestReady,
    hostChar: lobby.hostChar,
    guestChar: lobby.guestChar,
    bg: lobby.bg,
    started: lobby.started
  };
}

function emitLobby(code) {
  const lobby = lobbies.get(code);
  if (!lobby) return;
  io.to(code).emit('online:lobby-state', lobbyPayload(lobby));
}

function clearSocketLobbyData(socket) {
  socket.data.lobbyCode = null;
  socket.data.role = null;
}

function closeLobby(code, reason = '') {
  const room = io.sockets.adapter.rooms.get(code);
  if (reason) {
    io.to(code).emit('online:error', reason);
  }
  io.to(code).emit('online:force-menu');

  if (room) {
    for (const socketId of room) {
      const roomSocket = io.sockets.sockets.get(socketId);
      if (!roomSocket) continue;
      roomSocket.leave(code);
      clearSocketLobbyData(roomSocket);
    }
  }

  lobbies.delete(code);
}

function makeLobby(hostSocket, hostName) {
  const code = randomCode();
  const lobby = {
    code,
    hostId: hostSocket.id,
    guestId: null,
    hostName,
    guestName: '',
    hostReady: false,
    guestReady: false,
    hostChar: '1',
    guestChar: '2',
    bg: '1',
    started: false
  };
  lobbies.set(code, lobby);
  hostSocket.join(code);
  hostSocket.data.lobbyCode = code;
  hostSocket.data.role = 'host';
  return lobby;
}

io.on('connection', socket => {
  socket.on('online:create-lobby', ({ name }) => {
    const hostName = String(name || 'Spieler 1').slice(0, 16) || 'Spieler 1';
    const lobby = makeLobby(socket, hostName);
    socket.emit('online:lobby-created', { role: 'host', lobby: lobbyPayload(lobby) });
    emitLobby(lobby.code);
  });

  socket.on('online:join-lobby', ({ code, name }) => {
    const joinCode = String(code || '').toUpperCase().trim();
    const lobby = lobbies.get(joinCode);
    if (!lobby) {
      socket.emit('online:error', 'Lobby nicht gefunden.');
      return;
    }
    if (lobby.started) {
      socket.emit('online:error', 'Diese Lobby läuft schon.');
      return;
    }
    if (lobby.guestId && lobby.guestId !== socket.id) {
      socket.emit('online:error', 'Lobby ist schon voll.');
      return;
    }

    lobby.guestId = socket.id;
    lobby.guestName = String(name || 'Spieler 2').slice(0, 16) || 'Spieler 2';
    lobby.guestReady = false;
    socket.join(joinCode);
    socket.data.lobbyCode = joinCode;
    socket.data.role = 'guest';
    socket.emit('online:lobby-joined', { role: 'guest', lobby: lobbyPayload(lobby) });
    emitLobby(joinCode);
  });

  socket.on('online:update-choice', ({ code, role, char, bg }) => {
    const lobby = lobbies.get(String(code || '').toUpperCase().trim());
    if (!lobby) return;

    if (role === 'host' && socket.id === lobby.hostId) {
      if (char) lobby.hostChar = String(char);
      if (bg) lobby.bg = String(bg);
    }

    if (role === 'guest' && socket.id === lobby.guestId) {
      if (char) lobby.guestChar = String(char);
    }

    emitLobby(lobby.code);
  });

  socket.on('online:set-ready', ({ code, ready }) => {
    const lobby = lobbies.get(String(code || '').toUpperCase().trim());
    if (!lobby) return;

    if (socket.id === lobby.hostId) lobby.hostReady = !!ready;
    if (socket.id === lobby.guestId) lobby.guestReady = !!ready;

    emitLobby(lobby.code);
  });

  socket.on('online:start', ({ code }) => {
    const lobby = lobbies.get(String(code || '').toUpperCase().trim());
    if (!lobby || socket.id !== lobby.hostId) return;

    if (!lobby.guestId) {
      socket.emit('online:error', 'Es ist noch kein zweiter Spieler in der Lobby.');
      return;
    }

    if (!lobby.hostReady || !lobby.guestReady) {
      socket.emit('online:error', 'Beide Spieler müssen bereit sein.');
      return;
    }

    lobby.started = true;
    const payload = lobbyPayload(lobby);
    io.to(lobby.code).emit('online:game-start', payload);
    io.to(lobby.code).emit('online:start-game', payload);
    emitLobby(lobby.code);
  });

  socket.on('online:leave-lobby', ({ code }) => {
    const lobby = lobbies.get(String(code || '').toUpperCase().trim());
    if (!lobby) {
      clearSocketLobbyData(socket);
      return;
    }

    if (socket.id === lobby.hostId) {
      closeLobby(lobby.code, 'Host hat die Lobby verlassen.');
      return;
    }

    if (socket.id === lobby.guestId) {
      lobby.guestId = null;
      lobby.guestName = '';
      lobby.guestReady = false;
      lobby.started = false;
      socket.leave(lobby.code);
      clearSocketLobbyData(socket);
      emitLobby(lobby.code);
    }
  });

  socket.on('online:input', payload => {
    const code = socket.data.lobbyCode;
    if (!code) return;
    socket.to(code).emit('online:input', payload);
  });

  socket.on('online:state', payload => {
    const code = socket.data.lobbyCode || (payload && payload.code);
    if (!code) return;
    const snapshot = payload && payload.snapshot ? payload.snapshot : payload;
    socket.to(code).emit('online:state', snapshot);
  });

  socket.on('online:match-over', payload => {
    const code = socket.data.lobbyCode;
    if (!code) return;
    const lobby = lobbies.get(code);
    if (lobby) lobby.started = false;
    socket.to(code).emit('online:match-over', payload);
    emitLobby(code);
  });

  socket.on('disconnect', () => {
    const code = socket.data.lobbyCode;
    if (!code) return;

    const lobby = lobbies.get(code);
    if (!lobby) {
      clearSocketLobbyData(socket);
      return;
    }

    if (socket.id === lobby.hostId) {
      closeLobby(code, 'Host hat die Verbindung verloren.');
      return;
    }

    if (socket.id === lobby.guestId) {
      lobby.guestId = null;
      lobby.guestName = '';
      lobby.guestReady = false;
      lobby.started = false;
      clearSocketLobbyData(socket);
      emitLobby(code);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Sky Rush läuft auf Port ${PORT}`);
});

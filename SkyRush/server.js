const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

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

function removeLobbyIfEmpty(code) {
  const lobby = lobbies.get(code);
  if (!lobby) return;
  if (!lobby.hostId && !lobby.guestId) lobbies.delete(code);
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
    const lobbyCode = String(code || '').toUpperCase().trim();
    const lobby = lobbies.get(lobbyCode);
    if (!lobby) return;

    if (role === 'host' && socket.id === lobby.hostId) {
      if (char) lobby.hostChar = String(char);
      if (bg) lobby.bg = String(bg);
    }

    if (role === 'guest' && socket.id === lobby.guestId) {
      if (char) lobby.guestChar = String(char);
    }

    emitLobby(lobbyCode);
  });

  socket.on('online:set-ready', ({ code, ready }) => {
    const lobbyCode = String(code || '').toUpperCase().trim();
    const lobby = lobbies.get(lobbyCode);
    if (!lobby) return;

    if (socket.id === lobby.hostId) lobby.hostReady = !!ready;
    if (socket.id === lobby.guestId) lobby.guestReady = !!ready;

    emitLobby(lobbyCode);
  });

  socket.on('online:start', ({ code }) => {
    const lobbyCode = String(code || '').toUpperCase().trim();
    const lobby = lobbies.get(lobbyCode);
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
    io.to(lobbyCode).emit('online:start-game', lobbyPayload(lobby));
    emitLobby(lobbyCode);
  });

  socket.on('online:leave-lobby', ({ code }) => {
    const lobbyCode = String(code || socket.data.lobbyCode || '').toUpperCase().trim();
    const lobby = lobbies.get(lobbyCode);
    if (!lobby) return;

    if (socket.id === lobby.hostId) {
      io.to(lobbyCode).emit('online:error', 'Host hat die Lobby verlassen.');
      io.to(lobbyCode).emit('online:force-menu');
      lobbies.delete(lobbyCode);
      return;
    }

    if (socket.id === lobby.guestId) {
      lobby.guestId = null;
      lobby.guestName = '';
      lobby.guestReady = false;
      lobby.started = false;

      socket.leave(lobbyCode);
      socket.data.lobbyCode = null;
      socket.data.role = null;

      emitLobby(lobbyCode);
    }
  });

  socket.on('online:input', payload => {
    const code = socket.data.lobbyCode;
    if (!code) return;
    socket.to(code).emit('online:input', payload);
  });

  socket.on('online:state', payload => {
    const code = socket.data.lobbyCode;
    if (!code) return;
    socket.to(code).emit('online:state', payload);
  });

  socket.on('online:match-over', payload => {
    const code = socket.data.lobbyCode;
    if (!code) return;

    const lobby = lobbies.get(code);
    if (lobby) {
      lobby.started = false;
      lobby.hostReady = false;
      lobby.guestReady = false;
    }

    io.to(code).emit('online:match-over', {
      winner: payload?.winner || '',
      lobby: lobby ? lobbyPayload(lobby) : null
    });

    emitLobby(code);
  });

  socket.on('disconnect', () => {
    const code = socket.data.lobbyCode;
    if (!code) return;

    const lobby = lobbies.get(code);
    if (!lobby) return;

    if (socket.id === lobby.hostId) {
      io.to(code).emit('online:error', 'Host hat die Verbindung verloren.');
      io.to(code).emit('online:force-menu');
      lobbies.delete(code);
      return;
    }

    if (socket.id === lobby.guestId) {
      lobby.guestId = null;
      lobby.guestName = '';
      lobby.guestReady = false;
      lobby.started = false;
      emitLobby(code);
      removeLobbyIfEmpty(code);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Sky Rush läuft auf Port ${PORT}`);
});

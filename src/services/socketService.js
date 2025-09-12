const LobbyController = require('../controllers/lobbyController');
const GameController = require('../controllers/gameController');

class SocketService {
  constructor() {
    this.lobbyController = new LobbyController();
    this.gameController = new GameController(this.lobbyController);
    this.io = null;
  }

  initialize(io) {
    this.io = io;

    io.on('connection', (socket) => {
      console.log(`Player connected: ${socket.id}`);

      socket.on('create-room', (data, callback) => {
        try {
          const { room, player } = this.lobbyController.createRoom(socket, data.nickname);
          
          callback({ success: true, room, player });
          socket.to(room.id).emit('player-joined', { player, room });
          
          console.log(`Room created: ${room.id} by ${player.nickname}`);
        } catch (error) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('join-room', (data, callback) => {
        try {
          const { room, player } = this.lobbyController.joinRoom(socket, data.roomId, data.nickname);
          
          callback({ success: true, room, player });
          socket.to(room.id).emit('player-joined', { player, room });
          
          console.log(`${player.nickname} joined room: ${room.id}`);
        } catch (error) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('leave-room', () => {
        this.handleLeaveRoom(socket);
      });

      socket.on('start-game', (callback) => {
        try {
          const game = this.lobbyController.startGame(socket.id);
          
          callback({ success: true, game: game.getGameState() });
          this.io.to(game.roomId).emit('game-started', game.getGameState());
          
          console.log(`Game started in room: ${game.roomId}`);
        } catch (error) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('select-word', (data, callback) => {
        try {
          const game = this.gameController.selectWord(socket.id, data.word);
          
          callback({ success: true, game: game.getGameState() });
          this.io.to(game.roomId).emit('word-selected', {
            drawer: game.currentDrawer,
            gameState: game.getGameState()
          });
          
          console.log(`Word selected: ${data.word} in room: ${game.roomId}`);
        } catch (error) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('make-guess', (data, callback) => {
        try {
          const result = this.gameController.makeGuess(socket.id, data.guess);
          
          callback({ success: true, isCorrect: result.isCorrect });
          
          if (result.isCorrect) {
            this.io.to(result.game.roomId).emit('correct-guess', {
              player: result.player,
              word: data.guess,
              gameState: result.game.getGameState()
            });
          } else {
            socket.to(result.game.roomId).emit('new-guess', {
              player: result.player,
              guess: data.guess
            });
          }
          
          console.log(`${result.player.nickname} guessed: ${data.guess} - ${result.isCorrect ? 'Correct!' : 'Wrong'}`);
        } catch (error) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('draw', (data) => {
        try {
          const result = this.gameController.handleDrawing(socket.id, data);
          
          socket.to(result.game.roomId).emit('drawing-update', data);
        } catch (error) {
          console.error('Drawing error:', error.message);
        }
      });

      socket.on('clear-canvas', (callback) => {
        try {
          const game = this.gameController.clearCanvas(socket.id);
          
          callback({ success: true });
          socket.to(game.roomId).emit('canvas-cleared');
          
          console.log(`Canvas cleared in room: ${game.roomId}`);
        } catch (error) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('get-game-state', (callback) => {
        try {
          const gameState = this.gameController.getGameState(socket.id);
          callback({ success: true, gameState });
        } catch (error) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('get-drawing-data', (callback) => {
        try {
          const drawingData = this.gameController.getDrawingData(socket.id);
          callback({ success: true, drawingData });
        } catch (error) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('end-game', (callback) => {
        try {
          const game = this.gameController.endGame(socket.id);
          
          callback({ success: true, game: game.getGameState() });
          this.io.to(game.roomId).emit('game-ended', game.getGameState());
          
          console.log(`Game ended in room: ${game.roomId}`);
        } catch (error) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('reconnect-player', (data, callback) => {
        try {
          const result = this.lobbyController.reconnectPlayer(socket, data.roomId, data.playerId);
          
          callback({ 
            success: true, 
            room: result.room, 
            player: result.player,
            game: result.game ? result.game.getGameState() : null
          });
          
          socket.to(result.room.id).emit('player-reconnected', { 
            player: result.player,
            room: result.room 
          });
          
          console.log(`${result.player.nickname} reconnected to room: ${result.room.id}`);
        } catch (error) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('get-room-list', (callback) => {
        const rooms = this.lobbyController.getRoomList();
        callback({ success: true, rooms });
      });

      socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        this.handleLeaveRoom(socket);
      });
    });
  }

  handleLeaveRoom(socket) {
    const result = this.lobbyController.leaveRoom(socket.id);
    
    if (result && result.room) {
      const game = this.lobbyController.getGame(result.room.id);
      
      if (game) {
        game.removePlayer(result.player.id);
        this.gameController.cleanup(result.room.id);
      }
      
      socket.to(result.room.id).emit('player-left', { 
        player: result.player, 
        room: result.room,
        game: game ? game.getGameState() : null
      });
      
      console.log(`${result.player.nickname} left room: ${result.room.id}`);
    }
  }
}

module.exports = new SocketService();
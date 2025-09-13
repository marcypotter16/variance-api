import LobbyController from '../controllers/lobbyController';
import { Server, Socket } from 'socket.io';
import { GAME_STATES } from '../models/Game';

class SocketService {
  private lobbyController: LobbyController;
  private io: Server | null = null;

  constructor() {
    this.lobbyController = new LobbyController();
  }

  initialize(io: Server) {
    this.io = io;

    io.on('connection', (socket: Socket) => {
      console.log(`Player connected: ${socket.id}`);

      socket.on('create-room', (data: any, callback: (response: any) => void) => {
        try {
          const { room, player } = this.lobbyController.createRoom(socket, data.nickname);
          
          callback({ success: true, room, player });
          socket.to(room.id).emit('player-joined', { player, room });
          
          console.log(`Room created: ${room.id} by ${player.nickname}`);
        } catch (error: any) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('join-room', (data: any, callback: (response: any) => void) => {
        try {
          const { room, player } = this.lobbyController.joinRoom(socket, data.roomId, data.nickname);
          
          callback({ success: true, room, player });
          socket.to(room.id).emit('player-joined', { player, room });
          
          console.log(`${player.nickname} joined room: ${room.id}`);
        } catch (error: any) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('get-room-list', (callback: (response: any) => void) => {
        const rooms = this.lobbyController.getRoomList();
        callback({ success: true, rooms });
      });

      socket.on('get-room-players', (roomId: string, callback: (response: any) => void) => {
        try {
          const room = this.lobbyController.getRoom(roomId);
          if (room) {
            callback({ success: true, players: room.players });
          } else {
            callback({ success: false, error: 'Room not found' });
          }
        } catch (error: any) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('start-game', (data: any, callback: (response: any) => void) => {
        try {
          const maxRounds = data?.maxRounds || 1;
          const minimumVariance = data?.minimumVariance || false;
          const game = this.lobbyController.startGame(socket.id, maxRounds, minimumVariance);
          
          // Get the room to broadcast to all players
          const player = this.lobbyController.getPlayer(socket.id);
          if (player && player.roomId) {
            const room = this.lobbyController.getRoom(player.roomId);
            if (room) {
              // Broadcast to all players in the room that the game has started
              socket.to(player.roomId).emit('game-started', { game, room });
              socket.emit('game-started', { game, room });
            }
          }
          
          callback({ success: true, game });
          console.log(`Game started in room: ${player?.roomId} by ${player?.nickname} (${maxRounds} rounds, min variance: ${minimumVariance})`);
        } catch (error: any) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('propose-topic', (data: any, callback: (response: any) => void) => {
        try {
          const result = this.lobbyController.proposeTopic(socket.id, data.topic);
          
          // Get the room to broadcast to all players
          const player = this.lobbyController.getPlayer(socket.id);
          if (player && player.roomId) {
            const game = this.lobbyController.getGame(player.roomId);
            
            // Broadcast topic proposed to all players
            socket.to(player.roomId).emit('topic-proposed', result);
            socket.emit('topic-proposed', result);
            
            // Check if all topics are proposed
            if (game && game.allTopicsProposed()) {
              game.startActualGame();
              setTimeout(() => {
                socket.to(player.roomId!).emit('all-topics-proposed', { gameState: game.getGameState() });
                socket.emit('all-topics-proposed', { gameState: game.getGameState() });
              }, 1000);
            }
          }
          
          callback({ success: true });
          console.log(`Topic proposed: "${data.topic}" by ${player?.nickname} in room: ${player?.roomId}`);
        } catch (error: any) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('propose-word', (data: any, callback: (response: any) => void) => {
        try {
          const result = this.lobbyController.proposeWord(socket.id, data.word, data.relatedTopic);
          
          // Get the room to broadcast to all players
          const player = this.lobbyController.getPlayer(socket.id);
          if (player && player.roomId) {
            // Broadcast word proposed to all players
            socket.to(player.roomId).emit('word-proposed', result);
            socket.emit('word-proposed', result);
            
            // Start vote timer
            setTimeout(() => {
              const game = this.lobbyController.getGame(player.roomId!);
              if (game && game.isVotingExpired()) {
                game.forceCompleteVoting();
                const gameState = game.getGameState();
                socket.to(player.roomId!).emit('voting-completed', { gameState });
                socket.emit('voting-completed', { gameState });
                
                // After showing results, move to next player's turn
                setTimeout(() => {
                  console.log('🔄 Timer-based next player turn...');
                  game.nextPlayerWordTurn();
                  const updatedGameState = game.getGameState();
                  console.log('🔄 Next player:', updatedGameState.currentPlayerTurn, 'State:', updatedGameState.state);
                  socket.to(player.roomId!).emit('next-player-turn', { gameState: updatedGameState });
                  socket.emit('next-player-turn', { gameState: updatedGameState });
                }, 3000); // Show results for 3 seconds
              }
            }, 30000); // 30 second vote timer
          }
          
          callback({ success: true });
          console.log(`Word proposed: "${data.word}" (${data.relatedTopic}) by ${player?.nickname} in room: ${player?.roomId}`);
        } catch (error: any) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('vote-on-word', (data: any, callback: (response: any) => void) => {
        try {
          // Get the room and game before voting (so we can check state before it changes)
          const player = this.lobbyController.getPlayer(socket.id);
          if (!player || !player.roomId) {
            callback({ success: false, error: 'Player not found or not in room' });
            return;
          }

          const game = this.lobbyController.getGame(player.roomId);
          if (!game) {
            callback({ success: false, error: 'Game not found' });
            return;
          }

          // Check voting state before the vote
          const wasVotingComplete = !game.currentVotingRound || game.currentVotingRound.isComplete;
          const votesBefore = game.currentVotingRound ? game.currentVotingRound.votes.length : 0;
          const expectedVoters = game.players.length - 1;

          // Cast the vote
          const result = this.lobbyController.voteOnWord(socket.id, data.score);
          
          // Broadcast vote to all players
          socket.to(player.roomId).emit('vote-cast', result);
          socket.emit('vote-cast', result);
          
          // Check if voting just completed with this vote
          const votingJustCompleted = !wasVotingComplete && (votesBefore + 1 >= expectedVoters);
          console.log('🗳️ Vote cast:', data.score, 'Votes before:', votesBefore, 'Expected:', expectedVoters, 'Just completed?', votingJustCompleted);
          
          if (votingJustCompleted) {
            console.log('🗳️ Voting just completed! Broadcasting results...');
            const gameState = game.getGameState();
            socket.to(player.roomId).emit('voting-completed', { gameState });
            socket.emit('voting-completed', { gameState });
            
            // After showing results, move to next player's turn
            setTimeout(() => {
              console.log('🔄 Moving to next player turn...');
              game.nextPlayerWordTurn();
              const updatedGameState = game.getGameState();
              if (updatedGameState.state == GAME_STATES.FINISHED) {
                // socket.to(player.roomId!).emit('game-ended', { gameState: updatedGameState });
                // socket.emit('game-ended', { gameState: updatedGameState });
                io.to(player.roomId!).emit('game-ended', { gameState: updatedGameState })
                return; // Don't send next-player-turn if game is finished
              }
              console.log('🔄 Next player:', updatedGameState.currentPlayerTurn, 'State:', updatedGameState.state);
              socket.to(player.roomId!).emit('next-player-turn', { gameState: updatedGameState });
              socket.emit('next-player-turn', { gameState: updatedGameState });
            }, 3000); // Show results for 3 seconds
          }
          
          callback({ success: true });
          console.log(`Vote cast: ${data.score} by ${player?.nickname} in room: ${player?.roomId}`);
        } catch (error: any) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('get-game-state', (callback: (response: any) => void) => {
        try {
          const gameState = this.lobbyController.getGameState(socket.id);
          callback({ success: true, gameState });
        } catch (error: any) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on('disconnect', () => {
        const player = this.lobbyController.getPlayer(socket.id);
        const nickname = player ? player.nickname : 'anonymous';
        console.log(`Player disconnected: ${nickname} (${socket.id})`);
        this.handleLeaveRoom(socket);
      });
    });
  }

  handleLeaveRoom(socket: Socket) {
    const result = this.lobbyController.leaveRoom(socket.id);
    
    if (result && result.room) {
      // Use the main io instance to broadcast to all other players in the room
      if (this.io) {
        this.io.to(result.room.id).emit('player-left', { 
          player: result.player, 
          room: result.room
        });
      }
      
      console.log(`${result.player.nickname} left room: ${result.room.id}`);
    }
  }
}

export default new SocketService();
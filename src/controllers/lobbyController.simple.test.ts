import LobbyController from './lobbyController';

// Create a simple integration test without mocking
describe('LobbyController Integration Tests', () => {
  let lobbyController: LobbyController;
  let mockSocket: any;

  beforeEach(() => {
    lobbyController = new LobbyController();
    mockSocket = {
      id: 'socket123',
      join: jest.fn()
    };
  });

  describe('Room Management', () => {
    test('should create a room successfully', () => {
      const result = lobbyController.createRoom(mockSocket, 'TestPlayer');
      
      expect(result.room).toBeDefined();
      expect(result.player).toBeDefined();
      expect(result.room.players).toHaveLength(1);
      expect(result.player.nickname).toBe('TestPlayer');
      expect(result.player.isHost).toBe(true);
      expect(mockSocket.join).toHaveBeenCalled();
    });

    test('should allow joining an existing room', () => {
      // Create a room first
      const hostResult = lobbyController.createRoom(mockSocket, 'Host');
      const roomId = hostResult.room.id;
      
      // Second player joins
      const secondSocket = { id: 'socket456', join: jest.fn() };
      const result = lobbyController.joinRoom(secondSocket, roomId, 'Player2');
      
      expect(result.room.players).toHaveLength(2);
      expect(result.player.nickname).toBe('Player2');
      expect(result.player.isHost).toBe(false);
      expect(secondSocket.join).toHaveBeenCalledWith(roomId);
    });

    test('should throw error when joining non-existent room', () => {
      expect(() => {
        lobbyController.joinRoom(mockSocket, 'fake-room-id', 'TestPlayer');
      }).toThrow('Room not found');
    });

    test('should throw error when nickname is taken', () => {
      const hostResult = lobbyController.createRoom(mockSocket, 'TestPlayer');
      const roomId = hostResult.room.id;
      
      const secondSocket = { id: 'socket456', join: jest.fn() };
      
      expect(() => {
        lobbyController.joinRoom(secondSocket, roomId, 'TestPlayer');
      }).toThrow('Nickname already taken in this room');
    });

    test('should remove player and clean up empty room', () => {
      lobbyController.createRoom(mockSocket, 'TestPlayer');
      
      const result = lobbyController.leaveRoom('socket123');
      
      expect(result).toBeDefined();
      expect(result?.player.nickname).toBe('TestPlayer');
      
      // Room should be deleted when empty
      const roomId = result?.room.id;
      if (roomId) {
        expect(lobbyController.getRoom(roomId)).toBeUndefined();
      }
    });

    test('should transfer host when host leaves', () => {
      // Create room with host
      const hostResult = lobbyController.createRoom(mockSocket, 'Host');
      const roomId = hostResult.room.id;
      
      // Add second player
      const secondSocket = { id: 'socket456', join: jest.fn() };
      lobbyController.joinRoom(secondSocket, roomId, 'Player2');
      
      // Host leaves
      lobbyController.leaveRoom('socket123');
      
      // Check that Player2 is now host
      const room = lobbyController.getRoom(roomId);
      expect(room).toBeDefined();
      expect(room?.players[0].isHost).toBe(true);
      expect(room?.players[0].nickname).toBe('Player2');
    });
  });

  describe('Utility Methods', () => {
    test('should get room by ID', () => {
      const result = lobbyController.createRoom(mockSocket, 'TestPlayer');
      const roomId = result.room.id;
      
      const room = lobbyController.getRoom(roomId);
      expect(room).toBeDefined();
      expect(room?.id).toBe(roomId);
    });

    test('should get player by socket ID', () => {
      lobbyController.createRoom(mockSocket, 'TestPlayer');
      
      const player = lobbyController.getPlayer('socket123');
      expect(player).toBeDefined();
      expect(player?.nickname).toBe('TestPlayer');
    });

    test('should get room players', () => {
      const result = lobbyController.createRoom(mockSocket, 'TestPlayer');
      const roomId = result.room.id;
      
      const players = lobbyController.getRoomPlayers(roomId);
      expect(players).toHaveLength(1);
      expect(players[0].nickname).toBe('TestPlayer');
    });

    test('should return room list', () => {
      lobbyController.createRoom(mockSocket, 'TestPlayer');
      
      const roomList = lobbyController.getRoomList();
      expect(roomList).toHaveLength(1);
      expect(roomList[0]).toHaveProperty('id');
      expect(roomList[0]).toHaveProperty('playerCount', 1);
      expect(roomList[0]).toHaveProperty('maxPlayers', 8);
      expect(roomList[0]).toHaveProperty('hasGame', false);
    });
  });

  describe('Game Management', () => {
    test('should throw error when non-host tries to start game', () => {
      // Create room with host
      lobbyController.createRoom(mockSocket, 'Host');
      
      // Add second player
      const secondSocket = { id: 'socket456', join: jest.fn() };
      const hostResult = lobbyController.createRoom(mockSocket, 'Host');
      lobbyController.joinRoom(secondSocket, hostResult.room.id, 'Player2');
      
      expect(() => {
        lobbyController.startGame('socket456');
      }).toThrow('Only host can start the game');
    });

    test('should throw error with insufficient players', () => {
      lobbyController.createRoom(mockSocket, 'Host');
      
      expect(() => {
        lobbyController.startGame('socket123');
      }).toThrow('Need at least 2 players to start');
    });
  });

  describe('Player Reconnection', () => {
    test('should throw error when reconnecting to non-existent room', () => {
      expect(() => {
        lobbyController.reconnectPlayer(mockSocket, 'fake-room', 'fake-player');
      }).toThrow('Room not found');
    });

    test('should throw error when player not found in room', () => {
      const result = lobbyController.createRoom(mockSocket, 'TestPlayer');
      const roomId = result.room.id;
      
      expect(() => {
        lobbyController.reconnectPlayer(mockSocket, roomId, 'fake-player-id');
      }).toThrow('Player not found');
    });
  });
});
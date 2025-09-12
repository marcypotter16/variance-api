import { v4 as uuidv4 } from 'uuid';
import Room from '../models/Room';
import Player from '../models/Player';
import { Game } from '../models/Game';


interface Socket {
  id: string;
  join(roomId: string): void;
}

interface PlayerData {
  room: Room;
  player: Player;
}

interface ReconnectData {
  room: Room;
  player: Player;
  game: Game | undefined;
}

interface RoomListItem {
  id: string;
  playerCount: number;
  maxPlayers: number;
  hasGame: boolean;
}

class LobbyController {
  private rooms: Map<string, Room>;
  private players: Map<string, Player>;
  private games: Map<string, Game>;

  constructor() {
    this.rooms = new Map();
    this.players = new Map();
    this.games = new Map();
  }

  createRoom(socket: Socket, nickname: string): PlayerData {
    const roomId = uuidv4();
    const player = new Player(socket.id, nickname);
    player.isHost = true;

    this.players.set(socket.id, player);
    const room: Room = {
      id: roomId,
      players: [player],
      maxPlayers: 8,
      createdAt: Date.now()
    };
    this.rooms.set(roomId, room);

    socket.join(roomId);
    player.roomId = roomId;

    return { room, player };
  }

  joinRoom(socket: Socket, roomId: string, nickname: string): PlayerData {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    if (room.players.some(p => p.nickname === nickname)) {
      throw new Error('Nickname already taken in this room');
    }

    const player = new Player(socket.id, nickname);
    this.players.set(socket.id, player);
    
    room.players.push(player);
    socket.join(roomId);
    player.roomId = roomId;

    return { room, player };
  }

  leaveRoom(socketId: string): { room: Room; player: Player } | null {
    const player = this.players.get(socketId);
    if (!player || !player.roomId) return null;

    const room = this.rooms.get(player.roomId);
    if (!room) return null;

    room.players = room.players.filter(p => p.id !== player.id);

    if (room.players.length === 0) {
      this.rooms.delete(player.roomId);
      this.games.delete(player.roomId);
    } else if (player.isHost && room.players.length > 0) {
      room.players[0].isHost = true;
      
      const game = this.games.get(player.roomId);
      if (game) {
        game.hostId = room.players[0].id;
      }
    }

    this.players.delete(socketId);
    return { room, player };
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getPlayer(socketId: string): Player | undefined {
    return this.players.get(socketId);
  }

  getRoomPlayers(roomId: string): Player[] {
    const room = this.rooms.get(roomId);
    return room ? room.players : [];
  }

  startGame(socketId: string): Game {
    const player = this.players.get(socketId);
    if (!player || !player.isHost) {
      throw new Error('Only host can start the game');
    }

    if (!player.roomId) {
      throw new Error('Player not in a room');
    }

    const room = this.rooms.get(player.roomId);
    if (!room || room.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    let game = this.games.get(player.roomId);
    if (!game) {
      game = new Game(player.roomId, player.id);
      room.players.forEach(p => game!.addPlayer(p));
      this.games.set(player.roomId, game);
    }

    if (game.startGame()) {
      return game;
    } else {
      throw new Error('Could not start game');
    }
  }

  getGame(roomId: string): Game | undefined {
    return this.games.get(roomId);
  }

  reconnectPlayer(socket: Socket, roomId: string, playerId: string): ReconnectData {
    const room = this.rooms.get(roomId);
    const game = this.games.get(roomId);
    
    if (!room) throw new Error('Room not found');
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    
    const oldSocketId = player.socketId;
    player.reconnect(socket.id);
    
    this.players.delete(oldSocketId);
    this.players.set(socket.id, player);
    
    socket.join(roomId);
    
    return { room, player, game };
  }

  getRoomList(): RoomListItem[] {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      hasGame: this.games.has(room.id)
    }));
  }
}

export default LobbyController
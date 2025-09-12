import LobbyController from './lobbyController';
import { Topic } from '../models/Category';
import Player from '../models/Player';

export interface PlayerTopic {
  playerId: string;
  playerName: string;
  topic: Topic;
}

export interface CategoryChoosingState {
  roomId: string;
  totalPlayers: number;
  submittedTopics: PlayerTopic[];
  playersWhoSubmitted: Set<string>;
  canStartGame: boolean;
  currentPlayerTurn?: string;
}

class CategoryChoosingController {
  private lobbyController: LobbyController;
  private gameTimers: Map<string, NodeJS.Timeout>;
  private roomId: string;
  private submittedTopics: PlayerTopic[];
  private playersWhoSubmitted: Set<string>;
  private players: Player[];
  private canStartGame: boolean;

  constructor(lobbyController: LobbyController, roomId: string) {
    this.lobbyController = lobbyController;
    this.roomId = roomId;
    this.gameTimers = new Map();
    this.submittedTopics = [];
    this.playersWhoSubmitted = new Set();
    this.players = this.lobbyController.getRoomPlayers(this.roomId);
    this.canStartGame = false;
  }

  proposeTopic(socketId: string, topic: Topic): { success: boolean; message: string; state: CategoryChoosingState } {
    // Validate player
    const player = this.lobbyController.getPlayer(socketId);
    if (!player) {
      throw new Error('Player not found');
    }

    if (player.roomId !== this.roomId) {
      throw new Error('Player not in this room');
    }

    // Check if player already submitted a topic
    if (this.playersWhoSubmitted.has(player.id)) {
      return {
        success: false,
        message: 'You have already submitted a topic',
        state: this.getState()
      };
    }

    // Validate topic
    if (!topic.name || topic.name.trim().length === 0) {
      return {
        success: false,
        message: 'Topic name cannot be empty',
        state: this.getState()
      };
    }

    if (topic.name.trim().length > 50) {
      return {
        success: false,
        message: 'Topic name too long (max 50 characters)',
        state: this.getState()
      };
    }

    // Add the topic
    const playerTopic: PlayerTopic = {
      playerId: player.id,
      playerName: player.nickname,
      topic: { name: topic.name.trim() }
    };

    this.submittedTopics.push(playerTopic);
    this.playersWhoSubmitted.add(player.id);

    // Check if all players have submitted
    if (this.playersWhoSubmitted.size === this.players.length) {
      this.canStartGame = true;
    }

    return {
      success: true,
      message: 'Topic submitted successfully',
      state: this.getState()
    };
  }

  startGame(socketId: string): { success: boolean; message: string; topics: PlayerTopic[] } {
    const player = this.lobbyController.getPlayer(socketId);
    if (!player || !player.isHost) {
      throw new Error('Only the host can start the game');
    }

    if (!this.canStartGame) {
      return {
        success: false,
        message: `Waiting for ${this.players.length - this.playersWhoSubmitted.size} more players to submit topics`,
        topics: this.submittedTopics
      };
    }

    // TODO: Integrate with your main game logic
    return {
      success: true,
      message: 'Game started with all topics!',
      topics: this.submittedTopics
    };
  }

  getState(): CategoryChoosingState {
    return {
      roomId: this.roomId,
      totalPlayers: this.players.length,
      submittedTopics: this.submittedTopics,
      playersWhoSubmitted: this.playersWhoSubmitted,
      canStartGame: this.canStartGame
    };
  }

  getTopics(): PlayerTopic[] {
    return [...this.submittedTopics];
  }

  hasPlayerSubmitted(playerId: string): boolean {
    return this.playersWhoSubmitted.has(playerId);
  }

  cleanup(): void {
    this.gameTimers.forEach(timer => clearTimeout(timer));
    this.gameTimers.clear();
  }
}

export default CategoryChoosingController;
import { v4 as uuidv4 } from 'uuid';
import Player from './Player';

export enum GAME_STATES {
  WAITING = 'waiting',
  PLAYING = 'playing',
  PAUSED = 'paused',
  FINISHED = 'finished'
}

export interface PlayerState {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  connected: boolean;
}

export interface GameState {
  id: string;
  roomId: string;
  state: GAME_STATES;
  players: PlayerState[];
  round: number;
  maxRounds: number;
  hostId: string;
}

export class Game {
  public id: string;
  public roomId: string;
  public hostId: string;
  public state: GAME_STATES;
  public players: Player[];
  public round: number;
  public maxRounds: number;
  public createdAt: Date;

  constructor(roomId: string, hostId: string) {
    this.id = uuidv4();
    this.roomId = roomId;
    this.hostId = hostId;
    this.state = GAME_STATES.WAITING;
    this.players = [];
    this.round = 0;
    this.maxRounds = 5;
    this.createdAt = new Date();
  }

  addPlayer(player: Player): void {
    if (!this.players.find(p => p.id === player.id)) {
      this.players.push(player);
      player.roomId = this.roomId;
    }
  }

  removePlayer(playerId: string): void {
    this.players = this.players.filter(p => p.id !== playerId);
    if (this.hostId === playerId && this.players.length > 0) {
      this.hostId = this.players[0].id;
      this.players[0].isHost = true;
    }
  }

  startGame(): boolean {
    if (this.players.length < 2) return false;
    
    this.state = GAME_STATES.PLAYING;
    this.round = 1;
    this.resetPlayerScores();
    return true;
  }

  pauseGame(): void {
    this.state = GAME_STATES.PAUSED;
  }

  resumeGame(): void {
    if (this.state === GAME_STATES.PAUSED) {
      this.state = GAME_STATES.PLAYING;
    }
  }

  nextRound(): boolean {
    if (this.round >= this.maxRounds) {
      this.endGame();
      return false;
    }
    this.round++;
    return true;
  }

  endGame(): void {
    this.state = GAME_STATES.FINISHED;
    this.players.sort((a, b) => b.score - a.score);
  }

  resetPlayerScores(): void {
    this.players.forEach(player => player.resetScore());
  }

  getWinner(): Player | null {
    if (this.state !== GAME_STATES.FINISHED) return null;
    return this.players.length > 0 ? this.players[0] : null;
  }

  getGameState(): GameState {
    return {
      id: this.id,
      roomId: this.roomId,
      state: this.state,
      players: this.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        isHost: p.isHost,
        connected: p.connected
      })),
      round: this.round,
      maxRounds: this.maxRounds,
      hostId: this.hostId
    };
  }

  isHost(playerId: string): boolean {
    return this.hostId === playerId;
  }

  canStart(): boolean {
    return this.players.length >= 2 && this.state === GAME_STATES.WAITING;
  }
}
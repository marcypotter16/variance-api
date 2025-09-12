import { v4 as uuidv4 } from 'uuid';

class Player {
  public id: string;
  public socketId: string;
  public nickname: string;
  public roomId: string | null;
  public score: number;
  public isHost: boolean;
  public connected: boolean;
  public joinedAt: Date;

  constructor(socketId: string, nickname: string) {
    this.id = uuidv4();
    this.socketId = socketId;
    this.nickname = nickname;
    this.roomId = null;
    this.score = 0;
    this.isHost = false;
    this.connected = true;
    this.joinedAt = new Date();
  }

  updateScore(points: number): void {
    this.score += points;
  }

  disconnect(): void {
    this.connected = false;
  }

  reconnect(socketId: string): void {
    this.socketId = socketId;
    this.connected = true;
  }

  resetScore(): void {
    this.score = 0;
  }
}

export default Player;
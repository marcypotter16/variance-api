import LobbyController from './lobbyController';
import { Game, GameState } from '../models/Game';

class GameController {
  private lobbyController: LobbyController;
  private gameTimers: Map<string, NodeJS.Timeout>;

  constructor(lobbyController: LobbyController) {
    this.lobbyController = lobbyController;
    this.gameTimers = new Map();
  }

  vote(socketId: string, option: any): any {
    const player = this.lobbyController.getPlayer(socketId);
    if (!player) throw new Error('Player not found');

    const game = this.lobbyController.getGame(player.roomId!);
    if (!game) throw new Error('Game not found');

    // TODO: Implement voting logic based on your game requirements
    return { game, player, option };
  }






  clearTimer(roomId: string): void {
    const timer = this.gameTimers.get(roomId);
    if (timer) {
      clearInterval(timer);
      this.gameTimers.delete(roomId);
    }
  }

  endGame(socketId: string): Game {
    const player = this.lobbyController.getPlayer(socketId);
    if (!player || !player.isHost) {
      throw new Error('Only host can end the game');
    }

    const game = this.lobbyController.getGame(player.roomId!);
    if (!game) throw new Error('Game not found');

    this.clearTimer(game.roomId);
    game.endGame();
    
    return game;
  }

  getGameState(socketId: string): GameState {
    const player = this.lobbyController.getPlayer(socketId);
    if (!player) throw new Error('Player not found');

    const game = this.lobbyController.getGame(player.roomId!);
    if (!game) throw new Error('Game not found');

    return game.getGameState();
  }


  cleanup(roomId: string): void {
    this.clearTimer(roomId);
  }
}

export default GameController;
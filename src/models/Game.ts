import { v4 as uuidv4 } from 'uuid';
import Player from './Player';

export enum GAME_STATES {
  WAITING = 'waiting',
  PROPOSING_TOPICS = 'proposing_topics',
  PLAYING = 'playing',
  WORD_PROPOSED = 'word_proposed',
  VOTING = 'voting',
  VOTING_RESULTS = 'voting_results',
  PAUSED = 'paused',
  FINISHED = 'finished'
}

export interface Topic {
  id: string;
  text: string;
  proposedBy: string;
  proposerNickname: string;
}

export interface ProposedWord {
  id: string;
  word: string;
  proposedBy: string;
  proposerNickname: string;
  relatedTopic: string;
  proposedAt: Date;
}

export interface Vote {
  playerId: string;
  playerNickname: string;
  wordId: string;
  score: number;
  votedAt: Date;
}

export interface VotingRound {
  id: string;
  word: ProposedWord;
  votes: Vote[];
  voteTimer: number;
  voteDeadline: Date | null;
  isComplete: boolean;
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
  topics: Topic[];
  currentPlayerTurn: string;
  currentVotingRound: VotingRound | null;
  completedRounds: VotingRound[];
  round: number;
  maxRounds: number;
  minimumVariance: boolean;
  hostId: string;
}

export class Game {
  public id: string;
  public roomId: string;
  public hostId: string;
  public state: GAME_STATES;
  public players: Player[];
  public topics: Topic[];
  public currentPlayerTurn: string;
  public currentPlayerIndex: number;
  public currentVotingRound: VotingRound | null;
  public completedRounds: VotingRound[];
  public voteTimerDuration: number;
  public round: number;
  public maxRounds: number;
  public minimumVariance: boolean;
  public createdAt: Date;

  constructor(roomId: string, hostId: string, maxRounds: number = 5, minimumVariance: boolean = false) {
    this.id = uuidv4();
    this.roomId = roomId;
    this.hostId = hostId;
    this.state = GAME_STATES.WAITING;
    this.players = [];
    this.topics = [];
    this.currentPlayerTurn = '';
    this.currentPlayerIndex = 0;
    this.currentVotingRound = null;
    this.completedRounds = [];
    this.voteTimerDuration = 30; // 30 seconds for voting
    this.round = 0;
    this.maxRounds = maxRounds;
    this.minimumVariance = minimumVariance;
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
    
    this.state = GAME_STATES.PROPOSING_TOPICS;
    this.round = 1;
    this.resetPlayerScores();
    this.setFirstPlayerTurn();
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
    
    // Sort players based on game mode
    if (this.minimumVariance) {
      // In minimum variance mode, lower scores are better
      this.players.sort((a, b) => a.score - b.score);
    } else {
      // In maximum variance mode, higher scores are better
      this.players.sort((a, b) => b.score - a.score);
    }
  }

  resetPlayerScores(): void {
    this.players.forEach(player => player.resetScore());
  }

  getWinner(): Player | null {
    if (this.state !== GAME_STATES.FINISHED) return null;
    return this.players.length > 0 ? this.players[0] : null;
  }

  setFirstPlayerTurn(): void {
    if (this.players.length > 0) {
      this.currentPlayerIndex = 0;
      this.currentPlayerTurn = this.players[0].nickname;
    }
  }

  proposeTopic(playerId: string, topicText: string): Topic | null {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;
    
    if (player.nickname !== this.currentPlayerTurn) return null;
    
    if (this.topics.some(t => t.proposedBy === playerId)) return null;

    const topic: Topic = {
      id: uuidv4(),
      text: topicText,
      proposedBy: playerId,
      proposerNickname: player.nickname
    };

    this.topics.push(topic);
    this.nextPlayerTurn();
    
    return topic;
  }

  nextPlayerTurn(): void {
    if (this.players.length === 0) return;
    
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.currentPlayerTurn = this.players[this.currentPlayerIndex].nickname;
  }

  allTopicsProposed(): boolean {
    return this.topics.length === this.players.length;
  }

  startActualGame(): void {
    if (this.allTopicsProposed()) {
      this.state = GAME_STATES.PLAYING;
      this.setFirstPlayerTurn(); // Reset turn order for word proposals
    }
  }

  proposeWord(playerId: string, word: string, relatedTopic: string): ProposedWord | null {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;
    
    if (player.nickname !== this.currentPlayerTurn) return null;
    
    if (this.state !== GAME_STATES.PLAYING) return null;

    // Check if topic exists
    const topicExists = this.topics.some(t => t.text === relatedTopic);
    if (!topicExists) return null;

    const proposedWord: ProposedWord = {
      id: uuidv4(),
      word: word.trim(),
      proposedBy: playerId,
      proposerNickname: player.nickname,
      relatedTopic,
      proposedAt: new Date()
    };

    // Start voting round
    this.currentVotingRound = {
      id: uuidv4(),
      word: proposedWord,
      votes: [],
      voteTimer: this.voteTimerDuration,
      voteDeadline: new Date(Date.now() + this.voteTimerDuration * 1000),
      isComplete: false
    };

    this.state = GAME_STATES.VOTING;
    
    return proposedWord;
  }

  voteOnWord(playerId: string, score: number): Vote | null {
    if (!this.currentVotingRound) return null;
    
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;

    // The person who proposed the word cannot vote
    if (playerId === this.currentVotingRound.word.proposedBy) return null;

    // Check if player already voted
    if (this.currentVotingRound.votes.some(v => v.playerId === playerId)) return null;

    // Validate score (1-10)
    if (score < 1 || score > 10 || !Number.isInteger(score)) return null;

    const vote: Vote = {
      playerId,
      playerNickname: player.nickname,
      wordId: this.currentVotingRound.word.id,
      score,
      votedAt: new Date()
    };

    this.currentVotingRound.votes.push(vote);

    // Check if all players (except proposer) have voted
    const expectedVoters = this.players.length - 1; // All except the proposer
    console.log('🗳️ Vote added. Current votes:', this.currentVotingRound.votes.length, 'Expected:', expectedVoters);
    if (this.currentVotingRound.votes.length >= expectedVoters) {
      console.log('🗳️ All votes received, completing voting round...');
      this.completeVotingRound();
    }

    return vote;
  }

  completeVotingRound(): void {
    if (!this.currentVotingRound) return;

    this.currentVotingRound.isComplete = true;
    this.state = GAME_STATES.VOTING_RESULTS;

    // Calculate average score and update player score
    const totalScore = this.currentVotingRound.votes.reduce((sum, vote) => sum + vote.score, 0);
    const averageScore = this.currentVotingRound.votes.length > 0 ? 
      totalScore / this.currentVotingRound.votes.length : 0;
    const variance = this.currentVotingRound.votes.reduce((sum, vote) => sum + (vote.score - averageScore) * (vote.score - averageScore), 0)

    // Add score to the word proposer based on game mode
    const proposer = this.players.find(p => p.id === this.currentVotingRound!.word.proposedBy);
    if (proposer) {
      if (this.minimumVariance) {
        // In minimum variance mode, lower variance is better, so we subtract variance
        // We also add a base score so scores don't go negative
        const score = Math.max(0, 10 - variance);
        proposer.updateScore(score);
      } else {
        // In maximum variance mode, higher variance is better
        proposer.updateScore(variance);
      }
    }

    // Move completed round to history
    this.completedRounds.push(this.currentVotingRound);
    this.currentVotingRound = null;
  }

  nextPlayerWordTurn(): void {
    // Check if round should end (all players have proposed a word this round)
    if (this.completedRounds.length >= this.players.length) {
      // Start new round
      if (this.round >= this.maxRounds) {
        this.endGame();
        return;
      }
      
      this.round++;
      this.completedRounds = []; // Reset completed rounds for new round
      this.setFirstPlayerTurn(); // Reset to first player
    } else {
      // Move to next player
      this.nextPlayerTurn();
    }
    
    this.state = GAME_STATES.PLAYING;
  }

  forceCompleteVoting(): void {
    if (this.currentVotingRound && !this.currentVotingRound.isComplete) {
      this.completeVotingRound();
    }
  }

  isVotingExpired(): boolean {
    if (!this.currentVotingRound || !this.currentVotingRound.voteDeadline) return false;
    return new Date() > this.currentVotingRound.voteDeadline;
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
      topics: this.topics,
      currentPlayerTurn: this.currentPlayerTurn,
      currentVotingRound: this.currentVotingRound,
      completedRounds: this.completedRounds,
      round: this.round,
      maxRounds: this.maxRounds,
      minimumVariance: this.minimumVariance,
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
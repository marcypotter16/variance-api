import Player from './Player';

interface Room {
    id: string;
    players: Array<Player>;
    maxPlayers: number;
    createdAt: number;
}

export default Room;
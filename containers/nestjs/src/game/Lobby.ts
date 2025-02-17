import { Server, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { UserService } from '../user/user.service';
import { APong } from './APong';
import NormalPong from './NormalPong';
import SpecialPong from './SpecialPong';
import { MatchService } from '../user/match.service';
import { WsException } from '@nestjs/websockets';
import { User } from '../user/user.entity';
import { Gamemode } from '../user/match.entity';

export default class Lobby {
  public readonly id: string = uuid();

  private readonly maxClients = 2;

  public readonly clients = new Map<string, Socket>();

  public inviterIntraId = -1;
  public invitedIntraId = -1;

  private leftPlayerIntraId: number;
  private rightPlayerIntraId: number;

  public pong: APong;

  private readonly gamemodes: Map<string, (scoreToWin: number) => APong> =
    new Map([
      [Gamemode.NORMAL, (scoreToWin: number) => new NormalPong(scoreToWin)],
      [Gamemode.SPECIAL, (scoreToWin: number) => new SpecialPong(scoreToWin)],
    ]);

  private gameHasStarted = false;

  constructor(
    readonly gamemode: Gamemode,
    readonly isPrivate: boolean,
    private readonly server: Server,
    private readonly userService: UserService,
    private readonly matchService: MatchService,
  ) {
    console.log('Initializing lobby with gamemode:', gamemode);
    if (!this.gamemodes.has(gamemode)) {
      throw new WsException('Requested gamemode does not exist');
    }
    this.pong = this.gamemodes.get(gamemode)(3);
  }

  public async addClient(client: Socket) {
    client.data.playerIndex = this.clients.size;

    if (client.data.playerIndex === 0) {
      this.leftPlayerIntraId = client.data.intra_id;
    } else {
      this.rightPlayerIntraId = client.data.intra_id;
    }

    this.clients.set(client.data.intra_id, client);

    await client.join(this.id);

    if (this.isFull()) {
      this.gameHasStarted = true;
      this.emit('gameStart');
    }
  }

  public removeClient(client: Socket) {
    this.clients.delete(client.data.intra_id);
    client.leave(this.id);
  }

  public hasUser(user: any) {
    return this.clients.has(user.intra_id);
  }

  public isFull() {
    return this.clients.size >= this.maxClients;
  }

  public update() {
    if (!this.gameHasStarted) {
      return;
    }

    this.pong.update();

    this.emit('pong', this.pong.getData());

    if (this.pong.didSomeoneWin()) {
      this.saveMatch(null);

      const winnerIndex = this.pong.getWinnerIndex();

      this.clients.forEach(async (client) => {
        if (client.data.playerIndex === this.pong.getWinnerIndex()) {
          this.userService.addWin(client.data.intra_id);
        } else {
          this.userService.addLoss(client.data.intra_id);
        }

        client.emit('gameOver', client.data.playerIndex === winnerIndex);
      });
    }
  }

  public didSomeoneWin() {
    return this.pong.didSomeoneWin();
  }

  public disconnectClients() {
    this.clients.forEach((client) => {
      this.removeClient(client);
    });
  }

  public emit(event: string, payload?: any) {
    this.server.to(this.id).emit(event, payload);
  }

  public movePaddle(playerIndex: number, keydown: boolean, north: boolean) {
    if (!this.gameHasStarted) {
      return;
    }

    this.pong.movePaddle(playerIndex, keydown, north);
  }

  public async saveMatch(disconnectedPlayer: User | null) {
    await this.matchService.create(
      await this.userService.findOne(this.leftPlayerIntraId),
      await this.userService.findOne(this.rightPlayerIntraId),
      disconnectedPlayer,
      this.pong.getLeftPlayerScore(),
      this.pong.getRightPlayerScore(),
      this.pong.gamemode,
    );
  }
}

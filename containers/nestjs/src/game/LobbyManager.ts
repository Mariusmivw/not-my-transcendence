import { Server, Socket } from 'socket.io';
import Lobby from './Lobby';
import { WsException } from '@nestjs/websockets';
import { UserService } from '../user/user.service';
import { MatchService } from '../user/match.service';
import { Gamemode } from '../user/match.entity';

export default class LobbyManager {
  private readonly lobbies = new Map<Lobby['id'], Lobby>();
  public readonly intraIdToLobby = new Map<number, Lobby>();

  private readonly updateIntervalMs = 1000 / 60;

  constructor(
    private readonly server: Server,
    private readonly userService: UserService,
    private readonly matchService: MatchService,
  ) {}

  public async queue(client: Socket, gamemode: Gamemode) {
    if (this.isUserAlreadyInLobby(client.data)) {
      console.error(`User ${client.data.intra_id} is already in a lobby`);
      throw new WsException('Already in a lobby');
    }

    client.emit('inQueue', { inQueue: true });

    const lobby = this.getLobby(gamemode);
    await lobby.addClient(client);
    this.intraIdToLobby.set(client.data.intra_id, lobby);
  }

  public async leaveQueue(client: Socket, clients: Map<number, Socket[]>) {
    const lobby = this.intraIdToLobby.get(client.data.intra_id);

    if (!lobby) {
      throw new WsException("Can't leave queue when not in a lobby");
    }

    this.removeClient(client);
    client.emit('inQueue', { inQueue: false });

    if (lobby.isPrivate) {
      const invitedSockets = clients.get(lobby.invitedIntraId);
      if (!invitedSockets) {
        throw new WsException('Invited user is not online');
      }

      await this.removeInvite(invitedSockets, lobby.invitedIntraId);
    }
  }

  private async removeInvite(invitedSockets: Socket[], invitedIntraId: number) {
    const invitations = await this.getInvitations(invitedIntraId);
    invitedSockets.forEach((socket) => {
      socket.emit('updateInvitations', invitations);
    });
  }

  public async createPrivateLobby(
    client: Socket,
    invitedIntraId: number,
    gamemode: Gamemode,
    invitedSockets: Socket[],
  ) {
    if (this.isUserAlreadyInLobby(client.data)) {
      console.error(`User ${client.data.intra_id} is already in a lobby`);
      throw new WsException('Already in a lobby');
    }

    const lobby = new Lobby(
      gamemode,
      true,
      this.server,
      this.userService,
      this.matchService,
    );

    lobby.inviterIntraId = client.data.intra_id;
    lobby.invitedIntraId = invitedIntraId;

    client.emit('inQueue', { inQueue: true });

    this.lobbies.set(lobby.id, lobby);
    await lobby.addClient(client);
    this.intraIdToLobby.set(client.data.intra_id, lobby);

    const invitations = await this.getInvitations(invitedIntraId);
    invitedSockets.forEach((socket) => {
      socket.emit('updateInvitations', invitations);
    });
  }

  private isUserAlreadyInLobby(user: any): boolean {
    return Array.from(this.lobbies.values()).some((lobby) =>
      lobby.hasUser(user),
    );
  }

  private getLobby(gamemode: Gamemode): Lobby {
    const notFullLobby = Array.from(this.lobbies.values()).find(
      (lobby) =>
        lobby.pong.gamemode === gamemode && !lobby.isFull() && !lobby.isPrivate,
    );
    if (notFullLobby) {
      console.log("Found a lobby that wasn't full");
      return notFullLobby;
    }

    const newLobby = new Lobby(
      gamemode,
      false,
      this.server,
      this.userService,
      this.matchService,
    );
    this.lobbies.set(newLobby.id, newLobby);
    console.log('Created a new lobby');
    return newLobby;
  }

  public movePaddle(
    intra_id: number,
    playerIndex: number,
    keydown: boolean,
    north: boolean,
  ) {
    const lobby = this.intraIdToLobby.get(intra_id);
    lobby?.movePaddle(playerIndex, keydown, north);
  }

  public async removeClient(client: Socket) {
    const lobby = this.intraIdToLobby.get(client.data.intra_id);

    if (lobby) {
      // If a client disconnect while queueing, lobby.clients.size is 1
      const client_count = lobby.clients.size;

      if (client_count >= 2) {
        lobby.saveMatch(await this.userService.findOne(client.data.intra_id));
        this.userService.addLoss(client.data.intra_id);
      }

      lobby.removeClient(client);

      // If one of the clients disconnects, the other client wins
      lobby.emit('gameOver', true);

      if (client_count >= 2) {
        lobby.clients.forEach((otherClient) => {
          this.userService.addWin(otherClient.data.intra_id);
        });
      }

      this.removeLobby(lobby);
    }
  }

  public startUpdateLoop() {
    setInterval(() => {
      this.lobbies.forEach((lobby) => {
        lobby.update();
        if (lobby.didSomeoneWin()) {
          this.removeLobby(lobby);
        }
      });
    }, this.updateIntervalMs);
  }

  private removeLobby(lobby: Lobby) {
    lobby.clients.forEach((client) => {
      this.intraIdToLobby.delete(client.data.intra_id);
    });

    lobby.disconnectClients();
    this.lobbies.delete(lobby.id);
  }

  public async getInvitations(intra_id: number) {
    const lobbiesArray = await Array.from(this.lobbies.values());

    return await Promise.all(
      lobbiesArray.flatMap(async (lobby) =>
        lobby.isPrivate && lobby.invitedIntraId === intra_id
          ? {
              inviterIntraId: lobby.inviterIntraId,
              inviterName: await this.userService.getUsername(
                lobby.inviterIntraId,
              ),
              gamemode: lobby.gamemode,
            }
          : [],
      ),
    );
  }
}

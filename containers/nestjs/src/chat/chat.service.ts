import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { Message } from './message.entity';
import { Mute } from './mute.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat) private readonly chatRepository: Repository<Chat>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Mute) private readonly muteRepository: Repository<Mute>,
    private readonly usersService: UsersService,
  ) {}

  create(intra_id: number, chat: Chat): Promise<Chat> {
    this.usersService.addToChat(intra_id, chat.chat_id, chat.name);

    return this.chatRepository.save(chat);
  }

  async addUser(chat_id: string, username: string) {
    console.log("chat_id: ", chat_id, "username: ", username)
    let user = await this.usersService.findOneByUsername(username);
    if (!user)
      return
    console.log("user: ", user)

    return this.chatRepository
      .findOne({ where: { chat_id }, relations: { users: true } })
      .then(async (chat) => {
        if (!chat) { return }
        console.log("chat: ", chat)
        chat.users.push(user.intra_id);
        await this.chatRepository.save(chat);
        console.log("chat users: ", chat.users);
      })
  }

  hashPassword(password: string) {
    // TODO: Hashing
    return password;
  }

  getName(chat_id: string) {
    return this.chatRepository.findOneBy({ chat_id }).then((chat) => {
      if (chat) {
        return chat.name;
      } else {
        throw new BadRequestException('Invalid chat_id');
      }
    });
  }

  getHistory(chat_id: string) {
    return this.chatRepository
    .findOne({ where: { chat_id }, relations: { history: true } })
    .then(async (chat) => {
      if (!chat) { return }

      return chat.history
    });
  }

  handleMessage(sender: number, chat_id: string, body: string) {
    return this.chatRepository
      .findOne({ where: { chat_id }, relations: { history: true } })
      .then(async (chat) => {
        if (!chat) { return false }

        const message = new Message();
        message.sender = sender;
        message.body = body;
        await this.messageRepository.save(message);

        chat.history = [...chat.history, message]
        let result = await this.chatRepository.save(chat)
        if (result)
          return true
      });
  }
}

import {
  Column,
  JoinColumn,
  JoinTable,
  Entity,
  ManyToMany,
  OneToMany,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { MyChat } from './mychat.entity';
import { Achievements } from './achievements.entity';
import { Match } from './match.entity';

@Entity()
export class User {
  @PrimaryColumn('int')
  intra_id: number;

  @Column()
  username: string;

  @Column()
  intra_name: string;

  @Column()
  email: string;

  @Column({ default: false })
  isTwoFactorAuthenticationEnabled: boolean;

  @Column({ nullable: true })
  twoFactorAuthenticationSecret: string | null;

  @OneToMany(() => MyChat, (my_chat) => my_chat.user)
  my_chats: MyChat[];

  @ManyToMany(() => User, (friend) => friend.friends)
  @JoinTable()
  friends: User[];

  @ManyToMany(() => User, (incoming) => incoming.outgoing_friend_requests)
  @JoinTable()
  incoming_friend_requests: User[];

  @ManyToMany(() => User, (outgoing) => outgoing.incoming_friend_requests)
  outgoing_friend_requests: User[];

  @Column('int', { default: 0 })
  wins: number;

  @Column('int', { default: 0 })
  losses: number;

  @Column()
  lastOnline: Date;

  @OneToOne(() => Achievements)
  @JoinColumn()
  achievements: Achievements;

  @ManyToMany(() => Match, (match) => match.players)
  @JoinTable()
  matchHistory: Match[];
}

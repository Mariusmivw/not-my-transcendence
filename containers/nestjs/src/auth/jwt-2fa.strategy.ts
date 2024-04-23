import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { User } from 'src/users/user.entity';

@Injectable()
export class Jwt2faStrategy extends PassportStrategy(Strategy, 'jwt-2fa') {
  constructor(private readonly userService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    const user: User = await this.userService.findOne(payload.intra_id);

    // If the database says that the user doesn't use 2FA, return the user
    if (!user.isTwoFactorAuthenticationEnabled) {
      return { intra_id: payload.sub };
    }

    // If the JWT says that the user doesn't use 2FA,
    // then 2FA has been enabled on another computer,
    // so we return null
    if (payload.isTwoFactorAuthenticated) {
      return {
        intra_id: payload.sub,
        twoFactorAuthenticationSecret: user.twoFactorAuthenticationSecret,
      };
    }
  }
}

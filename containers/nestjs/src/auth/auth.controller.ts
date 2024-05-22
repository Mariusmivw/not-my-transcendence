import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Redirect,
  Request,
  Response,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './auth.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Get('login')
  @Redirect()
  async login(@Request() req) {
    const code = req.query.code;

    // TODO: Add LoginDto and use it to check this for us
    if (code === undefined) {
      throw new UnauthorizedException(
        'Expected an authorization code parameter from the 42 API',
      );
    }

    const { jwt, isTwoFactorAuthenticationEnabled } =
      await this.authService.login(code);

    return {
      url:
        process.env.VITE_ADDRESS +
        ':' +
        process.env.FRONTEND_PORT +
        (isTwoFactorAuthenticationEnabled ? '/twofactor' : '/login') +
        `?jwt=${jwt}`,
      statusCode: 302,
    };
  }

  @Post('2fa/generate')
  async generate(@Response() response, @Request() request) {
    return this.authService.generate(request.user.intra_id, response);
  }

  @Post('2fa/turn-on')
  async turnOn(@Request() request, @Body() body) {
    this.authService.turnOn(
      request.user.intra_id,
      request.user.twoFactorAuthenticationSecret,
      body.twoFactorAuthenticationCode,
    );
  }

  @Post('2fa/turn-off')
  async turnOff(@Request() request, @Body() body) {
    return this.authService.turnOff(
      request.user.intra_id,
      request.user.twoFactorAuthenticationSecret,
      body.twoFactorAuthenticationCode,
    );
  }

  @Get('2fa/isEnabled')
  @HttpCode(200)
  @Public()
  @UseGuards(JwtAuthGuard)
  isEnabled(@Request() request) {
    return this.authService.isEnabled(request.user.intra_id);
  }

  @Post('2fa/authenticate')
  @HttpCode(200)
  @Public()
  @UseGuards(JwtAuthGuard)
  authenticate(@Request() request, @Body() body) {
    return this.authService.authenticate(
      request.user.intra_id,
      request.user.isTwoFactorAuthenticated,
      request.user.twoFactorAuthenticationSecret,
      body.twoFactorAuthenticationCode,
    );
  }
}

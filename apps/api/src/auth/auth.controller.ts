import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto, RegisterDto, Verify2FADto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @UseGuards(LocalAuthGuard)
    @Post('login')
    @ApiOperation({ summary: 'Login user' })
    @ApiResponse({ status: 200, description: 'Successfully logged in' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Request() req, @Body() loginDto: LoginDto) {
        return this.authService.login(req.user);
    }

    @Post('register')
    @ApiOperation({ summary: 'Register new user' })
    @ApiResponse({ status: 201, description: 'Successfully registered' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(
            registerDto.email,
            registerDto.password,
            registerDto.name,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Return user profile' })
    getProfile(@Request() req) {
        return req.user;
    }

    @UseGuards(JwtAuthGuard)
    @Post('2fa/setup')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Setup 2FA' })
    @ApiResponse({ status: 200, description: 'Returns QR code for 2FA setup' })
    async setup2FA(@Request() req) {
        return this.authService.setup2FA(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('2fa/verify')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Verify and enable 2FA' })
    @ApiResponse({ status: 200, description: '2FA enabled successfully' })
    @ApiResponse({ status: 401, description: 'Invalid token' })
    async verify2FA(@Request() req, @Body() verify2FADto: Verify2FADto) {
        return this.authService.verify2FA(req.user.userId, verify2FADto.token);
    }

    @UseGuards(JwtAuthGuard)
    @Post('2fa/disable')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Disable 2FA' })
    @ApiResponse({ status: 200, description: '2FA disabled successfully' })
    @ApiResponse({ status: 401, description: 'Invalid token' })
    async disable2FA(@Request() req, @Body() verify2FADto: Verify2FADto) {
        return this.authService.disable2FA(req.user.userId, verify2FADto.token);
    }
}

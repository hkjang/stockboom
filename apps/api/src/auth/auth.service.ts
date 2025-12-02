import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { UsersService } from '../users/users.service';
import { User } from '@stockboom/database';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    async validateUser(email: string, password: string): Promise<any> {
        const user = await this.usersService.findByEmail(email);

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is inactive');
        }

        const { passwordHash, ...result } = user;
        return result;
    }

    async login(user: User) {
        const payload = { email: user.email, sub: user.id };

        // Update last login
        await this.usersService.updateLastLogin(user.id);

        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                twoFactorEnabled: user.twoFactorEnabled,
            },
        };
    }

    async register(email: string, password: string, name?: string) {
        const existingUser = await this.usersService.findByEmail(email);

        if (existingUser) {
            throw new UnauthorizedException('Email already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await this.usersService.create({
            email,
            passwordHash: hashedPassword,
            name,
        });

        return this.login(user);
    }

    async setup2FA(userId: string) {
        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (user.twoFactorEnabled) {
            throw new UnauthorizedException('2FA is already enabled');
        }

        // Generate secret
        const secret = authenticator.generateSecret();

        // Save secret (temporarily)
        await this.usersService.update(userId, {
            twoFactorSecret: secret,
        });

        // Generate QR code
        const otpauthUrl = authenticator.keyuri(
            user.email,
            'StockBoom',
            secret,
        );

        const qrCodeDataUrl = await toDataURL(otpauthUrl);

        return {
            secret,
            qrCode: qrCodeDataUrl,
        };
    }

    async verify2FA(userId: string, token: string) {
        const user = await this.usersService.findById(userId);

        if (!user || !user.twoFactorSecret) {
            throw new UnauthorizedException('2FA not configured');
        }

        const isValid = authenticator.verify({
            token,
            secret: user.twoFactorSecret,
        });

        if (!isValid) {
            throw new UnauthorizedException('Invalid 2FA token');
        }

        // Enable 2FA
        await this.usersService.update(userId, {
            twoFactorEnabled: true,
        });

        return { success: true };
    }

    async disable2FA(userId: string, token: string) {
        const user = await this.usersService.findById(userId);

        if (!user || !user.twoFactorEnabled) {
            throw new UnauthorizedException('2FA is not enabled');
        }

        const isValid = authenticator.verify({
            token,
            secret: user.twoFactorSecret!,
        });

        if (!isValid) {
            throw new UnauthorizedException('Invalid 2FA token');
        }

        // Disable 2FA
        await this.usersService.update(userId, {
            twoFactorEnabled: false,
            twoFactorSecret: null,
        });

        return { success: true };
    }
}

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

// Mock otplib
jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: jest.fn(() => 'test-secret'),
    keyuri: jest.fn(() => 'otpauth://test'),
    verify: jest.fn(),
  },
}));

// Mock qrcode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,test')),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: 'Test User',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    isActive: true,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    ipWhitelistEnabled: false,
    allowedIps: [],
    dailyMaxLoss: null,
    maxPositionPercent: null,
    maxDailyTrades: null,
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateLastLogin: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(() => 'mock-jwt-token'),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-secret',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result.passwordHash).toBeUndefined();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser('notfound@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return access token and user info', async () => {
      usersService.updateLastLogin.mockResolvedValue(mockUser as any);

      const result = await service.login(mockUser as any);

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.id).toBe('user-123');
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: 'test@example.com',
        sub: 'user-123',
      });
    });

    it('should update last login timestamp', async () => {
      usersService.updateLastLogin.mockResolvedValue(mockUser as any);

      await service.login(mockUser as any);

      expect(usersService.updateLastLogin).toHaveBeenCalledWith('user-123');
    });
  });

  describe('register', () => {
    it('should create a new user and return login response', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser as any);
      usersService.updateLastLogin.mockResolvedValue(mockUser as any);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.register('new@example.com', 'password123', 'New User');

      expect(usersService.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        passwordHash: 'hashed-password',
        name: 'New User',
      });
      expect(result.access_token).toBeDefined();
    });

    it('should throw UnauthorizedException when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(
        service.register('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('setup2FA', () => {
    it('should generate 2FA secret and QR code', async () => {
      usersService.findById.mockResolvedValue(mockUser as any);
      usersService.update.mockResolvedValue(mockUser as any);

      const result = await service.setup2FA('user-123');

      expect(result.secret).toBe('test-secret');
      expect(result.qrCode).toContain('data:image/png');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.setup2FA('invalid-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when 2FA is already enabled', async () => {
      usersService.findById.mockResolvedValue({
        ...mockUser,
        twoFactorEnabled: true,
      } as any);

      await expect(service.setup2FA('user-123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verify2FA', () => {
    const { authenticator } = require('otplib');

    it('should enable 2FA when token is valid', async () => {
      usersService.findById.mockResolvedValue({
        ...mockUser,
        twoFactorSecret: 'test-secret',
      } as any);
      authenticator.verify.mockReturnValue(true);
      usersService.update.mockResolvedValue(mockUser as any);

      const result = await service.verify2FA('user-123', '123456');

      expect(result.success).toBe(true);
      expect(usersService.update).toHaveBeenCalledWith('user-123', {
        twoFactorEnabled: true,
      });
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      usersService.findById.mockResolvedValue({
        ...mockUser,
        twoFactorSecret: 'test-secret',
      } as any);
      authenticator.verify.mockReturnValue(false);

      await expect(service.verify2FA('user-123', 'invalid')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('disable2FA', () => {
    const { authenticator } = require('otplib');

    it('should disable 2FA when token is valid', async () => {
      usersService.findById.mockResolvedValue({
        ...mockUser,
        twoFactorEnabled: true,
        twoFactorSecret: 'test-secret',
      } as any);
      authenticator.verify.mockReturnValue(true);
      usersService.update.mockResolvedValue(mockUser as any);

      const result = await service.disable2FA('user-123', '123456');

      expect(result.success).toBe(true);
      expect(usersService.update).toHaveBeenCalledWith('user-123', {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      });
    });

    it('should throw UnauthorizedException when 2FA is not enabled', async () => {
      usersService.findById.mockResolvedValue(mockUser as any);

      await expect(service.disable2FA('user-123', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});

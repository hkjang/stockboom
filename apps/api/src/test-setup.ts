// Global test setup for API tests

// Mock Prisma client
jest.mock('@stockboom/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    indicator: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    trade: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    stock: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    portfolio: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

// Global test utilities
global.createMockUser = () => ({
  id: 'test-user-id',
  email: 'test@example.com',
  passwordHash: '$2a$10$testhashedpassword',
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
});

// Console error suppression for cleaner test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning:')
    ) {
      return;
    }
    originalConsoleError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

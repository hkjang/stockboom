import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { TradesService } from './trades.service';
import { KisApiService } from '../market-data/kis-api.service';
import { prisma } from '@stockboom/database';

// Mock prisma
jest.mock('@stockboom/database', () => ({
  prisma: {
    trade: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    brokerAccount: {
      findFirst: jest.fn(),
    },
    stock: {
      findUnique: jest.fn(),
    },
  },
  OrderStatus: {
    PENDING: 'PENDING',
    SUBMITTED: 'SUBMITTED',
    FILLED: 'FILLED',
    PARTIALLY_FILLED: 'PARTIALLY_FILLED',
    CANCELLED: 'CANCELLED',
    REJECTED: 'REJECTED',
    EXPIRED: 'EXPIRED',
  },
  OrderType: {
    MARKET: 'MARKET',
    LIMIT: 'LIMIT',
    STOP_LOSS: 'STOP_LOSS',
    TAKE_PROFIT: 'TAKE_PROFIT',
  },
  OrderSide: {
    BUY: 'BUY',
    SELL: 'SELL',
  },
}));

describe('TradesService', () => {
  let service: TradesService;
  let mockQueue: { add: jest.Mock };
  let mockKisApiService: { placeOrder: jest.Mock };

  const mockUser = { id: 'user-123' };
  const mockBrokerAccount = {
    id: 'broker-123',
    userId: 'user-123',
    broker: 'kis',
    accountNumber: '12345678',
    isActive: true,
    isMockMode: true,
  };
  const mockStock = {
    id: 'stock-123',
    symbol: '005930',
    name: 'Samsung Electronics',
    market: 'KOSPI',
    currentPrice: 70000,
  };
  const mockTrade = {
    id: 'trade-123',
    userId: 'user-123',
    brokerAccountId: 'broker-123',
    stockId: 'stock-123',
    orderType: 'MARKET',
    orderSide: 'BUY',
    status: 'PENDING',
    quantity: 10,
    limitPrice: null,
    stopPrice: null,
    strategyId: null,
    isAutoTrade: false,
    retryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    stock: mockStock,
    brokerAccount: mockBrokerAccount,
  };

  beforeEach(async () => {
    mockQueue = { add: jest.fn().mockResolvedValue({}) };
    mockKisApiService = {
      placeOrder: jest.fn().mockResolvedValue({
        status: 'SUCCESS',
        orderId: 'order-123',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradesService,
        { provide: getQueueToken('trading'), useValue: mockQueue },
        { provide: KisApiService, useValue: mockKisApiService },
      ],
    }).compile();

    service = module.get<TradesService>(TradesService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return trades for a user', async () => {
      const mockTrades = [mockTrade, { ...mockTrade, id: 'trade-124' }];
      (prisma.trade.findMany as jest.Mock).mockResolvedValue(mockTrades);

      const result = await service.findAll('user-123');

      expect(result).toHaveLength(2);
      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
        }),
      );
    });

    it('should filter by status when provided', async () => {
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([mockTrade]);

      await service.findAll('user-123', { status: 'PENDING' as any });

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', status: 'PENDING' },
        }),
      );
    });

    it('should apply pagination', async () => {
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll('user-123', { skip: 10, take: 5 });

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a trade when found', async () => {
      (prisma.trade.findFirst as jest.Mock).mockResolvedValue(mockTrade);

      const result = await service.findOne('trade-123', 'user-123');

      expect(result).toEqual(mockTrade);
    });

    it('should throw NotFoundException when trade not found', async () => {
      (prisma.trade.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOne('invalid-trade', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createParams = {
      brokerAccountId: 'broker-123',
      stockId: 'stock-123',
      orderType: 'MARKET' as any,
      orderSide: 'BUY' as any,
      quantity: 10,
    };

    beforeEach(() => {
      (prisma.brokerAccount.findFirst as jest.Mock).mockResolvedValue(mockBrokerAccount);
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(mockStock);
      (prisma.trade.create as jest.Mock).mockResolvedValue(mockTrade);
    });

    it('should create a trade and queue for execution', async () => {
      const result = await service.create('user-123', createParams);

      expect(result).toEqual(mockTrade);
      expect(prisma.trade.create).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith('execute-trade', {
        tradeId: 'trade-123',
      });
    });

    it('should throw BadRequestException for invalid broker account', async () => {
      (prisma.brokerAccount.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create('user-123', createParams),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for invalid stock', async () => {
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create('user-123', createParams),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for limit order without price', async () => {
      await expect(
        service.create('user-123', {
          ...createParams,
          orderType: 'LIMIT' as any,
          limitPrice: undefined,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for stop loss without stop price', async () => {
      await expect(
        service.create('user-123', {
          ...createParams,
          orderType: 'STOP_LOSS' as any,
          stopPrice: undefined,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('executeTrade', () => {
    beforeEach(() => {
      (prisma.trade.findUnique as jest.Mock).mockResolvedValue(mockTrade);
      (prisma.trade.update as jest.Mock).mockImplementation((args) => 
        Promise.resolve({ ...mockTrade, ...args.data }),
      );
    });

    it('should execute trade via KIS API and update status to FILLED', async () => {
      mockKisApiService.placeOrder.mockResolvedValue({
        status: 'SUCCESS',
        orderId: 'order-123',
      });

      const result = await service.executeTrade('trade-123');

      expect(result.status).toBe('FILLED');
      expect(mockKisApiService.placeOrder).toHaveBeenCalled();
    });

    it('should throw NotFoundException when trade not found', async () => {
      (prisma.trade.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.executeTrade('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when trade is not pending', async () => {
      (prisma.trade.findUnique as jest.Mock).mockResolvedValue({
        ...mockTrade,
        status: 'FILLED',
      });

      await expect(service.executeTrade('trade-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update trade as REJECTED when API fails', async () => {
      mockKisApiService.placeOrder.mockResolvedValue({
        status: 'FAILED',
        message: 'Insufficient balance',
      });

      const result = await service.executeTrade('trade-123');

      expect(result.status).toBe('REJECTED');
      expect(result.failureReason).toBe('Insufficient balance');
    });

    it('should handle API exceptions and update trade as REJECTED', async () => {
      mockKisApiService.placeOrder.mockRejectedValue(new Error('Network error'));

      const result = await service.executeTrade('trade-123');

      expect(result.status).toBe('REJECTED');
      expect(result.failureReason).toBe('Network error');
    });
  });

  describe('cancelTrade', () => {
    beforeEach(() => {
      (prisma.trade.findFirst as jest.Mock).mockResolvedValue(mockTrade);
      (prisma.trade.update as jest.Mock).mockImplementation((args) =>
        Promise.resolve({ ...mockTrade, ...args.data }),
      );
    });

    it('should cancel a pending trade', async () => {
      const result = await service.cancelTrade('trade-123', 'user-123');

      expect(result.status).toBe('CANCELLED');
      expect(result.cancelledAt).toBeDefined();
    });

    it('should throw BadRequestException for non-cancellable trade', async () => {
      (prisma.trade.findFirst as jest.Mock).mockResolvedValue({
        ...mockTrade,
        status: 'FILLED',
      });

      await expect(
        service.cancelTrade('trade-123', 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStatistics', () => {
    it('should calculate trade statistics correctly', async () => {
      const filledTrades = [
        { ...mockTrade, status: 'FILLED', orderSide: 'BUY', totalAmount: { toNumber: () => 700000 } },
        { ...mockTrade, status: 'FILLED', orderSide: 'SELL', totalAmount: { toNumber: () => 800000 } },
      ];
      (prisma.trade.findMany as jest.Mock).mockResolvedValue(filledTrades);

      const result = await service.getStatistics('user-123');

      expect(result.totalTrades).toBe(2);
      expect(result.buyTrades).toBe(1);
      expect(result.sellTrades).toBe(1);
      expect(result.totalBuyAmount).toBe(700000);
      expect(result.totalSellAmount).toBe(800000);
      expect(result.netAmount).toBe(100000);
    });

    it('should return zero values when no filled trades', async () => {
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getStatistics('user-123');

      expect(result.totalTrades).toBe(0);
      expect(result.netAmount).toBe(0);
    });
  });

  describe('retryFailedTrade', () => {
    const rejectedTrade = { ...mockTrade, status: 'REJECTED', retryCount: 0 };

    beforeEach(() => {
      (prisma.trade.findUnique as jest.Mock).mockResolvedValue(rejectedTrade);
      (prisma.trade.update as jest.Mock).mockImplementation((args) =>
        Promise.resolve({ ...rejectedTrade, ...args.data }),
      );
    });

    it('should queue rejected trade for retry with exponential backoff', async () => {
      await service.retryFailedTrade('trade-123');

      expect(prisma.trade.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'trade-123' },
          data: expect.objectContaining({
            status: 'PENDING',
            retryCount: 1,
          }),
        }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-trade',
        { tradeId: 'trade-123' },
        expect.objectContaining({ delay: 1000 }), // 1000ms for first retry
      );
    });

    it('should throw BadRequestException when max retries exceeded', async () => {
      (prisma.trade.findUnique as jest.Mock).mockResolvedValue({
        ...rejectedTrade,
        retryCount: 3,
      });

      await expect(service.retryFailedTrade('trade-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for non-rejected trade', async () => {
      (prisma.trade.findUnique as jest.Mock).mockResolvedValue({
        ...rejectedTrade,
        status: 'PENDING',
      });

      await expect(service.retryFailedTrade('trade-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

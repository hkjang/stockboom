import { IndicatorsService, CandleData } from './indicators.service';

describe('IndicatorsService', () => {
  let service: IndicatorsService;

  beforeEach(() => {
    service = new IndicatorsService();
  });

  // Sample price data for testing
  const samplePrices = [
    44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
    45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22,
    45.64, 46.21, 46.25, 45.71, 46.45, 45.78, 45.35, 44.03, 44.18,
    44.22, 44.57, 43.42, 42.66, 43.13,
  ];

  // Sample candle data for Stochastic testing
  const sampleCandles: CandleData[] = samplePrices.map((close, i) => ({
    timestamp: new Date(Date.now() - (samplePrices.length - i) * 86400000),
    open: close - 0.2,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: 1000000 + Math.random() * 500000,
  }));

  describe('calculateSMA', () => {
    it('should calculate Simple Moving Average correctly', () => {
      const prices = [10, 20, 30, 40, 50];
      const sma = service.calculateSMA(prices, 3);

      // SMA(3) should return:
      // (10+20+30)/3 = 20
      // (20+30+40)/3 = 30
      // (30+40+50)/3 = 40
      expect(sma).toHaveLength(3);
      expect(sma[0]).toBe(20);
      expect(sma[1]).toBe(30);
      expect(sma[2]).toBe(40);
    });

    it('should handle default period of 20', () => {
      const sma = service.calculateSMA(samplePrices);
      expect(sma.length).toBe(samplePrices.length - 19);
    });

    it('should return empty array when prices are less than period', () => {
      const sma = service.calculateSMA([10, 20], 5);
      expect(sma).toHaveLength(0);
    });
  });

  describe('calculateEMA', () => {
    it('should calculate Exponential Moving Average correctly', () => {
      const prices = [22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29];
      const ema = service.calculateEMA(prices, 5);

      expect(ema.length).toBeGreaterThan(0);
      // EMA should be within the price range
      ema.forEach(value => {
        expect(value).toBeGreaterThan(21);
        expect(value).toBeLessThan(23);
      });
    });

    it('should handle default period of 12', () => {
      const ema = service.calculateEMA(samplePrices);
      expect(ema.length).toBe(samplePrices.length - 11);
    });
  });

  describe('calculateRSI', () => {
    it('should calculate RSI within 0-100 range', () => {
      const rsi = service.calculateRSI(samplePrices, 14);

      expect(rsi.length).toBeGreaterThan(0);
      rsi.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });

    it('should return values indicating overbought/oversold conditions', () => {
      // Consistently rising prices should yield high RSI
      const risingPrices = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
      const rsi = service.calculateRSI(risingPrices, 14);

      // RSI should be high for rising prices
      const lastRSI = rsi[rsi.length - 1];
      expect(lastRSI).toBeGreaterThan(70);
    });

    it('should handle default period of 14', () => {
      const rsi = service.calculateRSI(samplePrices);
      expect(rsi.length).toBe(samplePrices.length - 14);
    });
  });

  describe('calculateMACD', () => {
    it('should return MACD, signal, and histogram', () => {
      const macd = service.calculateMACD(samplePrices);

      expect(macd.length).toBeGreaterThan(0);
      macd.forEach(result => {
        expect(result).toHaveProperty('MACD');
        expect(result).toHaveProperty('signal');
        expect(result).toHaveProperty('histogram');
      });
    });

    it('should accept custom configuration', () => {
      const macd = service.calculateMACD(samplePrices, {
        fastPeriod: 8,
        slowPeriod: 17,
        signalPeriod: 9,
      });

      expect(macd.length).toBeGreaterThan(0);
    });

    it('should use default config when not provided', () => {
      const macdDefault = service.calculateMACD(samplePrices);
      const macdExplicit = service.calculateMACD(samplePrices, {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      });

      expect(macdDefault.length).toBe(macdExplicit.length);
    });
  });

  describe('calculateStochastic', () => {
    it('should return K and D values', () => {
      const stoch = service.calculateStochastic(sampleCandles, 14, 3);

      expect(stoch.length).toBeGreaterThan(0);
      stoch.forEach(result => {
        expect(result).toHaveProperty('k');
        expect(result).toHaveProperty('d');
      });
    });

    it('should return values between 0 and 100', () => {
      const stoch = service.calculateStochastic(sampleCandles, 14, 3);

      stoch.forEach(result => {
        expect(result.k).toBeGreaterThanOrEqual(0);
        expect(result.k).toBeLessThanOrEqual(100);
        expect(result.d).toBeGreaterThanOrEqual(0);
        expect(result.d).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('calculateBollingerBands', () => {
    it('should return upper, middle, and lower bands', () => {
      const bands = service.calculateBollingerBands(samplePrices, 20, 2);

      expect(bands.length).toBeGreaterThan(0);
      bands.forEach(band => {
        expect(band).toHaveProperty('upper');
        expect(band).toHaveProperty('middle');
        expect(band).toHaveProperty('lower');
      });
    });

    it('should have upper > middle > lower', () => {
      const bands = service.calculateBollingerBands(samplePrices, 20, 2);

      bands.forEach(band => {
        expect(band.upper).toBeGreaterThan(band.middle);
        expect(band.middle).toBeGreaterThan(band.lower);
      });
    });

    it('should have middle band equal to SMA', () => {
      const bands = service.calculateBollingerBands(samplePrices, 20, 2);
      const sma = service.calculateSMA(samplePrices, 20);

      bands.forEach((band, i) => {
        expect(band.middle).toBeCloseTo(sma[i], 5);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty array input', () => {
      const sma = service.calculateSMA([], 5);
      expect(sma).toHaveLength(0);
    });

    it('should handle single element array', () => {
      const sma = service.calculateSMA([100], 1);
      expect(sma).toHaveLength(1);
      expect(sma[0]).toBe(100);
    });

    it('should handle negative prices', () => {
      // Although unusual, the service should handle negative values
      const prices = [-10, -20, -15, -12, -18];
      const sma = service.calculateSMA(prices, 3);
      expect(sma.length).toBe(3);
    });

    it('should handle very large numbers', () => {
      const largePrices = [1e10, 1e10 + 1000, 1e10 + 2000, 1e10 + 3000, 1e10 + 4000];
      const sma = service.calculateSMA(largePrices, 3);
      expect(sma.length).toBe(3);
    });
  });
});

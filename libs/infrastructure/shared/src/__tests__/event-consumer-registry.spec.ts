import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventConsumerRegistry, EventConsumerHandler } from '../messaging/event-consumer-registry';

function createMockModuleRef() {
  return {
    get: vi.fn(),
  } as any;
}

class FakeConsumerA implements EventConsumerHandler {
  handle = vi.fn().mockResolvedValue(undefined);
}

class FakeConsumerB implements EventConsumerHandler {
  handle = vi.fn().mockResolvedValue(undefined);
}

class FakeConsumerC implements EventConsumerHandler {
  handle = vi.fn().mockResolvedValue(undefined);
}

describe('EventConsumerRegistry', () => {
  let mockModuleRef: ReturnType<typeof createMockModuleRef>;
  let registry: EventConsumerRegistry;

  beforeEach(() => {
    mockModuleRef = createMockModuleRef();
    registry = new EventConsumerRegistry(mockModuleRef);
  });

  describe('register()', () => {
    it('should store registrations for later resolution', () => {
      registry.register('UserCreated', FakeConsumerA);
      registry.register('UserDeleted', FakeConsumerB);

      // Registrations are stored internally but not yet resolved.
      // We verify by calling onModuleInit and checking that moduleRef.get is called.
      mockModuleRef.get.mockReturnValue(new FakeConsumerA());

      return registry.onModuleInit().then(() => {
        expect(mockModuleRef.get).toHaveBeenCalledTimes(2);
      });
    });

    it('should allow multiple consumers for the same event type', async () => {
      const consumerA = new FakeConsumerA();
      const consumerB = new FakeConsumerB();

      registry.register('UserCreated', FakeConsumerA);
      registry.register('UserCreated', FakeConsumerB);

      mockModuleRef.get.mockImplementation((cls: any) => {
        if (cls === FakeConsumerA) return consumerA;
        if (cls === FakeConsumerB) return consumerB;
        throw new Error('Unknown class');
      });

      await registry.onModuleInit();

      const event = { userId: '123' };
      await registry.dispatch('UserCreated', event);

      expect(consumerA.handle).toHaveBeenCalledWith(event);
      expect(consumerB.handle).toHaveBeenCalledWith(event);
    });
  });

  describe('onModuleInit()', () => {
    it('should resolve consumer instances from ModuleRef', async () => {
      const consumerInstance = new FakeConsumerA();
      registry.register('UserCreated', FakeConsumerA);

      mockModuleRef.get.mockReturnValue(consumerInstance);

      await registry.onModuleInit();

      expect(mockModuleRef.get).toHaveBeenCalledWith(FakeConsumerA, { strict: false });
    });

    it('should handle resolution failure gracefully without crashing', async () => {
      registry.register('UserCreated', FakeConsumerA);

      mockModuleRef.get.mockImplementation(() => {
        throw new Error('Provider not found');
      });

      // Should not throw
      await expect(registry.onModuleInit()).resolves.toBeUndefined();
    });

    it('should continue resolving other consumers if one fails', async () => {
      const consumerB = new FakeConsumerB();
      registry.register('UserCreated', FakeConsumerA);
      registry.register('UserDeleted', FakeConsumerB);

      mockModuleRef.get.mockImplementation((cls: any) => {
        if (cls === FakeConsumerA) throw new Error('Not found');
        return consumerB;
      });

      await registry.onModuleInit();

      // FakeConsumerB should still be resolved
      const types = registry.getRegisteredEventTypes();
      expect(types).toContain('UserDeleted');
    });
  });

  describe('dispatch()', () => {
    it('should call all registered consumers for the event type', async () => {
      const consumerA = new FakeConsumerA();
      const consumerB = new FakeConsumerB();

      registry.register('UserCreated', FakeConsumerA);
      registry.register('UserCreated', FakeConsumerB);

      mockModuleRef.get.mockImplementation((cls: any) => {
        if (cls === FakeConsumerA) return consumerA;
        if (cls === FakeConsumerB) return consumerB;
        throw new Error('Unknown');
      });

      await registry.onModuleInit();

      const event = { userId: '456' };
      await registry.dispatch('UserCreated', event);

      expect(consumerA.handle).toHaveBeenCalledWith(event);
      expect(consumerB.handle).toHaveBeenCalledWith(event);
    });

    it('should do nothing when no consumers are registered for the event type', async () => {
      // dispatch on an event with no handlers should not throw
      await expect(registry.dispatch('NonExistentEvent', {})).resolves.toBeUndefined();
    });

    it('should call all consumers even if one fails (Promise.allSettled)', async () => {
      const consumerA = new FakeConsumerA();
      const consumerB = new FakeConsumerB();

      consumerA.handle.mockRejectedValue(new Error('Consumer A failed'));

      registry.register('UserCreated', FakeConsumerA);
      registry.register('UserCreated', FakeConsumerB);

      mockModuleRef.get.mockImplementation((cls: any) => {
        if (cls === FakeConsumerA) return consumerA;
        if (cls === FakeConsumerB) return consumerB;
        throw new Error('Unknown');
      });

      await registry.onModuleInit();

      const event = { userId: '789' };
      await registry.dispatch('UserCreated', event);

      // Both consumers should have been called despite A failing
      expect(consumerA.handle).toHaveBeenCalledWith(event);
      expect(consumerB.handle).toHaveBeenCalledWith(event);
    });

    it('should not throw when a consumer fails', async () => {
      const consumerA = new FakeConsumerA();
      consumerA.handle.mockRejectedValue(new Error('Crash'));

      registry.register('UserCreated', FakeConsumerA);
      mockModuleRef.get.mockReturnValue(consumerA);

      await registry.onModuleInit();

      await expect(registry.dispatch('UserCreated', {})).resolves.toBeUndefined();
    });

    it('should only dispatch to consumers of the matching event type', async () => {
      const consumerA = new FakeConsumerA();
      const consumerB = new FakeConsumerB();

      registry.register('UserCreated', FakeConsumerA);
      registry.register('UserDeleted', FakeConsumerB);

      mockModuleRef.get.mockImplementation((cls: any) => {
        if (cls === FakeConsumerA) return consumerA;
        if (cls === FakeConsumerB) return consumerB;
        throw new Error('Unknown');
      });

      await registry.onModuleInit();

      await registry.dispatch('UserCreated', { userId: '1' });

      expect(consumerA.handle).toHaveBeenCalledOnce();
      expect(consumerB.handle).not.toHaveBeenCalled();
    });
  });

  describe('getRegisteredEventTypes()', () => {
    it('should return empty array when no consumers have been resolved', () => {
      expect(registry.getRegisteredEventTypes()).toEqual([]);
    });

    it('should return registered event types after onModuleInit()', async () => {
      registry.register('UserCreated', FakeConsumerA);
      registry.register('UserDeleted', FakeConsumerB);
      registry.register('UserUpdated', FakeConsumerC);

      mockModuleRef.get.mockImplementation((cls: any) => {
        if (cls === FakeConsumerA) return new FakeConsumerA();
        if (cls === FakeConsumerB) return new FakeConsumerB();
        if (cls === FakeConsumerC) return new FakeConsumerC();
        throw new Error('Unknown');
      });

      await registry.onModuleInit();

      const types = registry.getRegisteredEventTypes();
      expect(types).toHaveLength(3);
      expect(types).toContain('UserCreated');
      expect(types).toContain('UserDeleted');
      expect(types).toContain('UserUpdated');
    });

    it('should not include event types whose consumers failed to resolve', async () => {
      registry.register('UserCreated', FakeConsumerA);

      mockModuleRef.get.mockImplementation(() => {
        throw new Error('Provider not found');
      });

      await registry.onModuleInit();

      expect(registry.getRegisteredEventTypes()).toEqual([]);
    });
  });
});

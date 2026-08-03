/**
 * Cache Module Test Suite
 * Coverage target: 90%+
 */

const { expect } = require('chai');
const { describe, it, beforeEach, afterEach, mock } = require('mocha');
const LRUCache = require('../../../src/lib/cache');

describe('LRUCache', () => {
  let cache;
  const DEFAULT_MAX_SIZE = 10;

  beforeEach(() => {
    cache = new LRUCache(DEFAULT_MAX_SIZE);
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      const value = cache.get('key1');

      expect(value).to.equal('value1');
    });

    it('should return undefined for non-existent keys', () => {
      const value = cache.get('nonexistent');

      expect(value).to.be.undefined;
    });

    it('should return null for non-existent keys when null is valid value', () => {
      cache.set('key1', null);
      const value = cache.get('key1');

      expect(value).to.be.null;
    });

    it('should return false for non-existent keys when using has()', () => {
      const exists = cache.has('nonexistent');

      expect(exists).to.be.false;
    });

    it('should return true for existing keys', () => {
      cache.set('key1', 'value1');
      const exists = cache.has('key1');

      expect(exists).to.be.true;
    });
  });

  describe('Capacity Management', () => {
    it('should limit cache size to max size', () => {
      for (let i = 0; i < DEFAULT_MAX_SIZE + 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      expect(cache.size).to.equal(DEFAULT_MAX_SIZE);
    });

    it('should evict least recently used item when cache is full', () => {
      // Fill cache
      for (let i = 0; i < DEFAULT_MAX_SIZE; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Add one more item (should evict key0)
      cache.set('key_extra', 'value_extra');

      // key0 should be evicted
      expect(cache.has('key0')).to.be.false;
      expect(cache.has('key_extra')).to.be.true;
      expect(cache.size).to.equal(DEFAULT_MAX_SIZE);
    });

    it('should update usage order on get', () => {
      for (let i = 0; i < DEFAULT_MAX_SIZE; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Access key0 (least recently used)
      cache.get('key0');

      // Add new item (should evict key1, not key0)
      cache.set('key_extra', 'value_extra');

      // key1 should be evicted
      expect(cache.has('key1')).to.be.false;
      // key0 should still exist (was just accessed)
      expect(cache.has('key0')).to.be.true;
    });

    it('should update usage order on set', () => {
      for (let i = 0; i < DEFAULT_MAX_SIZE; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Update key0 (should move to most recently used)
      cache.set('key0', 'new_value0');

      // Add new item (should evict key1, not key0)
      cache.set('key_extra', 'value_extra');

      // key1 should be evicted
      expect(cache.has('key1')).to.be.false;
      // key0 should still exist (was just updated)
      expect(cache.has('key0')).to.be.true;
    });

    it('should handle max size of 1', () => {
      const smallCache = new LRUCache(1);

      smallCache.set('key1', 'value1');
      expect(smallCache.size).to.equal(1);

      smallCache.set('key2', 'value2');
      expect(smallCache.size).to.equal(1);
      expect(smallCache.has('key1')).to.be.false;
      expect(smallCache.has('key2')).to.be.true;
    });

    it('should handle max size of 0 (unlimited)', () => {
      const unlimitedCache = new LRUCache(0);

      for (let i = 0; i < 100; i++) {
        unlimitedCache.set(`key${i}`, `value${i}`);
      }

      expect(unlimitedCache.size).to.equal(100);
    });
  });

  describe('Deletion', () => {
    it('should delete specific key', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.delete('key1');

      expect(cache.has('key1')).to.be.false;
      expect(cache.has('key2')).to.be.true;
      expect(cache.size).to.equal(1);
    });

    it('should do nothing when deleting non-existent key', () => {
      cache.set('key1', 'value1');

      cache.delete('nonexistent');

      expect(cache.has('key1')).to.be.true;
      expect(cache.size).to.equal(1);
    });

    it('should handle delete on empty cache', () => {
      cache.delete('nonexistent');

      expect(cache.size).to.equal(0);
    });
  });

  describe('Clear', () => {
    it('should clear all entries', () => {
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      cache.clear();

      expect(cache.size).to.equal(0);
      expect(cache.has('key0')).to.be.false;
      expect(cache.has('key1')).to.be.false;
      expect(cache.has('key2')).to.be.false;
      expect(cache.has('key3')).to.be.false;
      expect(cache.has('key4')).to.be.false;
    });

    it('should handle clear on empty cache', () => {
      cache.clear();

      expect(cache.size).to.equal(0);
    });
  });

  describe('Size Property', () => {
    it('should return correct size after set', () => {
      expect(cache.size).to.equal(0);

      cache.set('key1', 'value1');
      expect(cache.size).to.equal(1);

      cache.set('key2', 'value2');
      expect(cache.size).to.equal(2);
    });

    it('should return correct size after delete', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.delete('key1');
      expect(cache.size).to.equal(2);

      cache.delete('key2');
      expect(cache.size).to.equal(1);

      cache.delete('key3');
      expect(cache.size).to.equal(0);
    });

    it('should return correct size after clear', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();
      expect(cache.size).to.equal(0);
    });

    it('should return correct size after capacity eviction', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');

      expect(cache.size).to.equal(4);

      cache.set('key5', 'value5');
      expect(cache.size).to.equal(4); // Should still be 4 (capacity limited)
    });
  });

  describe('Iterator', () => {
    it('should iterate over all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const entries = [];
      for (const [key, value] of cache) {
        entries.push([key, value]);
      }

      expect(entries).to.have.lengthOf(3);
      expect(entries).to.include(['key1', 'value1']);
      expect(entries).to.include(['key2', 'value2']);
      expect(entries).to.include(['key3', 'value3']);
    });

    it('should iterate in LRU order (most recently used first)', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 to make it most recently used
      cache.get('key1');

      const entries = [];
      for (const [key, value] of cache) {
        entries.push(key);
      }

      // Should iterate in LRU order: key1, key3, key2
      expect(entries[0]).to.equal('key1');
      expect(entries[1]).to.equal('key3');
      expect(entries[2]).to.equal('key2');
    });

    it('should handle empty cache iteration', () => {
      const entries = [];
      for (const [key, value] of cache) {
        entries.push([key, value]);
      }

      expect(entries).to.have.lengthOf(0);
    });
  });

  describe('Custom Max Size', () => {
    it('should use custom max size', () => {
      const customCache = new LRUCache(5);

      for (let i = 0; i < 10; i++) {
        customCache.set(`key${i}`, `value${i}`);
      }

      expect(customCache.size).to.equal(5);
    });

    it('should handle custom max size of 1 correctly', () => {
      const smallCache = new LRUCache(1);

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      expect(smallCache.size).to.equal(1);
      expect(smallCache.has('key3')).to.be.true;
      expect(smallCache.has('key1')).to.be.false;
    });
  });

  describe('Edge Cases', () => {
    it('should handle same key set multiple times', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      cache.set('key1', 'value3');

      expect(cache.has('key1')).to.be.true;
      expect(cache.get('key1')).to.equal('value3');
      expect(cache.size).to.equal(1);
    });

    it('should handle empty string as key', () => {
      cache.set('', 'value');

      expect(cache.has('')).to.be.true;
      expect(cache.get('')).to.equal('value');
      expect(cache.size).to.equal(1);
    });

    it('should handle empty string as value', () => {
      cache.set('key1', '');

      expect(cache.has('key1')).to.be.true;
      expect(cache.get('key1')).to.equal('');
      expect(cache.size).to.equal(1);
    });

    it('should handle boolean values', () => {
      cache.set('key1', true);
      cache.set('key2', false);

      expect(cache.has('key1')).to.be.true;
      expect(cache.has('key2')).to.be.true;
      expect(cache.get('key1')).to.be.true;
      expect(cache.get('key2')).to.be.false;
      expect(cache.size).to.equal(2);
    });

    it('should handle number values', () => {
      cache.set('key1', 123);
      cache.set('key2', -456);
      cache.set('key3', 0);

      expect(cache.get('key1')).to.equal(123);
      expect(cache.get('key2')).to.equal(-456);
      expect(cache.get('key3')).to.equal(0);
      expect(cache.size).to.equal(3);
    });

    it('should handle object values', () => {
      const obj1 = { key: 'value1' };
      const obj2 = { key: 'value2' };

      cache.set('key1', obj1);
      cache.set('key2', obj2);

      expect(cache.get('key1')).to.equal(obj1);
      expect(cache.get('key2')).to.equal(obj2);
      expect(cache.size).to.equal(2);
    });

    it('should handle array values', () => {
      const arr1 = [1, 2, 3];
      const arr2 = ['a', 'b', 'c'];

      cache.set('key1', arr1);
      cache.set('key2', arr2);

      expect(cache.get('key1')).to.equal(arr1);
      expect(cache.get('key2')).to.equal(arr2);
      expect(cache.size).to.equal(2);
    });

    it('should handle undefined values', () => {
      cache.set('key1', undefined);

      expect(cache.has('key1')).to.be.true;
      expect(cache.get('key1')).to.be.undefined;
      expect(cache.size).to.equal(1);
    });

    it('should handle very long keys', () => {
      const longKey = 'a'.repeat(1000);
      cache.set(longKey, 'value');

      expect(cache.has(longKey)).to.be.true;
      expect(cache.get(longKey)).to.equal('value');
      expect(cache.size).to.equal(1);
    });

    it('should handle very long values', () => {
      const longValue = 'b'.repeat(10000);
      cache.set('key1', longValue);

      expect(cache.has('key1')).to.be.true;
      expect(cache.get('key1')).to.equal(longValue);
      expect(cache.size).to.equal(1);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent get operations', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(cache.get('key1'));
        results.push(cache.get('key2'));
        results.push(cache.get('key3'));
      }

      expect(results.every(r => r === 'value1' || r === 'value2' || r === 'value3')).to.be.true;
    });

    it('should handle concurrent set operations', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      expect(cache.size).to.equal(DEFAULT_MAX_SIZE);
    });

    it('should handle mixed concurrent operations', () => {
      for (let i = 0; i < 20; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      for (let i = 0; i < 10; i++) {
        cache.get(`key${i}`);
      }

      for (let i = 20; i < 30; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      expect(cache.size).to.equal(DEFAULT_MAX_SIZE);
    });
  });

  describe('Performance', () => {
    it('should handle 1000 operations efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, `value${i}`);
        cache.get(`key${i}`);
        cache.delete(`key${i}`);
      }

      const endTime = Date.now();

      expect(endTime - startTime).to.be.lessThan(100); // Should complete in <100ms
    });

    it('should handle 1000 consecutive searches efficiently', () => {
      // Fill cache
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        cache.get(`key${i % 100}`);
      }

      const endTime = Date.now();

      expect(endTime - startTime).to.be.lessThan(100); // Should complete in <100ms
    });
  });
});

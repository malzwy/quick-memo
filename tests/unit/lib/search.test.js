/**
 * Search Module Test Suite
 * Coverage target: 80%+
 */

const { expect } = require('chai');
const { describe, it, beforeEach, afterEach, mock } = require('mocha');
const CachedSearch = require('../../../src/lib/search');
const { tokenize } = require('../../../src/lib/text-utils');

describe('CachedSearch', () => {
  let search;
  let mockIndex;
  let mockIndexer;

  beforeEach(() => {
    // Create mock index
    mockIndex = {
      notes: [
        { id: '1', content: 'Buy groceries', tags: ['shopping'], createdAt: 1234567890000 },
        { id: '2', content: 'Meeting at 3pm', tags: ['work'], createdAt: 1234567891000 },
        { id: '3', content: 'Call mom', tags: ['personal'], createdAt: 1234567892000 },
        { id: '4', content: 'Important project deadline', tags: ['work', 'urgent'], createdAt: 1234567893000 },
      ],
      rev: '1',
    };

    // Mock indexer module
    mockIndexer = {
      loadIndex: jest.fn().mockResolvedValue(mockIndex),
      getIndexPath: jest.fn().mockReturnValue('/fake/index.json'),
    };

    // Mock text-utils tokenize
    tokenize.mockImplementation((text) => {
      return text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    });

    search = new CachedSearch({
      indexer: mockIndexer,
      maxSize: 10,
      ttl: 3600000, // 1 hour
    });
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Basic Search', () => {
    it('should return empty array when no notes match', async () => {
      const results = await search.search('nonexistent keyword', { fuzzy: false });

      expect(results).to.be.an('array').that.is.empty;
      expect(mockIndexer.loadIndex).toHaveBeenCalled();
    });

    it('should return all notes when query is empty', async () => {
      const results = await search.search('', { fuzzy: false });

      expect(results).to.have.lengthOf(4);
    });

    it('should return exact match when query matches note content', async () => {
      const results = await search.search('meeting', { fuzzy: false });

      expect(results).to.have.lengthOf(1);
      expect(results[0].content).to.equal('Meeting at 3pm');
    });

    it('should be case-insensitive', async () => {
      const results = await search.search('MEETING', { fuzzy: false });

      expect(results).to.have.lengthOf(1);
      expect(results[0].content).to.equal('Meeting at 3pm');
    });

    it('should return multiple results for partial match', async () => {
      const results = await search.search('work', { fuzzy: false });

      expect(results).to.have.lengthOf(2);
      expect(results.every(r => r.content.toLowerCase().includes('work'))).to.be.true;
    });
  });

  describe('Tag Filtering', () => {
    it('should filter notes by single tag', async () => {
      const results = await search.search('meeting', { fuzzy: false, tags: ['work'] });

      expect(results).to.have.lengthOf(1);
      expect(results[0].content).to.equal('Meeting at 3pm');
      expect(results[0].tags).to.include('work');
    });

    it('should filter notes by multiple tags (AND logic)', async () => {
      const results = await search.search('important', { fuzzy: false, tags: ['work', 'urgent'] });

      expect(results).to.have.lengthOf(1);
      expect(results[0].content).to.equal('Important project deadline');
      expect(results[0].tags).to.include('work');
      expect(results[0].tags).to.include('urgent');
    });

    it('should return empty array when no notes match all tags', async () => {
      const results = await search.search('meeting', { fuzzy: false, tags: ['personal'] });

      expect(results).to.be.an('array').that.is.empty;
    });

    it('should handle tag filtering with no query', async () => {
      const results = await search.search('', { fuzzy: false, tags: ['work'] });

      expect(results).to.have.lengthOf(2);
      expect(results.every(r => r.tags.includes('work'))).to.be.true;
    });
  });

  describe('Fuzzy Search', () => {
    it('should find notes with typos using fuzzy matching', async () => {
      const results = await search.search('meetingg', { fuzzy: true });

      expect(results).to.have.lengthOf(1);
      expect(results[0].content).to.equal('Meeting at 3pm');
    });

    it('should find notes with similar words using fuzzy matching', async () => {
      const results = await search.search('call my mom', { fuzzy: true });

      expect(results).to.have.lengthOf(1);
      expect(results[0].content).to.equal('Call mom');
    });

    it('should combine fuzzy matching with tag filtering', async () => {
      const results = await search.search('call', { fuzzy: true, tags: ['personal'] });

      expect(results).to.have.lengthOf(1);
      expect(results[0].content).to.equal('Call mom');
      expect(results[0].tags).to.include('personal');
    });

    it('should handle fuzzy search with no matches', async () => {
      const results = await search.search('xyz123', { fuzzy: true });

      expect(results).to.be.an('array').that.is.empty;
    });

    it('should return exact matches when fuzzy is false', async () => {
      const results = await search.search('meeting', { fuzzy: false });

      expect(results).to.have.lengthOf(1);
      expect(results[0].content).to.equal('Meeting at 3pm');
    });
  });

  describe('Cache Behavior', () => {
    it('should cache search results', async () => {
      const query = 'meeting';
      const options = { fuzzy: false };

      // First search
      const results1 = await search.search(query, options);
      expect(results1).to.have.lengthOf(1);

      // Second search should use cache
      const results2 = await search.search(query, options);

      expect(results2).to.have.lengthOf(1);
      expect(results2[0].content).to.equal('Meeting at 3pm');
    });

    it('should invalidate cache when index revision changes', async () => {
      const query = 'meeting';
      const options = { fuzzy: false };

      // First search
      await search.search(query, options);

      // Change index revision
      mockIndex.rev = '2';
      mockIndex.notes = [
        { id: '1', content: 'New meeting', tags: ['work'], createdAt: 1234567890000 },
      ];

      // Second search should not use cache
      const results = await search.search(query, options);

      expect(results).to.have.lengthOf(1);
      expect(results[0].content).to.equal('New meeting');
    });

    it('should use cache when index revision is same', async () => {
      const query = 'meeting';
      const options = { fuzzy: false };

      // First search
      await search.search(query, options);

      // Change index but keep same revision
      mockIndex.notes = [
        { id: '1', content: 'Updated meeting', tags: ['work'], createdAt: 1234567890000 },
      ];

      // Second search should use cache (revision unchanged)
      const results = await search.search(query, options);

      expect(results).to.have.lengthOf(1);
      expect(results[0].content).to.equal('Meeting at 3pm'); // From cache
    });

    it('should generate unique cache keys for different queries', async () => {
      const options = { fuzzy: false };

      await search.search('query1', options);
      await search.search('query2', options);
      await search.search('query1', options);

      // Should have at least 2 unique cache entries
      expect(search.cache.size).to.be.at.least(2);
    });

    it('should generate unique cache keys with tags', async () => {
      const options = { fuzzy: false, tags: ['work'] };

      await search.search('meeting', options);
      await search.search('meeting', options);

      // Should have 1 cache entry (tags same)
      expect(search.cache.size).to.equal(1);
    });
  });

  describe('Cache TTL', () => {
    it('should invalidate cache after TTL expires', async () => {
      search = new CachedSearch({
        indexer: mockIndexer,
        maxSize: 10,
        ttl: 100, // 100ms TTL
      });

      const query = 'meeting';
      const options = { fuzzy: false };

      // First search
      await search.search(query, options);
      expect(search.cache.size).to.be.at.least(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second search should reload index
      const results = await search.search(query, options);

      expect(results).to.have.lengthOf(1);
      expect(results[0].content).to.equal('Meeting at 3pm');
    });

    it('should use cache before TTL expires', async () => {
      search = new CachedSearch({
        indexer: mockIndexer,
        maxSize: 10,
        ttl: 100, // 100ms TTL
      });

      const query = 'meeting';
      const options = { fuzzy: false };

      // First search
      await search.search(query, options);

      // Wait 50ms (still within TTL)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Second search should use cache
      const results = await search.search(query, options);

      expect(results).to.have.lengthOf(1);
    });
  });

  describe('Force Refresh', () => {
    it('should bypass cache when forceRefresh is true', async () => {
      const query = 'meeting';
      const options = { fuzzy: false, forceRefresh: true };

      // First search
      await search.search(query, options);

      // Change index revision
      mockIndex.rev = '2';
      mockIndex.notes = [
        { id: '1', content: 'New content', tags: ['work'], createdAt: 1234567890000 },
      ];

      // Second search with forceRefresh should bypass cache
      const results = await search.search(query, options);

      expect(results).to.have.lengthOf(1);
      expect(results[0].content).to.equal('New content');
    });
  });

  describe('Index Loading', () => {
    it('should load index on first search', async () => {
      await search.search('meeting', { fuzzy: false });

      expect(mockIndexer.loadIndex).toHaveBeenCalled();
    });

    it('should load index when cache is invalid', async () => {
      // First search
      await search.search('meeting', { fuzzy: false });

      // Change index revision
      mockIndex.rev = '2';

      // Second search should reload index
      await search.search('meeting', { fuzzy: false });

      expect(mockIndexer.loadIndex).toHaveBeenCalledTimes(2);
    });

    it('should not reload index when cache is valid', async () => {
      // First search
      await search.search('meeting', { fuzzy: false });

      // Change index revision but keep cache valid
      mockIndex.rev = '2';

      // Second search with same query should not reload index
      await search.search('meeting', { fuzzy: false });

      expect(mockIndexer.loadIndex).toHaveBeenCalledTimes(1);
    });
  });

  describe('Limit Parameter', () => {
    it('should limit number of results', async () => {
      const results = await search.search('work', { fuzzy: false, limit: 1 });

      expect(results).to.have.lengthOf(1);
    });

    it('should not limit when limit is not specified', async () => {
      const results = await search.search('work', { fuzzy: false });

      expect(results).to.have.lengthOf(2);
    });

    it('should respect limit even with fuzzy search', async () => {
      const results = await search.search('call', { fuzzy: true, limit: 1 });

      expect(results).to.have.lengthOf(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query with tags', async () => {
      const results = await search.search('', { fuzzy: false, tags: ['work'] });

      expect(results).to.have.lengthOf(2);
    });

    it('should handle query with only whitespace', async () => {
      const results = await search.search('   ', { fuzzy: false });

      expect(results).to.have.lengthOf(4);
    });

    it('should handle tags array with empty string', async () => {
      const results = await search.search('meeting', { fuzzy: false, tags: ['work', ''] });

      expect(results).to.have.lengthOf(1);
    });

    it('should handle very long query string', async () => {
      const longQuery = 'a'.repeat(1000);
      const results = await search.search(longQuery, { fuzzy: false });

      expect(results).to.be.an('array').that.is.empty;
    });

    it('should handle query with special characters', async () => {
      const results = await search.search('meeting@3pm', { fuzzy: false });

      expect(results).to.have.lengthOf(1);
    });

    it('should handle notes with special characters in content', async () => {
      mockIndex.notes = [
        { id: '1', content: 'Buy groceries @ store!', tags: ['shopping'], createdAt: 1234567890000 },
      ];

      const results = await search.search('@ store!', { fuzzy: false });

      expect(results).to.have.lengthOf(1);
    });
  });

  describe('Performance', () => {
    it('should handle large number of notes efficiently', async () => {
      const largeIndex = {
        notes: Array.from({ length: 1000 }, (_, i) => ({
          id: String(i),
          content: `Note ${i} for testing`,
          tags: i % 10 === 0 ? ['important'] : [],
          createdAt: 1234567890000 + i,
        })),
        rev: '1',
      };

      mockIndex.notes = largeIndex.notes;
      mockIndex.rev = '1';

      const startTime = Date.now();
      const results = await search.search('important', { fuzzy: false });
      const endTime = Date.now();

      expect(results).to.have.lengthOf.at.most(100);
      expect(endTime - startTime).to.be.lessThan(100); // Should complete in <100ms
    });

    it('should handle multiple consecutive searches efficiently', async () => {
      const queries = ['meeting', 'groceries', 'call', 'work', 'important'];

      const startTime = Date.now();
      for (const query of queries) {
        await search.search(query, { fuzzy: false });
      }
      const endTime = Date.now();

      // Should complete in <500ms for 5 searches
      expect(endTime - startTime).to.be.lessThan(500);
    });
  });
});

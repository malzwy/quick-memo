/**
 * Indexer Module Test Suite
 * Coverage target: 85%+
 */

const { expect } = require('chai');
const { describe, it, beforeEach, afterEach } = require('mocha');
const {
  loadIndex,
  getIndexPath,
  needsRebuild,
  generateIndex,
  stampIndex,
  readIndex,
  isIndexFresh,
} = require('../../../src/lib/indexer');
const fs = require('fs-extra');
const path = require('path');

describe('Indexer Module', () => {
  let tempDir;
  let notesData;
  let indexPath;
  let indexFile;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(__dirname, '..', '..', '..', 'temp', 'indexer-test-' + Date.now());
    await fs.ensureDir(tempDir);

    // Setup test data
    notesData = [
      {
        id: '1',
        content: 'Buy groceries',
        tags: ['shopping'],
        createdAt: 1234567890000,
        updatedAt: 1234567890000,
      },
      {
        id: '2',
        content: 'Meeting at 3pm',
        tags: ['work'],
        createdAt: 1234567891000,
        updatedAt: 1234567891000,
      },
      {
        id: '3',
        content: 'Call mom',
        tags: ['personal'],
        createdAt: 1234567892000,
        updatedAt: 1234567892000,
      },
    ];

    indexPath = path.join(tempDir, 'profiles.index.json');
    indexFile = indexPath;
  });

  afterEach(async () => {
    // Cleanup temporary directory
    if (fs.existsSync(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('generateIndex', () => {
    it('should generate index from notes data', () => {
      const index = generateIndex(notesData);

      expect(index).to.have.property('version', 1);
      expect(index).to.have.property('generated');
      expect(index).to.have.property('projects');
      expect(index.projects).to.be.an('object');
    });

    it('should create project entries for each note', () => {
      const index = generateIndex(notesData);

      expect(Object.keys(index.projects)).to.have.lengthOf(3);
      expect(index.projects['1']).to.exist;
      expect(index.projects['2']).to.exist;
      expect(index.projects['3']).to.exist;
    });

    it('should extract tags from notes', () => {
      const index = generateIndex(notesData);

      expect(index.projects['1']).to.have.property('tags');
      expect(index.projects['1'].tags).to.include('shopping');

      expect(index.projects['2']).to.have.property('tags');
      expect(index.projects['2'].tags).to.include('work');

      expect(index.projects['3']).to.have.property('tags');
      expect(index.projects['3'].tags).to.include('personal');
    });

    it('should handle notes with no tags', () => {
      const notesWithoutTags = [
        {
          id: '1',
          content: 'No tags note',
          tags: [],
          createdAt: 1234567890000,
          updatedAt: 1234567890000,
        },
      ];

      const index = generateIndex(notesWithoutTags);

      expect(index.projects['1']).to.have.property('tags');
      expect(index.projects['1'].tags).to.be.an('array').that.is.empty;
    });

    it('should handle empty notes array', () => {
      const index = generateIndex([]);

      expect(index.projects).to.be.an('object').that.is.empty;
    });

    it('should handle notes with multiple tags', () => {
      const notesWithMultipleTags = [
        {
          id: '1',
          content: 'Important work project',
          tags: ['work', 'important', 'urgent'],
          createdAt: 1234567890000,
          updatedAt: 1234567890000,
        },
      ];

      const index = generateIndex(notesWithMultipleTags);

      expect(index.projects['1'].tags).to.have.lengthOf(3);
      expect(index.projects['1'].tags).to.include('work');
      expect(index.projects['1'].tags).to.include('important');
      expect(index.projects['1'].tags).to.include('urgent');
    });

    it('should preserve note IDs', () => {
      const index = generateIndex(notesData);

      expect(index.projects['1']).to.exist;
      expect(index.projects['2']).to.exist;
      expect(index.projects['3']).to.exist;
    });

    it('should include timestamp in generated field', () => {
      const index = generateIndex(notesData);

      expect(index.generated).to.be.a('number');
      expect(index.generated).to.be.at.least(0);
    });

    it('should not mutate input data', () => {
      const originalNotes = JSON.parse(JSON.stringify(notesData));

      generateIndex(notesData);

      expect(notesData).to.deep.equal(originalNotes);
    });
  });

  describe('readIndex', () => {
    it('should read valid index file', async () => {
      const indexData = {
        version: 1,
        generated: Date.now(),
        projects: {
          '1': { tags: ['shopping'] },
        },
      };

      await fs.writeJson(indexPath, indexData);

      const index = readIndex();

      expect(index).to.deep.equal(indexData);
    });

    it('should return null for non-existent file', () => {
      const index = readIndex();

      expect(index).to.be.null;
    });

    it('should return null for invalid JSON', async () => {
      await fs.writeFile(indexPath, 'invalid json');

      const index = readIndex();

      expect(index).to.be.null;
    });

    it('should return null for invalid index structure', async () => {
      const invalidData = {
        version: 2, // Wrong version
        generated: Date.now(),
        projects: {},
      };

      await fs.writeJson(indexPath, invalidData);

      const index = readIndex();

      expect(index).to.be.null;
    });

    it('should return null for empty file', async () => {
      await fs.writeFile(indexPath, '');

      const index = readIndex();

      expect(index).to.be.null;
    });

    it('should handle file system errors gracefully', async () => {
      // Mock fs.existsSync to throw error
      const originalExistsSync = fs.existsSync;
      fs.existsSync = jest.fn(() => {
        throw new Error('File system error');
      });

      const index = readIndex();

      // Restore original function
      fs.existsSync = originalExistsSync;

      expect(index).to.be.null;
    });
  });

  describe('getIndexPath', () => {
    it('should return correct path format', () => {
      const path = getIndexPath();

      expect(path).to.be.a('string');
      expect(path).to.endWith('.index.json');
    });
  });

  describe('isIndexFresh', () => {
    it('should return true for matching mtime and size', () => {
      const stats = {
        mtimeMs: 1234567890000,
        size: 1000,
      };

      const index = {
        sourceMtime: 1234567890000,
        sourceSize: 1000,
      };

      const fresh = isIndexFresh(index, stats);

      expect(fresh).to.be.true;
    });

    it('should return false for different mtime', () => {
      const stats = {
        mtimeMs: 1234567890000,
        size: 1000,
      };

      const index = {
        sourceMtime: 1234567891000, // Different mtime
        sourceSize: 1000,
      };

      const fresh = isIndexFresh(index, stats);

      expect(fresh).to.be.false;
    });

    it('should return false for different size', () => {
      const stats = {
        mtimeMs: 1234567890000,
        size: 1000,
      };

      const index = {
        sourceMtime: 1234567890000,
        sourceSize: 2000, // Different size
      };

      const fresh = isIndexFresh(index, stats);

      expect(fresh).to.be.false;
    });

    it('should return false for null index', () => {
      const stats = {
        mtimeMs: 1234567890000,
        size: 1000,
      };

      const fresh = isIndexFresh(null, stats);

      expect(fresh).to.be.false;
    });

    it('should return false for null stats', () => {
      const index = {
        sourceMtime: 1234567890000,
        sourceSize: 1000,
      };

      const fresh = isIndexFresh(index, null);

      expect(fresh).to.be.false;
    });

    it('should return false for null index and stats', () => {
      const fresh = isIndexFresh(null, null);

      expect(fresh).to.be.false;
    });
  });

  describe('stampIndex', () => {
    it('should attach mtime and size to index', () => {
      const stats = {
        mtimeMs: 1234567890000,
        size: 1000,
      };

      const index = { version: 1 };

      const stamped = stampIndex(index, stats);

      expect(stamped).to.have.property('sourceMtime', 1234567890000);
      expect(stamped).to.have.property('sourceSize', 1000);
    });

    it('should not mutate original index', () => {
      const stats = {
        mtimeMs: 1234567890000,
        size: 1000,
      };

      const originalIndex = { version: 1 };

      stampIndex(originalIndex, stats);

      expect(originalIndex).to.not.have.property('sourceMtime');
      expect(originalIndex).to.not.have.property('sourceSize');
    });

    it('should handle empty index', () => {
      const stats = {
        mtimeMs: 1234567890000,
        size: 1000,
      };

      const stamped = stampIndex({}, stats);

      expect(stamped.sourceMtime).to.equal(1234567890000);
      expect(stamped.sourceSize).to.equal(1000);
    });

    it('should handle index with existing properties', () => {
      const stats = {
        mtimeMs: 1234567890000,
        size: 1000,
      };

      const index = {
        version: 1,
        generated: 1234567890000,
        projects: {},
      };

      const stamped = stampIndex(index, stats);

      expect(stamped.version).to.equal(1);
      expect(stamped.generated).to.equal(1234567890000);
      expect(stamped.sourceMtime).to.equal(1234567890000);
      expect(stamped.sourceSize).to.equal(1000);
    });
  });

  describe('needsRebuild', () => {
    it('should return true when index is null', () => {
      const needsRebuild = needsRebuild(null);

      expect(needsRebuild).to.be.true;
    });

    it('should return true when stats are null', () => {
      const index = { version: 1 };
      const needsRebuild = needsRebuild(index, null);

      expect(needsRebuild).to.be.true;
    });

    it('should return false when both index and stats exist', () => {
      const stats = {
        mtimeMs: 1234567890000,
        size: 1000,
      };

      const index = {
        sourceMtime: 1234567890000,
        sourceSize: 1000,
      };

      const needsRebuild = needsRebuild(index, stats);

      expect(needsRebuild).to.be.false;
    });

    it('should return true when index sourceMtime does not match stats', () => {
      const stats = {
        mtimeMs: 1234567890000,
        size: 1000,
      };

      const index = {
        sourceMtime: 1234567891000, // Different
        sourceSize: 1000,
      };

      const needsRebuild = needsRebuild(index, stats);

      expect(needsRebuild).to.be.true;
    });

    it('should return true when index sourceSize does not match stats', () => {
      const stats = {
        mtimeMs: 1234567890000,
        size: 1000,
      };

      const index = {
        sourceMtime: 1234567890000,
        sourceSize: 2000, // Different
      };

      const needsRebuild = needsRebuild(index, stats);

      expect(needsRebuild).to.be.true;
    });
  });

  describe('Integration Tests', () => {
    it('should complete full index lifecycle', async () => {
      // Generate index
      const index = generateIndex(notesData);

      // Stamp index with stats
      const stats = {
        mtimeMs: Date.now(),
        size: 1000,
      };

      const stampedIndex = stampIndex(index, stats);

      // Write to file
      await fs.writeJson(indexPath, stampedIndex);

      // Read back
      const loadedIndex = readIndex();

      expect(loadedIndex).to.exist;
      expect(loadedIndex.version).to.equal(1);
      expect(loadedIndex.sourceMtime).to.equal(stats.mtimeMs);
      expect(loadedIndex.sourceSize).to.equal(stats.size);
    });

    it('should detect when index needs rebuild', async () => {
      // Generate and stamp index
      const index = generateIndex(notesData);
      const stats = {
        mtimeMs: Date.now(),
        size: 1000,
      };

      const stampedIndex = stampIndex(index, stats);

      await fs.writeJson(indexPath, stampedIndex);

      // Check if needs rebuild (should be false initially)
      const currentStats = {
        mtimeMs: stampedIndex.sourceMtime,
        size: stampedIndex.sourceSize,
      };

      expect(needsRebuild(stampedIndex, currentStats)).to.be.false;

      // Modify the index file
      await fs.writeJson(indexPath, { version: 2, generated: Date.now() });

      // Check if needs rebuild (should be true after modification)
      const newStats = await fs.stat(indexPath);

      expect(needsRebuild(stampedIndex, newStats)).to.be.true;
    });
  });
});

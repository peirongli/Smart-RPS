import { SchemaLibrary } from '../src/core/SchemaLibrary';

describe('SchemaLibrary', () => {
  let schemaLibrary: SchemaLibrary;

  beforeEach(() => {
    schemaLibrary = new SchemaLibrary();
  });

  describe('addSchema', () => {
    it('should add a valid schema', () => {
      const schema = {
        name: 'test_schema',
        description: 'Test schema',
        jsonSchema: '{"type": "object", "properties": {"name": {"type": "string"}}}'
      };

      const result = schemaLibrary.addSchema('test_schema', schema);
      expect(result).toBe(true);
      expect(schemaLibrary.hasSchema('test_schema')).toBe(true);
    });

    it('should reject invalid JSON schema', () => {
      const schema = {
        name: 'invalid_schema',
        description: 'Invalid schema',
        jsonSchema: '{"invalid": "json"'
      };

      const result = schemaLibrary.addSchema('invalid_schema', schema);
      expect(result).toBe(false);
      expect(schemaLibrary.hasSchema('invalid_schema')).toBe(false);
    });

    it('should reject schema without name', () => {
      const schema = {
        name: '',
        description: 'No name schema',
        jsonSchema: '{"type": "object"}'
      };

      const result = schemaLibrary.addSchema('empty_name', schema);
      expect(result).toBe(false);
    });
  });

  describe('getSchema', () => {
    it('should return schema when it exists', () => {
      const schema = {
        name: 'existing_schema',
        description: 'Existing schema',
        jsonSchema: '{"type": "object"}'
      };

      schemaLibrary.addSchema('existing_schema', schema);
      const retrieved = schemaLibrary.getSchema('existing_schema');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('existing_schema');
    });

    it('should return undefined for non-existent schema', () => {
      const retrieved = schemaLibrary.getSchema('non_existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('isValid', () => {
    it('should return true for valid schema', () => {
      const schema = {
        name: 'valid_schema',
        description: 'Valid schema',
        jsonSchema: '{"type": "object", "properties": {"id": {"type": "number"}}}'
      };

      schemaLibrary.addSchema('valid_schema', schema);
      expect(schemaLibrary.isValid('valid_schema')).toBe(true);
    });

    it('should return false for invalid schema', () => {
      const schema = {
        name: 'invalid_schema',
        description: 'Invalid schema',
        jsonSchema: '{"invalid": "json"'
      };

      schemaLibrary.addSchema('invalid_schema', schema);
      expect(schemaLibrary.isValid('invalid_schema')).toBe(false);
    });
  });

  describe('removeSchema', () => {
    it('should remove existing schema', () => {
      const schema = {
        name: 'to_remove',
        description: 'Schema to remove',
        jsonSchema: '{"type": "object"}'
      };

      schemaLibrary.addSchema('to_remove', schema);
      expect(schemaLibrary.hasSchema('to_remove')).toBe(true);

      const result = schemaLibrary.removeSchema('to_remove');
      expect(result).toBe(true);
      expect(schemaLibrary.hasSchema('to_remove')).toBe(false);
    });

    it('should return false for non-existent schema', () => {
      const result = schemaLibrary.removeSchema('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('exportToJson', () => {
    it('should export all schemas', () => {
      const schema1 = {
        name: 'schema1',
        description: 'First schema',
        jsonSchema: '{"type": "object"}'
      };

      const schema2 = {
        name: 'schema2',
        description: 'Second schema',
        jsonSchema: '{"type": "array"}'
      };

      schemaLibrary.addSchema('schema1', schema1);
      schemaLibrary.addSchema('schema2', schema2);

      const exported = schemaLibrary.exportToJson();
      expect(exported).toHaveLength(2);
      expect(exported.map(s => s.name)).toContain('schema1');
      expect(exported.map(s => s.name)).toContain('schema2');
    });

    it('should return empty array when no schemas', () => {
      const exported = schemaLibrary.exportToJson();
      expect(exported).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should remove all schemas', () => {
      const schema = {
        name: 'test_schema',
        description: 'Test schema',
        jsonSchema: '{"type": "object"}'
      };

      schemaLibrary.addSchema('test_schema', schema);
      expect(schemaLibrary.hasSchema('test_schema')).toBe(true);

      schemaLibrary.clear();
      expect(schemaLibrary.hasSchema('test_schema')).toBe(false);
      expect(schemaLibrary.size).toBe(0);
    });
  });
});

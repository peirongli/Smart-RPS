import { SchemaEntry } from '../types/index.js';

export class SchemaLibrary {
  private _schemas: Map<string, SchemaEntry> = new Map();

  constructor() {}

  addSchema(name: string, schema: SchemaEntry): boolean {
    try {
      if (!schema.name || !schema.jsonSchema) {
        return false;
      }

      // Validate JSON schema
      try {
        JSON.parse(schema.jsonSchema);
      } catch (error) {
        return false;
      }

      this._schemas.set(name, schema);
      return true;
    } catch (error) {
      return false;
    }
  }

  removeSchema(name: string): boolean {
    return this._schemas.delete(name);
  }

  getSchema(name: string): SchemaEntry | undefined {
    return this._schemas.get(name);
  }

  getParsedSchema(name: string): SchemaEntry | undefined {
    const schema = this._schemas.get(name);
    if (!schema) return undefined;

    try {
      // Validate that the JSON schema is parseable
      JSON.parse(schema.jsonSchema);
      return schema;
    } catch (error) {
      return undefined;
    }
  }

  hasSchema(name: string): boolean {
    return this._schemas.has(name);
  }

  isValid(name: string): boolean {
    const schema = this._schemas.get(name);
    if (!schema) return false;

    try {
      JSON.parse(schema.jsonSchema);
      return true;
    } catch (error) {
      return false;
    }
  }

  getAllSchemaNames(): string[] {
    return Array.from(this._schemas.keys());
  }

  getValidSchemaNames(): string[] {
    return Array.from(this._schemas.keys()).filter(name => this.isValid(name));
  }

  loadFromJson(schemas: SchemaEntry[]): boolean {
    try {
      for (const schema of schemas) {
        if (this.addSchema(schema.name, schema)) {
          // Schema added successfully
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  exportToJson(): SchemaEntry[] {
    return Array.from(this._schemas.values());
  }

  clear(): void {
    this._schemas.clear();
  }

  get size(): number {
    return this._schemas.size;
  }
}

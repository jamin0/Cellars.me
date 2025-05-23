import { 
  wines, 
  wineCatalog, 
  users,
  type Wine, 
  type InsertWine, 
  type WineCatalog, 
  type InsertWineCatalog,
  type VintageStock,
  type User,
  type UpsertUser
} from "@shared/schema";
import fs from 'fs';
import { createReadStream } from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { db } from './db';
import { eq, or, sql, and, ilike } from 'drizzle-orm';

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Wine inventory management (user-specific)
  getWines(userId: string): Promise<Wine[]>;
  getWineById(id: number, userId: string): Promise<Wine | undefined>;
  getWinesByCategory(category: string, userId: string): Promise<Wine[]>;
  addWine(wine: InsertWine, userId: string): Promise<Wine>;
  updateWine(id: number, wine: Partial<InsertWine>, userId: string): Promise<Wine | undefined>;
  deleteWine(id: number, userId: string): Promise<boolean>;
  
  // Wine catalog management (from CSV) - shared across all users
  getWineCatalog(): Promise<WineCatalog[]>;
  searchWineCatalog(query: string): Promise<WineCatalog[]>;
  loadWineCatalogFromCSV(filePath: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private wineStore: Map<number, Wine>;
  private catalogStore: Map<number, WineCatalog>;
  private wineCurrentId: number;
  private catalogCurrentId: number;

  constructor() {
    this.wineStore = new Map();
    this.catalogStore = new Map();
    this.wineCurrentId = 1;
    this.catalogCurrentId = 1;

    // Try to load the wine catalog from CSV on initialization
    this.loadWineCatalogFromCSV(path.join(process.cwd(), 'server/data/winedb2.csv'))
      .catch(err => console.error('Failed to load wine catalog:', err));
  }

  // Wine Inventory Methods
  async getWines(): Promise<Wine[]> {
    return Array.from(this.wineStore.values());
  }

  async getWineById(id: number): Promise<Wine | undefined> {
    return this.wineStore.get(id);
  }

  async getWinesByCategory(category: string): Promise<Wine[]> {
    return Array.from(this.wineStore.values()).filter(
      wine => wine.category === category
    );
  }

  async addWine(wine: InsertWine): Promise<Wine> {
    const id = this.wineCurrentId++;
    const createdAt = new Date().toISOString();
    const newWine: Wine = { ...wine, id, createdAt };
    this.wineStore.set(id, newWine);
    return newWine;
  }

  async updateWine(id: number, wine: Partial<InsertWine>): Promise<Wine | undefined> {
    const existingWine = this.wineStore.get(id);
    if (!existingWine) return undefined;

    const updatedWine: Wine = { ...existingWine, ...wine };
    this.wineStore.set(id, updatedWine);
    return updatedWine;
  }

  async deleteWine(id: number): Promise<boolean> {
    return this.wineStore.delete(id);
  }

  // Wine Catalog Methods (from CSV)
  async getWineCatalog(): Promise<WineCatalog[]> {
    return Array.from(this.catalogStore.values());
  }

  async searchWineCatalog(query: string): Promise<WineCatalog[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.catalogStore.values()).filter(wine => 
      wine.name.toLowerCase().includes(lowerQuery) || 
      (wine.producer && wine.producer.toLowerCase().includes(lowerQuery))
    );
  }

  async loadWineCatalogFromCSV(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Make sure the data directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create an empty CSV file if it doesn't exist
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, 'name,category,producer,region,country\n');
      }

      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      const readableStream = createReadStream(filePath);

      parser.on('readable', () => {
        let record;
        while ((record = parser.read()) !== null) {
          const id = this.catalogCurrentId++;
          const wineEntry: WineCatalog = {
            id,
            name: record.name || '',
            category: record.category || 'Other',
            producer: record.producer || '',
            region: record.region || '',
            country: record.country || ''
          };
          this.catalogStore.set(id, wineEntry);
        }
      });

      parser.on('error', (err) => {
        reject(err);
      });

      parser.on('end', () => {
        resolve();
      });

      readableStream.pipe(parser);
    });
  }
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // We no longer automatically load the CSV data on startup
    // This ensures catalog data remains persistent
  }

  // Wine Inventory Methods
  async getWines(): Promise<Wine[]> {
    const result = await db.select().from(wines);
    return result;
  }

  async getWineById(id: number): Promise<Wine | undefined> {
    const [wine] = await db.select().from(wines).where(eq(wines.id, id));
    return wine;
  }

  async getWinesByCategory(category: string): Promise<Wine[]> {
    const result = await db.select().from(wines).where(eq(wines.category, category));
    return result;
  }

  async addWine(wine: InsertWine): Promise<Wine> {
    const now = new Date().toISOString();
    
    // Ensure proper data types and defaults
    const wineData = {
      ...wine,
      vintageStocks: Array.isArray(wine.vintageStocks) ? wine.vintageStocks : [],
      notes: wine.notes || null,
      rating: wine.rating !== undefined ? wine.rating : null,
      createdAt: now
    };
    
    console.log("Adding wine with data:", wineData);
    
    const [result] = await db.insert(wines).values(wineData).returning();
    return result;
  }

  async updateWine(id: number, wine: Partial<InsertWine>): Promise<Wine | undefined> {
    console.log("Updating wine with ID:", id, "Data:", wine);
    
    // Validate and sanitize input values for update
    // Define as any object to avoid type errors in column names
    const updateData: Record<string, any> = {};
    
    // Handle each field individually to ensure proper typing
    if (wine.name !== undefined) updateData.name = wine.name;
    if (wine.category !== undefined) updateData.category = wine.category;
    if (wine.wine !== undefined) updateData.wine = wine.wine;
    if (wine.subType !== undefined) updateData.sub_type = wine.subType; // Column name is sub_type in DB
    if (wine.producer !== undefined) updateData.producer = wine.producer;
    if (wine.region !== undefined) updateData.region = wine.region;
    if (wine.country !== undefined) updateData.country = wine.country;
    // Only use notes field (description field is removed)
    if (wine.notes !== undefined) updateData.notes = wine.notes;
    if (wine.description !== undefined) updateData.notes = wine.description; // For backward compatibility
    if (wine.rating !== undefined) updateData.rating = wine.rating;
    if (wine.stockLevel !== undefined) updateData.stock_level = wine.stockLevel; // Column name is stock_level in DB
    if (wine.imageUrl !== undefined) updateData.image_url = wine.imageUrl; // Column name is image_url in DB
    
    // Handle vintage stocks specially to ensure it's an array
    if (wine.vintageStocks !== undefined) {
      updateData.vintageStocks = Array.isArray(wine.vintageStocks) 
        ? wine.vintageStocks 
        : [];
    }
    
    const [result] = await db.update(wines)
      .set(updateData)
      .where(eq(wines.id, id))
      .returning();
      
    return result;
  }

  async deleteWine(id: number): Promise<boolean> {
    const result = await db.delete(wines).where(eq(wines.id, id));
    return !!result;
  }

  // Wine Catalog Methods (from CSV)
  async getWineCatalog(): Promise<WineCatalog[]> {
    const result = await db.select().from(wineCatalog);
    return result;
  }

  async searchWineCatalog(query: string): Promise<WineCatalog[]> {
    if (query.length < 3) return [];
    
    // Use ilike for case-insensitive search
    const searchPattern = `%${query}%`;
    const result = await db.select().from(wineCatalog).where(
      or(
        sql`${wineCatalog.name} ilike ${searchPattern}`,
        sql`${wineCatalog.wine} ilike ${searchPattern}`,
        sql`${wineCatalog.subType} ilike ${searchPattern}`,
        sql`${wineCatalog.producer} ilike ${searchPattern}`,
        sql`${wineCatalog.region} ilike ${searchPattern}`,
        sql`${wineCatalog.country} ilike ${searchPattern}`
      )
    );
    return result;
  }

  async loadWineCatalogFromCSV(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Make sure the data directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Check if the CSV file exists
        if (!fs.existsSync(filePath)) {
          console.log("CSV file doesn't exist, skipping catalog import");
          resolve();
          return;
        }

        // First check if we already have catalog data in the database
        // If we do, we'll skip importing to preserve any user changes
        db.select({ count: sql`count(*)` })
          .from(wineCatalog)
          .then(async (result) => {
            const count = Number(result[0]?.count || 0);
            
            // If we already have data, don't reimport
            if (count > 0) {
              console.log(`Wine catalog already has ${count} entries, skipping import to preserve data`);
              resolve();
              return;
            }

            // Otherwise proceed with importing only for the first time
            console.log("Wine catalog is empty, importing initial data from CSV");
            
            const parser = parse({
              columns: true,
              skip_empty_lines: true,
              trim: true
            });

            const wines: InsertWineCatalog[] = [];

            parser.on('readable', () => {
              let record;
              while ((record = parser.read()) !== null) {
                wines.push({
                  name: record.NAME || record.name || '',
                  category: record.TYPE || record.category || 'Other',
                  wine: record.WINE || record.wine || null,
                  subType: record.SUB_TYPE || record.subType || null,
                  producer: record.PRODUCER || record.producer || null,
                  region: record.REGION || record.region || null,
                  country: record.COUNTRY || record.country || null
                });
              }
            });

            parser.on('error', (err) => {
              reject(err);
            });

            parser.on('end', async () => {
              try {
                // Only insert new data - we no longer delete existing data
                if (wines.length > 0) {
                  await db.insert(wineCatalog).values(wines);
                  console.log(`Imported ${wines.length} wines to catalog`);
                }
                resolve();
              } catch (error) {
                reject(error);
              }
            });

            createReadStream(filePath).pipe(parser);
          })
          .catch(error => {
            reject(error);
          });
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Export an instance of the database storage
export const storage = new DatabaseStorage();

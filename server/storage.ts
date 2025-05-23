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

export class DatabaseStorage implements IStorage {
  constructor() {
    console.log("DatabaseStorage initialized with database connection");
    
    // Try to load the wine catalog from CSV on initialization
    this.loadWineCatalogFromCSV(path.join(process.cwd(), 'server/data/winedb2.csv'))
      .catch(err => console.error('Failed to load wine catalog:', err));
  }

  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Wine inventory management (user-specific)
  async getWines(userId: string): Promise<Wine[]> {
    return await db.select().from(wines).where(eq(wines.userId, userId));
  }

  async getWineById(id: number, userId: string): Promise<Wine | undefined> {
    const [wine] = await db.select().from(wines).where(and(eq(wines.id, id), eq(wines.userId, userId)));
    return wine;
  }

  async getWinesByCategory(category: string, userId: string): Promise<Wine[]> {
    return await db.select().from(wines).where(and(eq(wines.category, category), eq(wines.userId, userId)));
  }

  async addWine(wine: InsertWine, userId: string): Promise<Wine> {
    const [newWine] = await db
      .insert(wines)
      .values({ ...wine, userId })
      .returning();
    return newWine;
  }

  async updateWine(id: number, wine: Partial<InsertWine>, userId: string): Promise<Wine | undefined> {
    const [updatedWine] = await db
      .update(wines)
      .set(wine)
      .where(and(eq(wines.id, id), eq(wines.userId, userId)))
      .returning();
    return updatedWine;
  }

  async deleteWine(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(wines).where(and(eq(wines.id, id), eq(wines.userId, userId)));
    return result.rowCount > 0;
  }

  // Wine catalog management (shared across all users)
  async getWineCatalog(): Promise<WineCatalog[]> {
    return await db.select().from(wineCatalog);
  }

  async searchWineCatalog(query: string): Promise<WineCatalog[]> {
    if (!query.trim()) {
      return this.getWineCatalog();
    }

    const searchPattern = `%${query}%`;
    return await db.select().from(wineCatalog).where(
      or(
        ilike(wineCatalog.name, searchPattern),
        ilike(wineCatalog.category, searchPattern),
        ilike(wineCatalog.producer, searchPattern),
        ilike(wineCatalog.region, searchPattern),
        ilike(wineCatalog.country, searchPattern)
      )
    );
  }

  async loadWineCatalogFromCSV(filePath: string): Promise<void> {
    try {
      // Check if file exists first
      if (!fs.existsSync(filePath)) {
        console.warn(`Wine catalog CSV file not found at ${filePath}. Skipping catalog load.`);
        return;
      }

      console.log(`Loading wine catalog from ${filePath}...`);
      
      const records: any[] = [];
      
      await new Promise<void>((resolve, reject) => {
        createReadStream(filePath)
          .pipe(parse({ 
            headers: true, 
            skip_empty_lines: true,
            delimiter: ',',
            quote: '"',
            escape: '"'
          }))
          .on('data', (record) => {
            records.push(record);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (err) => {
            reject(err);
          });
      });

      // Clear existing catalog
      await db.delete(wineCatalog);

      // Prepare data for insertion
      const catalogEntries = records
        .filter(record => record.NAME && record.CATEGORY)
        .map(record => ({
          name: record.NAME,
          category: record.CATEGORY,
          wine: record.WINE || null,
          subType: record.SUBTYPE || null,
          producer: record.PRODUCER || null,
          region: record.REGION || null,
          country: record.COUNTRY || null,
        }));

      // Insert in batches to avoid potential memory issues
      if (catalogEntries.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < catalogEntries.length; i += batchSize) {
          const batch = catalogEntries.slice(i, i + batchSize);
          await db.insert(wineCatalog).values(batch);
        }
      }

      console.log(`Successfully loaded ${catalogEntries.length} wine entries into catalog`);
    } catch (error) {
      console.error('Error loading wine catalog from CSV:', error);
      // Don't throw the error - this shouldn't prevent the app from starting
    }
  }
}

export const storage = new DatabaseStorage();
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
import { pool } from './db';
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
}

export class DatabaseStorage implements IStorage {
  constructor() {
    console.log("DatabaseStorage initialized with database connection");

    // Note: Wine catalog loading is now done manually via API endpoint
    // to prevent overwriting existing data on startup
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
    try {
      console.log('Adding wine with data:', wine);
      
      // Create the wine data object with proper types
      const wineInsert = {
        name: wine.name,
        category: wine.category,
        wine: wine.wine,
        subType: wine.subType,
        producer: wine.producer,
        region: wine.region,
        country: wine.country,
        stockLevel: wine.stockLevel || 0,
        vintageStocks: wine.vintageStocks || [],
        imageUrl: wine.imageUrl,
        rating: wine.rating,
        notes: wine.notes,
        userId: userId
      };

      const [newWine] = await db.insert(wines).values(wineInsert).returning();
      return newWine;
    } catch (error) {
      console.error('Error adding wine:', error);
      console.error('Wine data that failed:', wine);
      throw error;
    }
  }

  async updateWine(id: number, wine: Partial<InsertWine>, userId: string): Promise<Wine | undefined> {
    try {
      console.log('Updating wine with data:', wine);
      
      // First, get the current wine to merge with updates
      const [currentWine] = await db
        .select()
        .from(wines)
        .where(and(eq(wines.id, id), eq(wines.userId, userId)));
      
      if (!currentWine) {
        return undefined;
      }

      // Delete the existing wine
      await db.delete(wines).where(and(eq(wines.id, id), eq(wines.userId, userId)));

      // Create the updated wine data
      const updatedWineData = {
        id: id,
        name: wine.name ?? currentWine.name,
        category: wine.category ?? currentWine.category,
        wine: wine.wine !== undefined ? wine.wine : currentWine.wine,
        subType: wine.subType !== undefined ? wine.subType : currentWine.subType,
        producer: wine.producer !== undefined ? wine.producer : currentWine.producer,
        region: wine.region !== undefined ? wine.region : currentWine.region,
        country: wine.country !== undefined ? wine.country : currentWine.country,
        stockLevel: wine.stockLevel ?? currentWine.stockLevel,
        vintageStocks: wine.vintageStocks ?? currentWine.vintageStocks,
        imageUrl: wine.imageUrl !== undefined ? wine.imageUrl : currentWine.imageUrl,
        rating: wine.rating !== undefined ? wine.rating : currentWine.rating,
        notes: wine.notes !== undefined ? wine.notes : currentWine.notes,
        userId: userId,
        createdAt: currentWine.createdAt
      };

      // Insert the updated wine with explicit field mapping
      const result = await db.execute(sql`
        INSERT INTO wines (
          id, name, category, wine, sub_type, producer, region, country,
          stock_level, vintage_stocks, image_url, rating, notes, user_id, created_at
        ) VALUES (
          ${updatedWineData.id},
          ${updatedWineData.name},
          ${updatedWineData.category},
          ${updatedWineData.wine},
          ${updatedWineData.subType},
          ${updatedWineData.producer},
          ${updatedWineData.region},
          ${updatedWineData.country},
          ${updatedWineData.stockLevel},
          ${JSON.stringify(updatedWineData.vintageStocks)}::json,
          ${updatedWineData.imageUrl},
          ${updatedWineData.rating},
          ${updatedWineData.notes},
          ${updatedWineData.userId},
          ${updatedWineData.createdAt}
        ) RETURNING *
      `);
      
      return result.rows[0] as Wine;
    } catch (error) {
      console.error('Error updating wine:', error);
      throw error;
    }
  }

  async deleteWine(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(wines).where(and(eq(wines.id, id), eq(wines.userId, userId)));
    return (result.rowCount || 0) > 0;
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

  
}

export const storage = new DatabaseStorage();
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
      console.log('=== UPDATE WINE START ===');
      console.log('Wine ID:', id);
      console.log('User ID:', userId);
      console.log('Wine data:', JSON.stringify(wine, null, 2));
      
      // Use direct SQL update which we know works
      let updateParts: string[] = [];
      let params: any[] = [];
      let paramIndex = 1;
      
      if (wine.name !== undefined) {
        updateParts.push(`name = $${paramIndex++}`);
        params.push(wine.name);
      }
      if (wine.category !== undefined) {
        updateParts.push(`category = $${paramIndex++}`);
        params.push(wine.category);
      }
      if (wine.wine !== undefined) {
        updateParts.push(`wine = $${paramIndex++}`);
        params.push(wine.wine);
      }
      if (wine.subType !== undefined) {
        updateParts.push(`sub_type = $${paramIndex++}`);
        params.push(wine.subType);
      }
      if (wine.producer !== undefined) {
        updateParts.push(`producer = $${paramIndex++}`);
        params.push(wine.producer);
      }
      if (wine.region !== undefined) {
        updateParts.push(`region = $${paramIndex++}`);
        params.push(wine.region);
      }
      if (wine.country !== undefined) {
        updateParts.push(`country = $${paramIndex++}`);
        params.push(wine.country);
      }
      if (wine.stockLevel !== undefined) {
        updateParts.push(`stock_level = $${paramIndex++}`);
        params.push(wine.stockLevel);
      }
      if (wine.vintageStocks !== undefined) {
        updateParts.push(`vintage_stocks = $${paramIndex++}::json`);
        params.push(JSON.stringify(wine.vintageStocks));
      }
      if (wine.imageUrl !== undefined) {
        updateParts.push(`image_url = $${paramIndex++}`);
        params.push(wine.imageUrl);
      }
      if (wine.rating !== undefined) {
        updateParts.push(`rating = $${paramIndex++}`);
        params.push(wine.rating);
      }
      if (wine.notes !== undefined) {
        updateParts.push(`notes = $${paramIndex++}`);
        params.push(wine.notes);
      }
      
      if (updateParts.length === 0) {
        console.log('No fields to update');
        const result = await pool.query('SELECT * FROM wines WHERE id = $1 AND user_id = $2', [id, userId]);
        return result.rows[0] as Wine;
      }
      
      params.push(id, userId);
      const query = `UPDATE wines SET ${updateParts.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} RETURNING *`;
      
      console.log('Executing query:', query);
      console.log('With params:', params);
      
      const result = await pool.query(query, params);
      console.log('Update result:', result.rows[0]);
      
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
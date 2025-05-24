import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWineSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Wine Inventory API Routes (now user-specific)
  // Get all wines for authenticated user
  app.get("/api/wines", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const wines = await storage.getWines(userId);
      res.json(wines);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wines" });
    }
  });

  // Get wine by ID for authenticated user
  app.get("/api/wines/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid wine ID" });
      }

      const userId = req.user.claims.sub;
      const wine = await storage.getWineById(id, userId);
      if (!wine) {
        return res.status(404).json({ message: "Wine not found" });
      }

      res.json(wine);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wine" });
    }
  });

  // Get wines by category for authenticated user
  app.get("/api/wines/category/:category", isAuthenticated, async (req: any, res) => {
    try {
      const { category } = req.params;
      const userId = req.user.claims.sub;
      const wines = await storage.getWinesByCategory(category, userId);
      res.json(wines);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wines by category" });
    }
  });

  // Add a new wine for authenticated user
  app.post("/api/wines", isAuthenticated, async (req: any, res) => {
    try {
      const parseResult = insertWineSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid wine data", 
          errors: parseResult.error.format() 
        });
      }

      const userId = req.user.claims.sub;
      const newWine = await storage.addWine(parseResult.data, userId);
      res.status(201).json(newWine);
    } catch (err) {
      console.error("Failed to add wine:", err);
      res.status(500).json({ message: "Failed to add wine" });
    }
  });

  // Update an existing wine for authenticated user
  app.patch("/api/wines/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      console.log('PATCH wine route called - ID:', id, 'User:', userId);
      console.log('Body received:', JSON.stringify(req.body, null, 2));
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid wine ID" });
      }

      // Direct SQL update - bypass complex validation 
      const { pool } = await import('./db.js');
      const updateData = req.body;
      let setParts = [];
      let values = [];
      let valueIndex = 1;

      if (updateData.name !== undefined) {
        setParts.push(`name = $${valueIndex++}`);
        values.push(updateData.name);
      }
      if (updateData.category !== undefined) {
        setParts.push(`category = $${valueIndex++}`);
        values.push(updateData.category);
      }
      if (updateData.wine !== undefined) {
        setParts.push(`wine = $${valueIndex++}`);
        values.push(updateData.wine);
      }
      if (updateData.subType !== undefined) {
        setParts.push(`sub_type = $${valueIndex++}`);
        values.push(updateData.subType);
      }
      if (updateData.producer !== undefined) {
        setParts.push(`producer = $${valueIndex++}`);
        values.push(updateData.producer);
      }
      if (updateData.region !== undefined) {
        setParts.push(`region = $${valueIndex++}`);
        values.push(updateData.region);
      }
      if (updateData.country !== undefined) {
        setParts.push(`country = $${valueIndex++}`);
        values.push(updateData.country);
      }
      if (updateData.stockLevel !== undefined) {
        setParts.push(`stock_level = $${valueIndex++}`);
        values.push(updateData.stockLevel);
      }
      if (updateData.vintageStocks !== undefined) {
        setParts.push(`vintage_stocks = $${valueIndex++}::json`);
        values.push(JSON.stringify(updateData.vintageStocks));
      }
      if (updateData.imageUrl !== undefined) {
        setParts.push(`image_url = $${valueIndex++}`);
        values.push(updateData.imageUrl);
      }
      if (updateData.rating !== undefined) {
        setParts.push(`rating = $${valueIndex++}`);
        values.push(updateData.rating);
      }
      if (updateData.notes !== undefined) {
        setParts.push(`notes = $${valueIndex++}`);
        values.push(updateData.notes);
      }

      if (setParts.length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      values.push(id, userId);
      const query = `UPDATE wines SET ${setParts.join(', ')} WHERE id = $${valueIndex} AND user_id = $${valueIndex + 1} RETURNING *`;
      
      console.log('SQL:', query);
      console.log('Values:', values);

      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Wine not found or not owned by user" });
      }

      console.log('Update successful:', result.rows[0].name);
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error updating wine:", err);
      res.status(500).json({ message: "Failed to update wine", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Delete a wine for authenticated user
  app.delete("/api/wines/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid wine ID" });
      }

      const userId = req.user.claims.sub;
      const success = await storage.deleteWine(id, userId);
      if (!success) {
        return res.status(404).json({ message: "Wine not found" });
      }

      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete wine" });
    }
  });

  // Wine Catalog API Routes
  // Search wine catalog
  app.get("/api/catalog/search", async (req, res) => {
    try {
      const query = req.query.q as string || "";
      const results = await storage.searchWineCatalog(query);
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Failed to search wine catalog" });
    }
  });

  // Get all catalog entries
  app.get("/api/catalog", async (req, res) => {
    try {
      const catalog = await storage.getWineCatalog();
      res.json(catalog);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wine catalog" });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}

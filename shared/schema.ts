import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  json,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Wine category enum
export const WineCategory = {
  RED: "Red",
  WHITE: "White",
  ROSE: "Rose",
  FORTIFIED: "Fortified",
  BEER: "Beer",
  CIDER: "Cider",
  WHISKIES: "Whiskies",
  WHISKY: "Whisky",
  SPIRITS: "Spirits",
  OTHER: "Other"
} as const;

export type WineCategoryType = typeof WineCategory[keyof typeof WineCategory];

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Vintage with stock level
export interface VintageStock {
  vintage: number;
  stock: number;
}

// Wine schema - now linked to users
export const wines = pgTable("wines", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  wine: text("wine"), // The specific wine name/type
  subType: text("sub_type"), // Subtype information
  producer: text("producer"),
  region: text("region"),
  country: text("country"),
  stockLevel: integer("stock_level").default(0),
  vintageStocks: json("vintage_stocks").$type<VintageStock[]>().default([]),
  imageUrl: text("image_url"),
  rating: integer("rating"), // Rating from 1-5
  notes: text("notes"), // User's personal tasting notes
  createdAt: timestamp("created_at").defaultNow(),
});

// Wine database catalog entry (from CSV)
export const wineCatalog = pgTable("wine_catalog", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  wine: text("wine"), // The specific wine name/type
  subType: text("sub_type"), // Subtype information
  producer: text("producer"),
  region: text("region"),
  country: text("country"),
});

// Schemas for input validation
export const insertWineSchema = createInsertSchema(wines).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  notes: z.string().nullable().optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
});

export const insertWineCatalogSchema = createInsertSchema(wineCatalog).omit({
  id: true,
});

// Types for usage throughout the app
export type Wine = typeof wines.$inferSelect;
export type InsertWine = z.infer<typeof insertWineSchema>;
export type WineCatalog = typeof wineCatalog.$inferSelect;
export type InsertWineCatalog = z.infer<typeof insertWineCatalogSchema>;

// Extended schema with additional validation for forms
export const wineFormSchema = insertWineSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
  category: z.enum([
    WineCategory.RED, 
    WineCategory.WHITE, 
    WineCategory.ROSE, 
    WineCategory.FORTIFIED, 
    WineCategory.BEER, 
    WineCategory.CIDER, 
    WineCategory.OTHER
  ]),
  stockLevel: z.number().min(0, "Stock cannot be negative"),
  vintageStocks: z.array(
    z.object({
      vintage: z.number().min(1900).max(new Date().getFullYear()),
      stock: z.number().min(0)
    })
  ).optional(),
});

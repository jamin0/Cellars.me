import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { parse } from 'csv-parse/sync';
import pg from 'pg';
import ws from 'ws';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function importChunk(records, startIdx, endIdx) {
  console.log(`Processing records ${startIdx} to ${endIdx}`);

  // Connect to the database for this chunk
  const client = await pool.connect();
  try {
    // Prepare the insert query
    const insertQuery = `
      INSERT INTO wine_catalog (name, category, wine, sub_type, producer, region, country)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    // Process this chunk of records
    for (let i = startIdx; i < endIdx && i < records.length; i++) {
      const record = records[i];
      try {
        await client.query(insertQuery, [
          record.NAME || '',
          record.TYPE || 'Other',
          record.WINE || null,
          record.SUB_TYPE || null,
          record.PRODUCER || null,
          record.REGION || null,
          record.COUNTRY || null
        ]);

        // Log progress occasionally
        if (i % 1000 === 0) {
          console.log(`Imported ${i} records so far...`);
        }
      } catch (err) {
        console.error(`Error inserting record at index ${i}:`, err.message);
      }
    }

    console.log(`Successfully processed chunk ${startIdx} to ${endIdx}`);
  } finally {
    client.release();
  }
}


}

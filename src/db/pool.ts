import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "api-db",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "pagebuilder",
  password: process.env.DB_PASSWORD || "pagebuilder",
  database: process.env.DB_NAME || "pagebuilder_api",
  waitForConnections: true,
  connectionLimit: 10,
});

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      blocks JSON NOT NULL,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

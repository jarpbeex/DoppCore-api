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
      type VARCHAR(20) NOT NULL DEFAULT 'landing',
      blocks JSON NOT NULL,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      slug VARCHAR(255) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE`);
  await pool.query(
    `ALTER TABLE pages ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'landing'`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      page_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      image_path VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `);
}

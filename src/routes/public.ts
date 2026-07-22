import { Router } from "express";
import { pool } from "../db/pool";

export const publicRouter = Router();

publicRouter.get("/pages/:slug", async (req, res) => {
  const [rows]: any = await pool.query(
    "SELECT id, title, blocks FROM pages WHERE slug = ? AND published = TRUE",
    [req.params.slug]
  );
  if (!rows.length) return res.status(404).json({ error: "Page not found" });
  const page = rows[0];

  const [products]: any = await pool.query(
    "SELECT id, name, description, price, image_path FROM products WHERE page_id = ? ORDER BY created_at DESC",
    [page.id]
  );

  res.json({
    title: page.title,
    blocks: page.blocks,
    products: products.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      imagePath: p.image_path,
    })),
  });
});

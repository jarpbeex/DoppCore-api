import { Router } from "express";
import { pool } from "../db/pool";

export const publicRouter = Router();

publicRouter.get("/pages/:slug", async (req, res) => {
  const [rows]: any = await pool.query(
    "SELECT id, title, type, blocks, logo_path, nav_items, cta, blog_subtitle FROM pages WHERE slug = ? AND published = TRUE",
    [req.params.slug]
  );
  if (!rows.length) return res.status(404).json({ error: "Page not found" });
  const page = rows[0];

  const [products]: any = await pool.query(
    "SELECT id, name, description, price, image_path, category FROM products WHERE page_id = ? ORDER BY created_at DESC",
    [page.id]
  );

  const [posts]: any = await pool.query(
    "SELECT id, title, excerpt, cover_image_path, content FROM posts WHERE page_id = ? ORDER BY created_at DESC",
    [page.id]
  );

  res.json({
    title: page.title,
    type: page.type,
    blocks: page.blocks,
    logoPath: page.logo_path,
    navItems: page.nav_items ?? [],
    cta: page.cta ?? { enabled: false, label: "Empezar", navItemId: null },
    blogSubtitle: page.blog_subtitle,
    products: products.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      imagePath: p.image_path,
      category: p.category,
    })),
    posts: posts.map((p: any) => ({
      id: p.id,
      title: p.title,
      excerpt: p.excerpt,
      coverImagePath: p.cover_image_path,
      content: p.content,
    })),
  });
});

import { Router, type IRouter } from "express";
import { AdminLoginBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export const validTokens = new Set<string>();

router.post("/admin/login", async (req, res): Promise<void> => {
  const body = AdminLoginBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (!ADMIN_PASSWORD || body.data.password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = crypto.randomUUID();
  validTokens.add(token);
  res.json({ success: true, token });
});

export default router;

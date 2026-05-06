import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const profileUpdate = z.object({
  displayName: z.string().min(1).max(80),
  bio: z.string().max(2000),
  website: z.string().max(200).optional(),
});

export async function userRoutes(app: FastifyInstance) {
  // Public profile lookup. Disabled accounts return 404 to outsiders.
  app.get("/profile/:username", async (req, reply) => {
    const { username } = req.params as { username: string };
    const u = await prisma.user.findUnique({ where: { username } });
    if (!u || u.disabled) {
      return reply.code(404).send({ error: "not_found", message: "User not found" });
    }
    return {
      profile: {
        username: u.username,
        displayName: u.displayName,
        bio: u.bio,
        website: u.website,
        createdAt: u.createdAt.toISOString(),
      },
    };
  });

  app.put("/me/profile", { preHandler: requireAuth }, async (req, reply) => {
    const data = profileUpdate.parse(req.body);
    const u = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        displayName: data.displayName,
        bio: data.bio,
        website: data.website?.trim() || null,
      },
    });
    return reply.send({
      profile: {
        username: u.username,
        displayName: u.displayName,
        bio: u.bio,
        website: u.website,
        createdAt: u.createdAt.toISOString(),
      },
    });
  });

  // Admin: list users + flip the disabled flag.
  app.get("/admin/users", { preHandler: requireAdmin }, async () => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        disabled: true,
        createdAt: true,
      },
    });
    return { users };
  });

  app.post(
    "/admin/users/:id/disable",
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as { disabled?: boolean };
      const disabled = body.disabled !== false; // default true
      if (id === req.user!.id) {
        return reply
          .code(400)
          .send({ error: "bad_request", message: "Admins can't disable themselves" });
      }
      await prisma.user.update({ where: { id }, data: { disabled } });
      // Disabling kills any active sessions for that user.
      if (disabled) {
        await prisma.session.deleteMany({ where: { userId: id } });
      }
      return { ok: true };
    },
  );
}

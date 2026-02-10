import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerProfileRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/profile - Returns current user profile
  fastify.get(
    '/api/profile',
    {
      schema: {
        description: 'Get current user profile',
        tags: ['profile'],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: ['string', 'null'] },
              phone: { type: ['string', 'null'] },
              role: { type: 'string' },
              goals: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Fetching profile');

      const profile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.id, session.user.id),
      });

      if (!profile) {
        app.logger.warn({ userId: session.user.id }, 'Profile not found');
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const response = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
        goals: profile.goals,
      };

      app.logger.info({ userId: session.user.id, role: profile.role }, 'Profile fetched');
      return response;
    }
  );

  // PUT /api/profile - Updates current user profile
  fastify.put(
    '/api/profile',
    {
      schema: {
        description: 'Update current user profile',
        tags: ['profile'],
        body: {
          type: 'object',
          properties: {
            name: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            goals: { type: ['string', 'null'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: ['string', 'null'] },
              phone: { type: ['string', 'null'] },
              role: { type: 'string' },
              goals: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { name, phone, goals } = request.body as {
        name?: string | null;
        phone?: string | null;
        goals?: string | null;
      };

      app.logger.info({ userId: session.user.id, name, phone }, 'Updating profile');

      try {
        const updated = await app.db
          .update(schema.profiles)
          .set({
            name: name !== undefined ? name : undefined,
            phone: phone !== undefined ? phone : undefined,
            goals: goals !== undefined ? goals : undefined,
            updatedAt: new Date(),
          })
          .where(eq(schema.profiles.id, session.user.id))
          .returning();

        app.logger.info({ userId: session.user.id }, 'Profile updated');

        return {
          id: updated[0].id,
          email: updated[0].email,
          name: updated[0].name,
          phone: updated[0].phone,
          role: updated[0].role,
          goals: updated[0].goals,
        };
      } catch (error) {
        app.logger.error({ err: error, userId: session.user.id }, 'Failed to update profile');
        return reply.status(500).send({ error: 'Failed to update profile' });
      }
    }
  );

  // POST /api/profile/export - Generates data export for current user
  fastify.post(
    '/api/profile/export',
    {
      schema: {
        description: 'Export user data as JSON',
        tags: ['profile'],
        response: {
          200: {
            type: 'object',
            properties: {
              profile: { type: 'object' },
              checkins: { type: 'array' },
              programs: { type: 'array' },
              appointments: { type: 'array' },
              completions: { type: 'array' },
              files: { type: 'array' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Generating data export');

      try {
        // Get profile
        const profile = await app.db.query.profiles.findFirst({
          where: eq(schema.profiles.id, userId),
        });

        // Get checkins
        const checkins = await app.db
          .select()
          .from(schema.checkins)
          .where(eq(schema.checkins.userId, userId));

        // Get programs (only for clients)
        const clientPrograms = await app.db
          .select()
          .from(schema.clientPrograms)
          .where(eq(schema.clientPrograms.clientId, userId));

        // Get appointments
        const appointments = await app.db
          .select()
          .from(schema.appointments)
          .where(eq(schema.appointments.clientId, userId));

        // Get task completions for assigned programs
        const completions = await app.db
          .select()
          .from(schema.taskCompletions)
          .innerJoin(
            schema.clientPrograms,
            eq(schema.taskCompletions.clientProgramId, schema.clientPrograms.id)
          )
          .where(eq(schema.clientPrograms.clientId, userId));

        // Get files
        const files = await app.db
          .select()
          .from(schema.files)
          .where(eq(schema.files.userId, userId));

        const exportData = {
          profile,
          checkins,
          programs: clientPrograms,
          appointments,
          completions,
          files: files.map((f) => ({
            id: f.id,
            filename: f.filename,
            fileSize: f.fileSize,
            mimeType: f.mimeType,
            uploadedAt: f.uploadedAt,
          })),
          exportedAt: new Date().toISOString(),
        };

        app.logger.info({ userId }, 'Data export generated successfully');
        return exportData;
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to generate data export');
        return reply.status(500).send({ error: 'Failed to generate export' });
      }
    }
  );

  // DELETE /api/profile - Deletes user account and all associated data
  fastify.delete(
    '/api/profile',
    {
      schema: {
        description: 'Delete user account and all associated data',
        tags: ['profile'],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Deleting user account');

      try {
        // Delete profile (cascades will handle related data)
        await app.db.delete(schema.profiles).where(eq(schema.profiles.id, userId));

        app.logger.info({ userId }, 'User account deleted successfully');

        return { message: 'Account deleted successfully' };
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to delete account');
        return reply.status(500).send({ error: 'Failed to delete account' });
      }
    }
  );
}

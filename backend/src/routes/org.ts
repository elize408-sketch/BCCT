import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerOrgRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // Helper to check if user is an org_admin
  const requireOrgAdmin = async (session: any, reply: FastifyReply) => {
    const profile = await app.db.query.profiles.findFirst({
      where: eq(schema.profiles.id, session.user.id),
    });
    if (!profile || profile.role !== 'org_admin') {
      reply.status(403).send({ error: 'Forbidden: org_admin role required' });
      return null;
    }
    return profile;
  };

  // Helper to check if admin owns org
  const verifyOrgOwnership = async (
    userId: string,
    orgId: string,
    reply: FastifyReply
  ): Promise<boolean> => {
    const membership = await app.db.query.orgMembers.findFirst({
      where: and(
        eq(schema.orgMembers.orgId, orgId as any),
        eq(schema.orgMembers.userId, userId),
        eq(schema.orgMembers.role, 'admin')
      ),
    });
    if (!membership) {
      reply.status(403).send({ error: 'Forbidden: not an admin of this organization' });
      return false;
    }
    return true;
  };

  // GET /api/org/organizations - Returns organizations where user is admin
  fastify.get(
    '/api/org/organizations',
    {
      schema: {
        description: 'Get organizations where user is admin',
        tags: ['org'],
        response: {
          200: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const admin = await requireOrgAdmin(session, reply);
      if (!admin) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Fetching organizations');

      try {
        // Get organizations where user is admin
        const orgs = await app.db
          .select({
            id: schema.organizations.id,
            name: schema.organizations.name,
            createdAt: schema.organizations.createdAt,
          })
          .from(schema.organizations)
          .innerJoin(
            schema.orgMembers,
            and(
              eq(schema.organizations.id, schema.orgMembers.orgId),
              eq(schema.orgMembers.userId, userId),
              eq(schema.orgMembers.role, 'admin')
            )
          );

        app.logger.info({ userId, count: orgs.length }, 'Organizations fetched');
        return orgs;
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to fetch organizations');
        return reply.status(500).send({ error: 'Failed to fetch organizations' });
      }
    }
  );

  // POST /api/org/organizations - Creates organization
  fastify.post(
    '/api/org/organizations',
    {
      schema: {
        description: 'Create organization',
        tags: ['org'],
        body: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        response: {
          200: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const admin = await requireOrgAdmin(session, reply);
      if (!admin) return;

      const { name } = request.body as { name: string };
      const userId = session.user.id;

      app.logger.info({ userId, name }, 'Creating organization');

      try {
        // Create organization
        const org = await app.db
          .insert(schema.organizations)
          .values({
            name,
            createdAt: new Date(),
          })
          .returning();

        // Add creator as admin
        await app.db.insert(schema.orgMembers).values({
          orgId: org[0].id,
          userId,
          role: 'admin',
          createdAt: new Date(),
        });

        app.logger.info({ userId, orgId: org[0].id }, 'Organization created');
        return { id: org[0].id };
      } catch (error) {
        app.logger.error({ err: error, userId, name }, 'Failed to create organization');
        return reply.status(500).send({ error: 'Failed to create organization' });
      }
    }
  );

  // GET /api/org/organizations/:id/members - Returns members list
  fastify.get(
    '/api/org/organizations/:id/members',
    {
      schema: {
        description: 'Get organization members',
        tags: ['org'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const admin = await requireOrgAdmin(session, reply);
      if (!admin) return;

      const { id } = request.params as { id: string };
      const userId = session.user.id;

      app.logger.info({ userId, orgId: id }, 'Fetching members');

      try {
        const isOwner = await verifyOrgOwnership(userId, id, reply);
        if (!isOwner) return;

        const members = await app.db
          .select({
            id: schema.orgMembers.id,
            userId: schema.orgMembers.userId,
            userEmail: schema.profiles.email,
            userName: schema.profiles.name,
            role: schema.orgMembers.role,
            createdAt: schema.orgMembers.createdAt,
          })
          .from(schema.orgMembers)
          .innerJoin(
            schema.profiles,
            eq(schema.orgMembers.userId, schema.profiles.id)
          )
          .where(eq(schema.orgMembers.orgId, id as any));

        app.logger.info({ userId, orgId: id, count: members.length }, 'Members fetched');
        return members;
      } catch (error) {
        app.logger.error({ err: error, userId, orgId: id }, 'Failed to fetch members');
        return reply.status(500).send({ error: 'Failed to fetch members' });
      }
    }
  );

  // POST /api/org/organizations/:id/members - Adds member
  fastify.post(
    '/api/org/organizations/:id/members',
    {
      schema: {
        description: 'Add member to organization',
        tags: ['org'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'member'] },
          },
          required: ['userId', 'role'],
        },
        response: {
          200: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const admin = await requireOrgAdmin(session, reply);
      if (!admin) return;

      const { id } = request.params as { id: string };
      const { userId, role } = request.body as {
        userId: string;
        role: string;
      };
      const adminId = session.user.id;

      app.logger.info({ adminId, orgId: id, userId }, 'Adding member');

      try {
        const isOwner = await verifyOrgOwnership(adminId, id, reply);
        if (!isOwner) return;

        const member = await app.db
          .insert(schema.orgMembers)
          .values({
            orgId: id as any,
            userId,
            role: role as any,
            createdAt: new Date(),
          })
          .returning();

        app.logger.info({ adminId, memberId: member[0].id }, 'Member added');
        return { id: member[0].id };
      } catch (error) {
        app.logger.error({ err: error, adminId, orgId: id, userId }, 'Failed to add member');
        return reply.status(500).send({ error: 'Failed to add member' });
      }
    }
  );

  // DELETE /api/org/members/:id - Removes member
  fastify.delete(
    '/api/org/members/:id',
    {
      schema: {
        description: 'Remove member from organization',
        tags: ['org'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: { message: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const admin = await requireOrgAdmin(session, reply);
      if (!admin) return;

      const { id } = request.params as { id: string };
      const adminId = session.user.id;

      app.logger.info({ adminId, memberId: id }, 'Removing member');

      try {
        // Get the membership to verify admin owns the org
        const membership = await app.db.query.orgMembers.findFirst({
          where: eq(schema.orgMembers.id, id as any),
        });

        if (!membership) {
          return reply.status(404).send({ error: 'Member not found' });
        }

        const isOwner = await verifyOrgOwnership(adminId, membership.orgId, reply);
        if (!isOwner) return;

        await app.db.delete(schema.orgMembers).where(eq(schema.orgMembers.id, id as any));

        app.logger.info({ adminId, memberId: id }, 'Member removed');
        return { message: 'Member removed' };
      } catch (error) {
        app.logger.error({ err: error, adminId, memberId: id }, 'Failed to remove member');
        return reply.status(500).send({ error: 'Failed to remove member' });
      }
    }
  );

  // GET /api/org/organizations/:id/stats - Returns aggregated stats (counts only)
  fastify.get(
    '/api/org/organizations/:id/stats',
    {
      schema: {
        description: 'Get aggregated stats for organization (privacy-proof)',
        tags: ['org'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              memberCount: { type: 'number' },
              coachCount: { type: 'number' },
              clientCount: { type: 'number' },
              totalCheckinsCount: { type: 'number' },
              totalAppointmentsCount: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const admin = await requireOrgAdmin(session, reply);
      if (!admin) return;

      const { id } = request.params as { id: string };
      const adminId = session.user.id;

      app.logger.info({ adminId, orgId: id }, 'Fetching organization stats');

      try {
        const isOwner = await verifyOrgOwnership(adminId, id, reply);
        if (!isOwner) return;

        // Get member count
        const memberCountResult = await app.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.orgMembers)
          .where(eq(schema.orgMembers.orgId, id as any));

        const memberCount = parseInt(memberCountResult[0].count as any) || 0;

        // Get coach count from org members
        const coachCountResult = await app.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.orgMembers)
          .innerJoin(
            schema.profiles,
            eq(schema.orgMembers.userId, schema.profiles.id)
          )
          .where(
            and(
              eq(schema.orgMembers.orgId, id as any),
              eq(schema.profiles.role, 'coach')
            )
          );

        const coachCount = parseInt(coachCountResult[0].count as any) || 0;

        // Get client count from org members
        const clientCountResult = await app.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.orgMembers)
          .innerJoin(
            schema.profiles,
            eq(schema.orgMembers.userId, schema.profiles.id)
          )
          .where(
            and(
              eq(schema.orgMembers.orgId, id as any),
              eq(schema.profiles.role, 'client')
            )
          );

        const clientCount = parseInt(clientCountResult[0].count as any) || 0;

        // Get total checkins count for org members
        const checkinsCountResult = await app.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.checkins)
          .innerJoin(
            schema.orgMembers,
            and(
              eq(schema.checkins.userId, schema.orgMembers.userId),
              eq(schema.orgMembers.orgId, id as any)
            )
          );

        const totalCheckinsCount = parseInt(checkinsCountResult[0].count as any) || 0;

        // Get total appointments count for org members
        const appointmentsCountResult = await app.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.appointments)
          .innerJoin(
            schema.orgMembers,
            and(
              eq(schema.appointments.coachId, schema.orgMembers.userId),
              eq(schema.orgMembers.orgId, id as any)
            )
          );

        const totalAppointmentsCount = parseInt(appointmentsCountResult[0].count as any) || 0;

        const stats = {
          memberCount,
          coachCount,
          clientCount,
          totalCheckinsCount,
          totalAppointmentsCount,
        };

        app.logger.info({ adminId, orgId: id, ...stats }, 'Organization stats fetched');
        return stats;
      } catch (error) {
        app.logger.error({ err: error, adminId, orgId: id }, 'Failed to fetch stats');
        return reply.status(500).send({ error: 'Failed to fetch stats' });
      }
    }
  );
}

import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lt, desc, sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerCoachRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // Helper to check if user is a coach
  const requireCoach = async (session: any, reply: FastifyReply) => {
    const profile = await app.db.query.profiles.findFirst({
      where: eq(schema.profiles.id, session.user.id),
    });
    if (!profile || profile.role !== 'coach') {
      reply.status(403).send({ error: 'Forbidden: coach role required' });
      return null;
    }
    return profile;
  };

  // GET /api/coach/clients - Returns all clients linked to coach with status and alerts
  fastify.get(
    '/api/coach/clients',
    {
      schema: {
        description: 'Get all clients for coach with status and alerts',
        tags: ['coach'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const coachId = session.user.id;
      app.logger.info({ coachId }, 'Fetching clients');

      try {
        // Get all coach-client relationships
        const clientLinks = await app.db
          .select()
          .from(schema.coachClients)
          .where(eq(schema.coachClients.coachId, coachId));

        const clientsWithAlerts = await Promise.all(
          clientLinks.map(async (link) => {
            const client = await app.db.query.profiles.findFirst({
              where: eq(schema.profiles.id, link.clientId),
            });

            // Check for stress alert (3+ times stress >= 8 in last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const stressAlerts = await app.db
              .select({ count: sql<number>`count(*)` })
              .from(schema.checkins)
              .where(
                and(
                  eq(schema.checkins.userId, link.clientId),
                  gte(schema.checkins.createdAt, sevenDaysAgo),
                  gte(schema.checkins.stress, 8)
                )
              );

            const stressCount = parseInt(stressAlerts[0].count as any) || 0;

            // Check for no checkin in last 3 days
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

            const recentCheckins = await app.db
              .select()
              .from(schema.checkins)
              .where(
                and(
                  eq(schema.checkins.userId, link.clientId),
                  gte(schema.checkins.createdAt, threeDaysAgo)
                )
              );

            return {
              id: link.id,
              clientId: link.clientId,
              clientName: client?.name,
              clientEmail: client?.email,
              status: link.status,
              alerts: {
                highStress: stressCount >= 3,
                noCheckin: recentCheckins.length === 0,
              },
            };
          })
        );

        app.logger.info({ coachId, count: clientsWithAlerts.length }, 'Clients fetched');
        return clientsWithAlerts;
      } catch (error) {
        app.logger.error({ err: error, coachId }, 'Failed to fetch clients');
        return reply.status(500).send({ error: 'Failed to fetch clients' });
      }
    }
  );

  // GET /api/coach/clients/:id - Returns client detail
  fastify.get(
    '/api/coach/clients/:id',
    {
      schema: {
        description: 'Get client detail',
        tags: ['coach'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              profile: { type: 'object' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { id } = request.params as { id: string };
      const coachId = session.user.id;

      app.logger.info({ coachId, clientId: id }, 'Fetching client detail');

      try {
        // Verify coach-client relationship
        const clientLink = await app.db.query.coachClients.findFirst({
          where: and(
            eq(schema.coachClients.coachId, coachId),
            eq(schema.coachClients.clientId, id as any)
          ),
        });

        if (!clientLink) {
          return reply.status(404).send({ error: 'Client not found' });
        }

        const profile = await app.db.query.profiles.findFirst({
          where: eq(schema.profiles.id, id as any),
        });

        app.logger.info({ coachId, clientId: id }, 'Client detail fetched');
        return {
          profile,
          status: clientLink.status,
        };
      } catch (error) {
        app.logger.error({ err: error, coachId, clientId: id }, 'Failed to fetch client');
        return reply.status(500).send({ error: 'Failed to fetch client' });
      }
    }
  );

  // GET /api/coach/clients/:id/checkins - Returns checkin history for specific client
  fastify.get(
    '/api/coach/clients/:id/checkins',
    {
      schema: {
        description: 'Get checkin history for client',
        tags: ['coach'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { id } = request.params as { id: string };
      const coachId = session.user.id;

      app.logger.info({ coachId, clientId: id }, 'Fetching client checkins');

      try {
        // Verify coach-client relationship
        const clientLink = await app.db.query.coachClients.findFirst({
          where: and(
            eq(schema.coachClients.coachId, coachId),
            eq(schema.coachClients.clientId, id as any)
          ),
        });

        if (!clientLink) {
          return reply.status(404).send({ error: 'Client not found' });
        }

        const checkins = await app.db
          .select()
          .from(schema.checkins)
          .where(eq(schema.checkins.userId, id as any));

        app.logger.info({ coachId, clientId: id, count: checkins.length }, 'Checkins fetched');
        return checkins;
      } catch (error) {
        app.logger.error(
          { err: error, coachId, clientId: id },
          'Failed to fetch client checkins'
        );
        return reply.status(500).send({ error: 'Failed to fetch checkins' });
      }
    }
  );

  // GET /api/coach/clients/:id/notes - Returns coach notes for client
  fastify.get(
    '/api/coach/clients/:id/notes',
    {
      schema: {
        description: 'Get coach notes for client',
        tags: ['coach'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { id } = request.params as { id: string };
      const coachId = session.user.id;

      app.logger.info({ coachId, clientId: id }, 'Fetching coach notes');

      try {
        // Verify coach-client relationship
        const clientLink = await app.db.query.coachClients.findFirst({
          where: and(
            eq(schema.coachClients.coachId, coachId),
            eq(schema.coachClients.clientId, id as any)
          ),
        });

        if (!clientLink) {
          return reply.status(404).send({ error: 'Client not found' });
        }

        const notes = await app.db
          .select()
          .from(schema.coachNotes)
          .where(
            and(
              eq(schema.coachNotes.coachId, coachId),
              eq(schema.coachNotes.clientId, id as any)
            )
          );

        app.logger.info({ coachId, clientId: id, count: notes.length }, 'Notes fetched');
        return notes;
      } catch (error) {
        app.logger.error({ err: error, coachId, clientId: id }, 'Failed to fetch notes');
        return reply.status(500).send({ error: 'Failed to fetch notes' });
      }
    }
  );

  // POST /api/coach/clients/:id/notes - Creates coach note
  fastify.post(
    '/api/coach/clients/:id/notes',
    {
      schema: {
        description: 'Create coach note for client',
        tags: ['coach'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: { content: { type: 'string' } },
          required: ['content'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { id } = request.params as { id: string };
      const { content } = request.body as { content: string };
      const coachId = session.user.id;

      app.logger.info({ coachId, clientId: id }, 'Creating coach note');

      try {
        // Verify coach-client relationship
        const clientLink = await app.db.query.coachClients.findFirst({
          where: and(
            eq(schema.coachClients.coachId, coachId),
            eq(schema.coachClients.clientId, id as any)
          ),
        });

        if (!clientLink) {
          return reply.status(404).send({ error: 'Client not found' });
        }

        const note = await app.db
          .insert(schema.coachNotes)
          .values({
            coachId,
            clientId: id as any,
            content,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        app.logger.info({ coachId, noteId: note[0].id }, 'Note created');
        return { id: note[0].id };
      } catch (error) {
        app.logger.error({ err: error, coachId, clientId: id }, 'Failed to create note');
        return reply.status(500).send({ error: 'Failed to create note' });
      }
    }
  );

  // PUT /api/coach/notes/:id - Updates note
  fastify.put(
    '/api/coach/notes/:id',
    {
      schema: {
        description: 'Update coach note',
        tags: ['coach'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: { content: { type: 'string' } },
          required: ['content'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { id } = request.params as { id: string };
      const { content } = request.body as { content: string };
      const coachId = session.user.id;

      app.logger.info({ coachId, noteId: id }, 'Updating note');

      try {
        // Verify coach owns this note
        const note = await app.db.query.coachNotes.findFirst({
          where: and(
            eq(schema.coachNotes.id, id as any),
            eq(schema.coachNotes.coachId, coachId)
          ),
        });

        if (!note) {
          return reply.status(404).send({ error: 'Note not found' });
        }

        const updated = await app.db
          .update(schema.coachNotes)
          .set({
            content,
            updatedAt: new Date(),
          })
          .where(eq(schema.coachNotes.id, id as any))
          .returning();

        app.logger.info({ coachId, noteId: id }, 'Note updated');
        return { id: updated[0].id };
      } catch (error) {
        app.logger.error({ err: error, coachId, noteId: id }, 'Failed to update note');
        return reply.status(500).send({ error: 'Failed to update note' });
      }
    }
  );

  // DELETE /api/coach/notes/:id - Deletes note
  fastify.delete(
    '/api/coach/notes/:id',
    {
      schema: {
        description: 'Delete coach note',
        tags: ['coach'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { id } = request.params as { id: string };
      const coachId = session.user.id;

      app.logger.info({ coachId, noteId: id }, 'Deleting note');

      try {
        // Verify coach owns this note
        const note = await app.db.query.coachNotes.findFirst({
          where: and(
            eq(schema.coachNotes.id, id as any),
            eq(schema.coachNotes.coachId, coachId)
          ),
        });

        if (!note) {
          return reply.status(404).send({ error: 'Note not found' });
        }

        await app.db.delete(schema.coachNotes).where(eq(schema.coachNotes.id, id as any));

        app.logger.info({ coachId, noteId: id }, 'Note deleted');
        return { message: 'Note deleted' };
      } catch (error) {
        app.logger.error({ err: error, coachId, noteId: id }, 'Failed to delete note');
        return reply.status(500).send({ error: 'Failed to delete note' });
      }
    }
  );

  // GET /api/coach/programs - Returns program templates created by coach
  fastify.get(
    '/api/coach/programs',
    {
      schema: {
        description: 'Get program templates for coach',
        tags: ['coach'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const coachId = session.user.id;
      app.logger.info({ coachId }, 'Fetching programs');

      try {
        const programs = await app.db
          .select()
          .from(schema.programTemplates)
          .where(eq(schema.programTemplates.coachId, coachId));

        app.logger.info({ coachId, count: programs.length }, 'Programs fetched');
        return programs;
      } catch (error) {
        app.logger.error({ err: error, coachId }, 'Failed to fetch programs');
        return reply.status(500).send({ error: 'Failed to fetch programs' });
      }
    }
  );

  // POST /api/coach/programs - Creates program template
  fastify.post(
    '/api/coach/programs',
    {
      schema: {
        description: 'Create program template',
        tags: ['coach'],
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: ['string', 'null'] },
          },
          required: ['title'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { title, description } = request.body as {
        title: string;
        description?: string;
      };
      const coachId = session.user.id;

      app.logger.info({ coachId, title }, 'Creating program');

      try {
        const program = await app.db
          .insert(schema.programTemplates)
          .values({
            coachId,
            title,
            description,
            published: false,
            createdAt: new Date(),
          })
          .returning();

        app.logger.info({ coachId, programId: program[0].id }, 'Program created');
        return { id: program[0].id };
      } catch (error) {
        app.logger.error({ err: error, coachId, title }, 'Failed to create program');
        return reply.status(500).send({ error: 'Failed to create program' });
      }
    }
  );

  // PUT /api/coach/programs/:id - Updates program
  fastify.put(
    '/api/coach/programs/:id',
    {
      schema: {
        description: 'Update program template',
        tags: ['coach'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            title: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            published: { type: ['boolean', 'null'] },
          },
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { id } = request.params as { id: string };
      const { title, description, published } = request.body as {
        title?: string;
        description?: string;
        published?: boolean;
      };
      const coachId = session.user.id;

      app.logger.info({ coachId, programId: id }, 'Updating program');

      try {
        // Verify coach owns this program
        const program = await app.db.query.programTemplates.findFirst({
          where: and(
            eq(schema.programTemplates.id, id as any),
            eq(schema.programTemplates.coachId, coachId)
          ),
        });

        if (!program) {
          return reply.status(404).send({ error: 'Program not found' });
        }

        const updated = await app.db
          .update(schema.programTemplates)
          .set({
            title: title !== undefined ? title : undefined,
            description: description !== undefined ? description : undefined,
            published: published !== undefined ? published : undefined,
          })
          .where(eq(schema.programTemplates.id, id as any))
          .returning();

        app.logger.info({ coachId, programId: id }, 'Program updated');
        return { id: updated[0].id };
      } catch (error) {
        app.logger.error({ err: error, coachId, programId: id }, 'Failed to update program');
        return reply.status(500).send({ error: 'Failed to update program' });
      }
    }
  );

  // DELETE /api/coach/programs/:id - Deletes program template
  fastify.delete(
    '/api/coach/programs/:id',
    {
      schema: {
        description: 'Delete program template',
        tags: ['coach'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { id } = request.params as { id: string };
      const coachId = session.user.id;

      app.logger.info({ coachId, programId: id }, 'Deleting program');

      try {
        // Verify coach owns this program
        const program = await app.db.query.programTemplates.findFirst({
          where: and(
            eq(schema.programTemplates.id, id as any),
            eq(schema.programTemplates.coachId, coachId)
          ),
        });

        if (!program) {
          return reply.status(404).send({ error: 'Program not found' });
        }

        await app.db
          .delete(schema.programTemplates)
          .where(eq(schema.programTemplates.id, id as any));

        app.logger.info({ coachId, programId: id }, 'Program deleted');
        return { message: 'Program deleted' };
      } catch (error) {
        app.logger.error({ err: error, coachId, programId: id }, 'Failed to delete program');
        return reply.status(500).send({ error: 'Failed to delete program' });
      }
    }
  );

  // POST /api/coach/programs/:id/weeks - Adds week to program
  fastify.post(
    '/api/coach/programs/:id/weeks',
    {
      schema: {
        description: 'Add week to program',
        tags: ['coach'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            weekNumber: { type: 'number' },
            title: { type: ['string', 'null'] },
          },
          required: ['weekNumber'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { id } = request.params as { id: string };
      const { weekNumber, title } = request.body as {
        weekNumber: number;
        title?: string;
      };
      const coachId = session.user.id;

      app.logger.info({ coachId, programId: id, weekNumber }, 'Creating week');

      try {
        // Verify coach owns this program
        const program = await app.db.query.programTemplates.findFirst({
          where: and(
            eq(schema.programTemplates.id, id as any),
            eq(schema.programTemplates.coachId, coachId)
          ),
        });

        if (!program) {
          return reply.status(404).send({ error: 'Program not found' });
        }

        const week = await app.db
          .insert(schema.programWeeks)
          .values({
            programId: id as any,
            weekNumber,
            title,
            createdAt: new Date(),
          })
          .returning();

        app.logger.info({ coachId, weekId: week[0].id }, 'Week created');
        return { id: week[0].id };
      } catch (error) {
        app.logger.error({ err: error, coachId, programId: id }, 'Failed to create week');
        return reply.status(500).send({ error: 'Failed to create week' });
      }
    }
  );

  // POST /api/coach/programs/:id/tasks - Adds task to program
  fastify.post(
    '/api/coach/programs/:id/tasks',
    {
      schema: {
        description: 'Add task to program',
        tags: ['coach'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            weekId: { type: 'string' },
            type: {
              type: 'string',
              enum: ['reflection', 'exercise', 'reading', 'audio'],
            },
            title: { type: 'string' },
            contentJson: { type: 'object' },
            orderIndex: { type: ['number', 'null'] },
          },
          required: ['weekId', 'type', 'title'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { id } = request.params as { id: string };
      const { weekId, type, title, contentJson, orderIndex } = request.body as {
        weekId: string;
        type: string;
        title: string;
        contentJson?: any;
        orderIndex?: number;
      };
      const coachId = session.user.id;

      app.logger.info({ coachId, programId: id, type, title }, 'Creating task');

      try {
        // Verify coach owns this program
        const week = await app.db.query.programWeeks.findFirst({
          where: eq(schema.programWeeks.id, weekId as any),
        });

        if (!week) {
          return reply.status(404).send({ error: 'Week not found' });
        }

        const program = await app.db.query.programTemplates.findFirst({
          where: and(
            eq(schema.programTemplates.id, week.programId),
            eq(schema.programTemplates.coachId, coachId)
          ),
        });

        if (!program) {
          return reply.status(404).send({ error: 'Program not found' });
        }

        const task = await app.db
          .insert(schema.programTasks)
          .values({
            weekId: weekId as any,
            type: type as any,
            title,
            contentJson,
            orderIndex,
            createdAt: new Date(),
          })
          .returning();

        app.logger.info({ coachId, taskId: task[0].id }, 'Task created');
        return { id: task[0].id };
      } catch (error) {
        app.logger.error({ err: error, coachId, programId: id }, 'Failed to create task');
        return reply.status(500).send({ error: 'Failed to create task' });
      }
    }
  );

  // POST /api/coach/clients/:clientId/assign-program - Assigns program to client
  fastify.post(
    '/api/coach/clients/:clientId/assign-program',
    {
      schema: {
        description: 'Assign program to client',
        tags: ['coach'],
        params: { type: 'object', properties: { clientId: { type: 'string' } } },
        body: {
          type: 'object',
          properties: { programId: { type: 'string' } },
          required: ['programId'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { clientId } = request.params as { clientId: string };
      const { programId } = request.body as { programId: string };
      const coachId = session.user.id;

      app.logger.info({ coachId, clientId, programId }, 'Assigning program');

      try {
        // Verify coach owns this program and has client link
        const program = await app.db.query.programTemplates.findFirst({
          where: and(
            eq(schema.programTemplates.id, programId as any),
            eq(schema.programTemplates.coachId, coachId)
          ),
        });

        if (!program) {
          return reply.status(404).send({ error: 'Program not found' });
        }

        const clientLink = await app.db.query.coachClients.findFirst({
          where: and(
            eq(schema.coachClients.coachId, coachId),
            eq(schema.coachClients.clientId, clientId as any)
          ),
        });

        if (!clientLink) {
          return reply.status(404).send({ error: 'Client not found' });
        }

        const assignment = await app.db
          .insert(schema.clientPrograms)
          .values({
            clientId: clientId as any,
            programId: programId as any,
            assignedBy: coachId,
            assignedAt: new Date(),
          })
          .returning();

        app.logger.info({ coachId, assignmentId: assignment[0].id }, 'Program assigned');
        return { id: assignment[0].id };
      } catch (error) {
        app.logger.error({ err: error, coachId, clientId, programId }, 'Failed to assign program');
        return reply.status(500).send({ error: 'Failed to assign program' });
      }
    }
  );

  // GET /api/coach/appointments - Returns all appointments for coach
  fastify.get(
    '/api/coach/appointments',
    {
      schema: {
        description: 'Get appointments for coach',
        tags: ['coach'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const coachId = session.user.id;
      app.logger.info({ coachId }, 'Fetching appointments');

      try {
        const appointments = await app.db
          .select()
          .from(schema.appointments)
          .where(eq(schema.appointments.coachId, coachId));

        app.logger.info({ coachId, count: appointments.length }, 'Appointments fetched');
        return appointments;
      } catch (error) {
        app.logger.error({ err: error, coachId }, 'Failed to fetch appointments');
        return reply.status(500).send({ error: 'Failed to fetch appointments' });
      }
    }
  );

  // POST /api/coach/appointments - Creates appointment
  fastify.post(
    '/api/coach/appointments',
    {
      schema: {
        description: 'Create appointment',
        tags: ['coach'],
        body: {
          type: 'object',
          properties: {
            clientId: { type: 'string' },
            scheduledAt: { type: 'string' },
            durationMinutes: { type: ['number', 'null'] },
            notes: { type: ['string', 'null'] },
          },
          required: ['clientId', 'scheduledAt'],
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { clientId, scheduledAt, durationMinutes, notes } = request.body as {
        clientId: string;
        scheduledAt: string;
        durationMinutes?: number;
        notes?: string;
      };
      const coachId = session.user.id;

      app.logger.info({ coachId, clientId }, 'Creating appointment');

      try {
        // Verify coach-client relationship
        const clientLink = await app.db.query.coachClients.findFirst({
          where: and(
            eq(schema.coachClients.coachId, coachId),
            eq(schema.coachClients.clientId, clientId as any)
          ),
        });

        if (!clientLink) {
          return reply.status(404).send({ error: 'Client not found' });
        }

        const appointment = await app.db
          .insert(schema.appointments)
          .values({
            coachId,
            clientId: clientId as any,
            scheduledAt: new Date(scheduledAt),
            durationMinutes,
            notes,
            status: 'scheduled',
            createdAt: new Date(),
          })
          .returning();

        app.logger.info({ coachId, appointmentId: appointment[0].id }, 'Appointment created');
        return { id: appointment[0].id };
      } catch (error) {
        app.logger.error({ err: error, coachId, clientId }, 'Failed to create appointment');
        return reply.status(500).send({ error: 'Failed to create appointment' });
      }
    }
  );

  // PUT /api/coach/appointments/:id - Updates appointment
  fastify.put(
    '/api/coach/appointments/:id',
    {
      schema: {
        description: 'Update appointment',
        tags: ['coach'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            scheduledAt: { type: ['string', 'null'] },
            durationMinutes: { type: ['number', 'null'] },
            notes: { type: ['string', 'null'] },
            status: {
              type: ['string', 'null'],
              enum: ['scheduled', 'completed', 'cancelled'],
            },
          },
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

      const coach = await requireCoach(session, reply);
      if (!coach) return;

      const { id } = request.params as { id: string };
      const { scheduledAt, durationMinutes, notes, status } = request.body as {
        scheduledAt?: string;
        durationMinutes?: number;
        notes?: string;
        status?: string;
      };
      const coachId = session.user.id;

      app.logger.info({ coachId, appointmentId: id }, 'Updating appointment');

      try {
        // Verify coach owns this appointment
        const appointment = await app.db.query.appointments.findFirst({
          where: and(
            eq(schema.appointments.id, id as any),
            eq(schema.appointments.coachId, coachId)
          ),
        });

        if (!appointment) {
          return reply.status(404).send({ error: 'Appointment not found' });
        }

        const updated = await app.db
          .update(schema.appointments)
          .set({
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
            durationMinutes: durationMinutes !== undefined ? durationMinutes : undefined,
            notes: notes !== undefined ? notes : undefined,
            status: status !== undefined ? (status as any) : undefined,
          })
          .where(eq(schema.appointments.id, id as any))
          .returning();

        app.logger.info({ coachId, appointmentId: id }, 'Appointment updated');
        return { id: updated[0].id };
      } catch (error) {
        app.logger.error({ err: error, coachId, appointmentId: id }, 'Failed to update appointment');
        return reply.status(500).send({ error: 'Failed to update appointment' });
      }
    }
  );
}

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lt, inArray } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerClientRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // Helper to check if user is a client
  const requireClient = async (session: any, reply: FastifyReply) => {
    const profile = await app.db.query.profiles.findFirst({
      where: eq(schema.profiles.id, session.user.id),
    });
    if (!profile || profile.role !== 'client') {
      reply.status(403).send({ error: 'Forbidden: client role required' });
      return null;
    }
    return profile;
  };

  // GET /api/client/home - Returns home data for current client
  fastify.get(
    '/api/client/home',
    {
      schema: {
        description: 'Get client home data',
        tags: ['client'],
        response: {
          200: {
            type: 'object',
            properties: {
              checkinStatus: { type: ['string', 'null'] },
              currentWeek: { type: ['object', 'null'] },
              nextTask: { type: ['object', 'null'] },
              nextAppointment: { type: ['object', 'null'] },
              unreadChatCount: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const client = await requireClient(session, reply);
      if (!client) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Fetching client home data');

      try {
        // Check today's checkin
        const today = new Date().toISOString().split('T')[0];
        const todayCheckin = await app.db.query.checkins.findFirst({
          where: and(
            eq(schema.checkins.userId, userId),
            eq(schema.checkins.date, today as any)
          ),
        });

        // Get current assigned program with weeks
        const assignedProgram = await app.db.query.clientPrograms.findFirst({
          where: and(
            eq(schema.clientPrograms.clientId, userId),
            eq(schema.clientPrograms.completedAt, null as any)
          ),
        });

        let currentWeek = null;
        let nextTask = null;

        if (assignedProgram) {
          const weeks = await app.db.query.programWeeks.findMany({
            where: eq(schema.programWeeks.programId, assignedProgram.programId),
          });
          currentWeek = weeks.length > 0 ? weeks[0] : null;

          if (currentWeek) {
            const tasks = await app.db.query.programTasks.findMany({
              where: eq(schema.programTasks.weekId, currentWeek.id),
            });
            if (tasks.length > 0) {
              nextTask = tasks[0];
            }
          }
        }

        // Get next appointment
        const nextAppointment = await app.db.query.appointments.findFirst({
          where: and(
            eq(schema.appointments.clientId, userId),
            gte(schema.appointments.scheduledAt, new Date())
          ),
        });

        // Get unread message count
        const unreadMessages = await app.db
          .select({ count: schema.messages.id })
          .from(schema.messages)
          .innerJoin(
            schema.conversations,
            eq(schema.messages.conversationId, schema.conversations.id)
          )
          .where(
            and(
              eq(schema.conversations.clientId, userId),
              eq(schema.messages.readAt, null as any)
            )
          );

        const unreadChatCount = unreadMessages.length > 0 ? unreadMessages[0].count : 0;

        app.logger.info(
          { userId, hasCheckin: !!todayCheckin, unreadCount: unreadChatCount },
          'Home data fetched'
        );

        return {
          checkinStatus: todayCheckin ? 'completed' : 'pending',
          currentWeek,
          nextTask,
          nextAppointment: nextAppointment || null,
          unreadChatCount: unreadChatCount as any,
        };
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to fetch home data');
        return reply.status(500).send({ error: 'Failed to fetch home data' });
      }
    }
  );

  // GET /api/client/programs - Returns assigned programs for current client
  fastify.get(
    '/api/client/programs',
    {
      schema: {
        description: 'Get assigned programs for client',
        tags: ['client'],
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

      const client = await requireClient(session, reply);
      if (!client) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Fetching client programs');

      try {
        const programs = await app.db
          .select({
            id: schema.clientPrograms.id,
            programId: schema.clientPrograms.programId,
            title: schema.programTemplates.title,
            description: schema.programTemplates.description,
            assignedAt: schema.clientPrograms.assignedAt,
            completedAt: schema.clientPrograms.completedAt,
          })
          .from(schema.clientPrograms)
          .innerJoin(
            schema.programTemplates,
            eq(schema.clientPrograms.programId, schema.programTemplates.id)
          )
          .where(eq(schema.clientPrograms.clientId, userId));

        app.logger.info({ userId, count: programs.length }, 'Programs fetched');
        return programs;
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to fetch programs');
        return reply.status(500).send({ error: 'Failed to fetch programs' });
      }
    }
  );

  // GET /api/client/programs/:id/weeks - Returns weeks for a program
  fastify.get(
    '/api/client/programs/:id/weeks',
    {
      schema: {
        description: 'Get weeks for a program',
        tags: ['client'],
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

      const client = await requireClient(session, reply);
      if (!client) return;

      const { id } = request.params as { id: string };
      const userId = session.user.id;

      app.logger.info({ userId, clientProgramId: id }, 'Fetching weeks');

      try {
        // Verify client owns this program assignment
        const clientProgram = await app.db.query.clientPrograms.findFirst({
          where: and(
            eq(schema.clientPrograms.id, id as any),
            eq(schema.clientPrograms.clientId, userId)
          ),
        });

        if (!clientProgram) {
          return reply.status(404).send({ error: 'Program not found' });
        }

        const weeks = await app.db
          .select()
          .from(schema.programWeeks)
          .where(eq(schema.programWeeks.programId, clientProgram.programId));

        app.logger.info({ userId, weeksCount: weeks.length }, 'Weeks fetched');
        return weeks;
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to fetch weeks');
        return reply.status(500).send({ error: 'Failed to fetch weeks' });
      }
    }
  );

  // GET /api/client/programs/:id/tasks - Returns tasks for a program
  fastify.get(
    '/api/client/programs/:id/tasks',
    {
      schema: {
        description: 'Get tasks for a program',
        tags: ['client'],
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

      const client = await requireClient(session, reply);
      if (!client) return;

      const { id } = request.params as { id: string };
      const userId = session.user.id;

      app.logger.info({ userId, clientProgramId: id }, 'Fetching tasks');

      try {
        // Verify client owns this program assignment
        const clientProgram = await app.db.query.clientPrograms.findFirst({
          where: and(
            eq(schema.clientPrograms.id, id as any),
            eq(schema.clientPrograms.clientId, userId)
          ),
        });

        if (!clientProgram) {
          return reply.status(404).send({ error: 'Program not found' });
        }

        // Get all weeks and tasks
        const weeks = await app.db.query.programWeeks.findMany({
          where: eq(schema.programWeeks.programId, clientProgram.programId),
        });

        const weekIds = weeks.map((w) => w.id);
        const tasks = await app.db
          .select()
          .from(schema.programTasks)
          .where(
            weekIds.length > 0
              ? inArray(schema.programTasks.weekId, weekIds)
              : undefined
          );

        app.logger.info({ userId, tasksCount: tasks.length }, 'Tasks fetched');
        return tasks;
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to fetch tasks');
        return reply.status(500).send({ error: 'Failed to fetch tasks' });
      }
    }
  );

  // POST /api/client/tasks/:id/complete - Marks task complete
  fastify.post(
    '/api/client/tasks/:id/complete',
    {
      schema: {
        description: 'Complete a task',
        tags: ['client'],
        body: {
          type: 'object',
          properties: {
            clientProgramId: { type: 'string' },
            responseJson: { type: 'object' },
          },
          required: ['clientProgramId'],
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

      const client = await requireClient(session, reply);
      if (!client) return;

      const { id } = request.params as { id: string };
      const { clientProgramId, responseJson } = request.body as {
        clientProgramId: string;
        responseJson?: any;
      };
      const userId = session.user.id;

      app.logger.info({ userId, taskId: id, clientProgramId }, 'Completing task');

      try {
        // Verify client owns this program
        const clientProgram = await app.db.query.clientPrograms.findFirst({
          where: and(
            eq(schema.clientPrograms.id, clientProgramId as any),
            eq(schema.clientPrograms.clientId, userId)
          ),
        });

        if (!clientProgram) {
          return reply.status(404).send({ error: 'Program not found' });
        }

        // Create task completion
        const completion = await app.db
          .insert(schema.taskCompletions)
          .values({
            clientProgramId: clientProgramId as any,
            taskId: id as any,
            completedAt: new Date(),
            responseJson,
          })
          .returning();

        app.logger.info({ userId, completionId: completion[0].id }, 'Task completed');
        return { id: completion[0].id };
      } catch (error) {
        app.logger.error({ err: error, userId, taskId: id }, 'Failed to complete task');
        return reply.status(500).send({ error: 'Failed to complete task' });
      }
    }
  );

  // GET /api/client/checkins - Returns checkin history for current client
  fastify.get(
    '/api/client/checkins',
    {
      schema: {
        description: 'Get checkin history for client',
        tags: ['client'],
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

      const client = await requireClient(session, reply);
      if (!client) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Fetching checins');

      try {
        const checkins = await app.db
          .select()
          .from(schema.checkins)
          .where(eq(schema.checkins.userId, userId));

        app.logger.info({ userId, count: checkins.length }, 'Checkins fetched');
        return checkins;
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to fetch checkins');
        return reply.status(500).send({ error: 'Failed to fetch checkins' });
      }
    }
  );

  // POST /api/client/checkins - Creates a new checkin
  fastify.post(
    '/api/client/checkins',
    {
      schema: {
        description: 'Create a checkin',
        tags: ['client'],
        body: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            stress: { type: 'number', minimum: 0, maximum: 10 },
            energy: { type: 'number', minimum: 0, maximum: 10 },
            sleep: { type: 'number', minimum: 0, maximum: 10 },
            mood: { type: 'number', minimum: 0, maximum: 10 },
            note: { type: ['string', 'null'] },
          },
          required: ['date', 'stress', 'energy', 'sleep', 'mood'],
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

      const client = await requireClient(session, reply);
      if (!client) return;

      const { date, stress, energy, sleep, mood, note } = request.body as {
        date: string;
        stress: number;
        energy: number;
        sleep: number;
        mood: number;
        note?: string;
      };
      const userId = session.user.id;

      app.logger.info({ userId, date, stress, energy, sleep, mood }, 'Creating checkin');

      try {
        const checkin = await app.db
          .insert(schema.checkins)
          .values({
            userId,
            date: date as any,
            stress,
            energy,
            sleep,
            mood,
            note,
            createdAt: new Date(),
          })
          .returning();

        app.logger.info({ userId, checkinId: checkin[0].id }, 'Checkin created');
        return { id: checkin[0].id };
      } catch (error) {
        app.logger.error({ err: error, userId, date }, 'Failed to create checkin');
        return reply.status(500).send({ error: 'Failed to create checkin' });
      }
    }
  );

  // GET /api/client/appointments - Returns appointments for current client
  fastify.get(
    '/api/client/appointments',
    {
      schema: {
        description: 'Get appointments for client',
        tags: ['client'],
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

      const client = await requireClient(session, reply);
      if (!client) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Fetching appointments');

      try {
        const appointments = await app.db
          .select()
          .from(schema.appointments)
          .where(eq(schema.appointments.clientId, userId));

        app.logger.info({ userId, count: appointments.length }, 'Appointments fetched');
        return appointments;
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to fetch appointments');
        return reply.status(500).send({ error: 'Failed to fetch appointments' });
      }
    }
  );

  // GET /api/client/conversations - Returns conversations for current client
  fastify.get(
    '/api/client/conversations',
    {
      schema: {
        description: 'Get conversations for client',
        tags: ['client'],
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

      const client = await requireClient(session, reply);
      if (!client) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Fetching conversations');

      try {
        const conversations = await app.db
          .select()
          .from(schema.conversations)
          .where(eq(schema.conversations.clientId, userId));

        app.logger.info({ userId, count: conversations.length }, 'Conversations fetched');
        return conversations;
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to fetch conversations');
        return reply.status(500).send({ error: 'Failed to fetch conversations' });
      }
    }
  );

  // GET /api/client/conversations/:id/messages - Returns messages in conversation
  fastify.get(
    '/api/client/conversations/:id/messages',
    {
      schema: {
        description: 'Get messages in conversation',
        tags: ['client'],
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

      const client = await requireClient(session, reply);
      if (!client) return;

      const { id } = request.params as { id: string };
      const userId = session.user.id;

      app.logger.info({ userId, conversationId: id }, 'Fetching messages');

      try {
        // Verify user is participant in conversation
        const conversation = await app.db.query.conversations.findFirst({
          where: and(
            eq(schema.conversations.id, id as any),
            eq(schema.conversations.clientId, userId)
          ),
        });

        if (!conversation) {
          return reply.status(404).send({ error: 'Conversation not found' });
        }

        const messages = await app.db
          .select()
          .from(schema.messages)
          .where(eq(schema.messages.conversationId, id as any));

        app.logger.info({ userId, messageCount: messages.length }, 'Messages fetched');
        return messages;
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to fetch messages');
        return reply.status(500).send({ error: 'Failed to fetch messages' });
      }
    }
  );
}

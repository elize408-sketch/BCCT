import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerNotificationRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/notifications/prefs - Returns notification preferences
  fastify.get(
    '/api/notifications/prefs',
    {
      schema: {
        description: 'Get notification preferences',
        tags: ['notifications'],
        response: {
          200: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              pushEnabled: { type: 'boolean' },
              dailyCheckinTime: { type: ['string', 'null'] },
              timezone: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Fetching notification preferences');

      try {
        let prefs = await app.db.query.notificationPrefs.findFirst({
          where: eq(schema.notificationPrefs.userId, userId),
        });

        // Create default prefs if not exists
        if (!prefs) {
          const created = await app.db
            .insert(schema.notificationPrefs)
            .values({
              userId,
              pushEnabled: true,
              timezone: 'UTC',
              updatedAt: new Date(),
            })
            .returning();

          prefs = created[0];
        }

        app.logger.info({ userId }, 'Notification preferences fetched');

        return {
          userId: prefs.userId,
          pushEnabled: prefs.pushEnabled,
          dailyCheckinTime: prefs.dailyCheckinTime,
          timezone: prefs.timezone,
        };
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to fetch preferences');
        return reply.status(500).send({ error: 'Failed to fetch preferences' });
      }
    }
  );

  // PUT /api/notifications/prefs - Updates notification preferences
  fastify.put(
    '/api/notifications/prefs',
    {
      schema: {
        description: 'Update notification preferences',
        tags: ['notifications'],
        body: {
          type: 'object',
          properties: {
            pushEnabled: { type: ['boolean', 'null'] },
            dailyCheckinTime: { type: ['string', 'null'] },
            timezone: { type: ['string', 'null'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              pushEnabled: { type: 'boolean' },
              dailyCheckinTime: { type: ['string', 'null'] },
              timezone: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { pushEnabled, dailyCheckinTime, timezone } = request.body as {
        pushEnabled?: boolean;
        dailyCheckinTime?: string;
        timezone?: string;
      };

      app.logger.info({ userId }, 'Updating notification preferences');

      try {
        // Ensure prefs exist
        const existing = await app.db.query.notificationPrefs.findFirst({
          where: eq(schema.notificationPrefs.userId, userId),
        });

        if (!existing) {
          await app.db.insert(schema.notificationPrefs).values({
            userId,
            pushEnabled: true,
            timezone: 'UTC',
            updatedAt: new Date(),
          });
        }

        const updated = await app.db
          .update(schema.notificationPrefs)
          .set({
            pushEnabled: pushEnabled !== undefined ? pushEnabled : undefined,
            dailyCheckinTime: dailyCheckinTime !== undefined ? (dailyCheckinTime as any) : undefined,
            timezone: timezone !== undefined ? timezone : undefined,
            updatedAt: new Date(),
          })
          .where(eq(schema.notificationPrefs.userId, userId))
          .returning();

        app.logger.info({ userId }, 'Notification preferences updated');

        return {
          userId: updated[0].userId,
          pushEnabled: updated[0].pushEnabled,
          dailyCheckinTime: updated[0].dailyCheckinTime,
          timezone: updated[0].timezone,
        };
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to update preferences');
        return reply.status(500).send({ error: 'Failed to update preferences' });
      }
    }
  );

  // POST /api/notifications/register-device - Registers device token
  fastify.post(
    '/api/notifications/register-device',
    {
      schema: {
        description: 'Register device token for push notifications',
        tags: ['notifications'],
        body: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            platform: { type: 'string', enum: ['ios', 'android', 'web'] },
          },
          required: ['token', 'platform'],
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

      const userId = session.user.id;
      const { token, platform } = request.body as {
        token: string;
        platform: string;
      };

      app.logger.info({ userId, platform }, 'Registering device token');

      try {
        // Check if token already exists for this user
        const existing = await app.db.query.deviceTokens.findFirst({
          where: eq(schema.deviceTokens.token, token),
        });

        if (existing && existing.userId === userId) {
          // Token already registered for this user
          app.logger.info({ userId, tokenId: existing.id }, 'Device token already registered');
          return { id: existing.id };
        }

        if (existing && existing.userId !== userId) {
          // Delete old registration if it's for a different user
          await app.db
            .delete(schema.deviceTokens)
            .where(eq(schema.deviceTokens.token, token));
        }

        // Register new device token
        const deviceToken = await app.db
          .insert(schema.deviceTokens)
          .values({
            userId,
            token,
            platform: platform as any,
            createdAt: new Date(),
          })
          .returning();

        app.logger.info({ userId, tokenId: deviceToken[0].id }, 'Device token registered');
        return { id: deviceToken[0].id };
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to register device token');
        return reply.status(500).send({ error: 'Failed to register device token' });
      }
    }
  );

  // GET /api/notifications/outbox - Returns pending notifications for user
  fastify.get(
    '/api/notifications/outbox',
    {
      schema: {
        description: 'Get pending notifications',
        tags: ['notifications'],
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

      const userId = session.user.id;
      app.logger.info({ userId }, 'Fetching pending notifications');

      try {
        const now = new Date();

        const notifications = await app.db
          .select()
          .from(schema.notificationsOutbox)
          .where(
            and(
              eq(schema.notificationsOutbox.userId, userId),
              eq(schema.notificationsOutbox.sentAt, null as any),
              lte(schema.notificationsOutbox.sendAfter, now)
            )
          );

        app.logger.info({ userId, count: notifications.length }, 'Pending notifications fetched');

        return notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.dataJson,
          sendAfter: n.sendAfter?.toISOString(),
        }));
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to fetch notifications');
        return reply.status(500).send({ error: 'Failed to fetch notifications' });
      }
    }
  );

  // POST /api/notifications/outbox/:id/acknowledge - Marks notification as sent
  fastify.post(
    '/api/notifications/outbox/:id/acknowledge',
    {
      schema: {
        description: 'Mark notification as sent',
        tags: ['notifications'],
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

      const { id } = request.params as { id: string };
      const userId = session.user.id;

      app.logger.info({ userId, notificationId: id }, 'Acknowledging notification');

      try {
        // Verify ownership
        const notification = await app.db.query.notificationsOutbox.findFirst({
          where: eq(schema.notificationsOutbox.id, id as any),
        });

        if (!notification) {
          return reply.status(404).send({ error: 'Notification not found' });
        }

        if (notification.userId !== userId) {
          return reply.status(403).send({ error: 'Forbidden' });
        }

        // Mark as sent
        await app.db
          .update(schema.notificationsOutbox)
          .set({
            sentAt: new Date(),
          })
          .where(eq(schema.notificationsOutbox.id, id as any));

        app.logger.info({ userId, notificationId: id }, 'Notification acknowledged');
        return { message: 'Notification acknowledged' };
      } catch (error) {
        app.logger.error(
          { err: error, userId, notificationId: id },
          'Failed to acknowledge notification'
        );
        return reply.status(500).send({ error: 'Failed to acknowledge notification' });
      }
    }
  );
}

// Server function to schedule notifications (can be called by cron job)
export async function scheduleNotifications(app: App) {
  app.logger.info('Running notification scheduler');

  try {
    // Get all users with notification prefs enabled
    const usersWithPrefs = await app.db.query.notificationPrefs.findMany({
      where: eq(schema.notificationPrefs.pushEnabled, true),
    });

    for (const prefs of usersWithPrefs) {
      // Check if user has checked in today
      const today = new Date().toISOString().split('T')[0];
      const todayCheckin = await app.db.query.checkins.findFirst({
        where: and(
          eq(schema.checkins.userId, prefs.userId),
          eq(schema.checkins.date, today as any)
        ),
      });

      // If no checkin yet and it's past the scheduled time, create notification
      if (!todayCheckin && prefs.dailyCheckinTime) {
        const sendTime = new Date();
        const [hours, minutes] = prefs.dailyCheckinTime.split(':');
        sendTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // Only create if we're past the scheduled time
        if (sendTime < new Date()) {
          await app.db
            .insert(schema.notificationsOutbox)
            .values({
              userId: prefs.userId,
              type: 'daily_checkin_reminder',
              title: 'Daily Check-in',
              body: 'How are you doing today? Time for your daily check-in.',
              sendAfter: new Date(),
              createdAt: new Date(),
            });

          app.logger.info({ userId: prefs.userId }, 'Daily checkin reminder created');
        }
      }
    }

    app.logger.info('Notification scheduler completed');
  } catch (error) {
    app.logger.error({ err: error }, 'Notification scheduler failed');
  }
}

import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, or } from 'drizzle-orm';
import type { WebSocket } from 'ws';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

// Track active WebSocket connections per conversation
const activeConnections = new Map<string, Set<WebSocket>>();

export function registerChatRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // Helper to verify conversation participant
  const verifyConversationAccess = async (
    userId: string,
    conversationId: string,
    reply: FastifyReply
  ): Promise<boolean> => {
    const conversation = await app.db.query.conversations.findFirst({
      where: and(
        eq(schema.conversations.id, conversationId as any),
        or(
          eq(schema.conversations.clientId, userId),
          eq(schema.conversations.coachId, userId)
        )
      ),
    });

    if (!conversation) {
      reply.status(404).send({ error: 'Conversation not found' });
      return false;
    }
    return true;
  };

  // POST /api/messages - Sends message
  fastify.post(
    '/api/messages',
    {
      schema: {
        description: 'Send message in conversation',
        tags: ['chat'],
        body: {
          type: 'object',
          properties: {
            conversationId: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['conversationId', 'content'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              conversationId: { type: 'string' },
              senderId: { type: 'string' },
              content: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { conversationId, content } = request.body as {
        conversationId: string;
        content: string;
      };
      const userId = session.user.id;

      app.logger.info({ userId, conversationId }, 'Sending message');

      try {
        // Verify user is participant
        const hasAccess = await verifyConversationAccess(userId, conversationId, reply);
        if (!hasAccess) return;

        // Create message
        const message = await app.db
          .insert(schema.messages)
          .values({
            conversationId: conversationId as any,
            senderId: userId,
            content,
            createdAt: new Date(),
          })
          .returning();

        // Broadcast to connected clients via WebSocket
        const conversationConnections = activeConnections.get(conversationId);
        if (conversationConnections) {
          const payload = JSON.stringify({
            type: 'message',
            data: {
              id: message[0].id,
              conversationId: message[0].conversationId,
              senderId: message[0].senderId,
              content: message[0].content,
              createdAt: message[0].createdAt?.toISOString(),
            },
          });

          for (const socket of conversationConnections) {
            if (socket.readyState === 1) {
              socket.send(payload);
            }
          }
        }

        app.logger.info({ userId, messageId: message[0].id }, 'Message sent');

        return {
          id: message[0].id,
          conversationId: message[0].conversationId,
          senderId: message[0].senderId,
          content: message[0].content,
          createdAt: message[0].createdAt?.toISOString(),
        };
      } catch (error) {
        app.logger.error({ err: error, userId, conversationId }, 'Failed to send message');
        return reply.status(500).send({ error: 'Failed to send message' });
      }
    }
  );

  // PUT /api/messages/:id/read - Marks message as read
  fastify.put(
    '/api/messages/:id/read',
    {
      schema: {
        description: 'Mark message as read',
        tags: ['chat'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
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

      const { id } = request.params as { id: string };
      const userId = session.user.id;

      app.logger.info({ userId, messageId: id }, 'Marking message as read');

      try {
        // Get message to verify access
        const message = await app.db.query.messages.findFirst({
          where: eq(schema.messages.id, id as any),
        });

        if (!message) {
          return reply.status(404).send({ error: 'Message not found' });
        }

        // Verify user is conversation participant
        const hasAccess = await verifyConversationAccess(userId, message.conversationId, reply);
        if (!hasAccess) return;

        const updated = await app.db
          .update(schema.messages)
          .set({
            readAt: new Date(),
          })
          .where(eq(schema.messages.id, id as any))
          .returning();

        app.logger.info({ userId, messageId: id }, 'Message marked as read');
        return { id: updated[0].id };
      } catch (error) {
        app.logger.error({ err: error, userId, messageId: id }, 'Failed to mark as read');
        return reply.status(500).send({ error: 'Failed to mark message as read' });
      }
    }
  );

  // WebSocket endpoint for realtime chat
  fastify.route({
    method: 'GET',
    url: '/ws/chat/:conversationId',
    schema: {
      description: 'WebSocket for realtime messaging',
      tags: ['chat'],
      params: {
        type: 'object',
        properties: { conversationId: { type: 'string' } },
      },
    },
    wsHandler: async (socket: WebSocket, request: FastifyRequest) => {
      const { conversationId } = request.params as { conversationId: string };
      const token = request.headers.authorization?.replace('Bearer ', '');

      app.logger.info({ conversationId }, 'WebSocket client connected');

      // Verify authentication and conversation access
      let userId: string | null = null;

      try {
        // Create a temporary request with auth header for verification
        const authRequest = {
          headers: { authorization: `Bearer ${token}` },
        } as any;

        const session = await requireAuth(authRequest, {} as any);

        if (!session) {
          socket.send(JSON.stringify({ error: 'Unauthorized' }));
          socket.close();
          return;
        }

        userId = session.user.id;

        // Verify conversation access
        const conversation = await app.db.query.conversations.findFirst({
          where: and(
            eq(schema.conversations.id, conversationId as any),
            or(
              eq(schema.conversations.clientId, userId),
              eq(schema.conversations.coachId, userId)
            )
          ),
        });

        if (!conversation) {
          socket.send(JSON.stringify({ error: 'Unauthorized' }));
          socket.close();
          return;
        }

        app.logger.info({ userId, conversationId }, 'WebSocket client authenticated');

        // Register connection
        if (!activeConnections.has(conversationId)) {
          activeConnections.set(conversationId, new Set());
        }
        activeConnections.get(conversationId)!.add(socket);

        // Send welcome message
        socket.send(
          JSON.stringify({
            type: 'connected',
            conversationId,
            userId,
          })
        );

        // Handle incoming messages
        socket.on('message', async (raw) => {
          try {
            const data = JSON.parse(raw.toString());

            if (data.type === 'message' && data.content) {
              // Create message in database
              const message = await app.db
                .insert(schema.messages)
                .values({
                  conversationId: conversationId as any,
                  senderId: userId!,
                  content: data.content,
                  createdAt: new Date(),
                })
                .returning();

              // Broadcast to all connected clients
              const payload = JSON.stringify({
                type: 'message',
                data: {
                  id: message[0].id,
                  conversationId: message[0].conversationId,
                  senderId: message[0].senderId,
                  content: message[0].content,
                  createdAt: message[0].createdAt?.toISOString(),
                },
              });

              const clients = activeConnections.get(conversationId);
              if (clients) {
                for (const client of clients) {
                  if (client.readyState === 1) {
                    client.send(payload);
                  }
                }
              }

              app.logger.info({ userId, messageId: message[0].id }, 'Message broadcast');
            } else if (data.type === 'read' && data.messageId) {
              // Mark message as read
              await app.db
                .update(schema.messages)
                .set({ readAt: new Date() })
                .where(eq(schema.messages.id, data.messageId));

              // Broadcast read receipt
              const payload = JSON.stringify({
                type: 'read',
                messageId: data.messageId,
                userId,
              });

              const clients = activeConnections.get(conversationId);
              if (clients) {
                for (const client of clients) {
                  if (client.readyState === 1) {
                    client.send(payload);
                  }
                }
              }

              app.logger.info({ userId, messageId: data.messageId }, 'Read receipt broadcast');
            }
          } catch (error) {
            app.logger.error(
              { err: error, userId, conversationId },
              'Failed to process WebSocket message'
            );
            socket.send(JSON.stringify({ error: 'Invalid message format' }));
          }
        });

        socket.on('close', () => {
          const clients = activeConnections.get(conversationId);
          if (clients) {
            clients.delete(socket);
            if (clients.size === 0) {
              activeConnections.delete(conversationId);
            }
          }
          app.logger.info({ userId, conversationId }, 'WebSocket client disconnected');
        });
      } catch (error) {
        app.logger.error(
          { err: error, conversationId },
          'WebSocket authentication failed'
        );
        socket.send(JSON.stringify({ error: 'Unauthorized' }));
        socket.close();
      }
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      return { protocol: 'ws', path: '/ws/chat/:conversationId' };
    },
  });
}

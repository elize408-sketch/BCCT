import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerFileRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // POST /api/files/upload - Uploads file
  fastify.post(
    '/api/files/upload',
    {
      schema: {
        description: 'Upload a file',
        tags: ['files'],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              filename: { type: 'string' },
              fileUrl: { type: 'string' },
              fileSize: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Uploading file');

      try {
        // Get file from multipart
        const data = await request.file({ limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB limit

        if (!data) {
          return reply.status(400).send({ error: 'No file provided' });
        }

        let buffer: Buffer;
        try {
          buffer = await data.toBuffer();
        } catch (err) {
          app.logger.warn({ userId }, 'File too large');
          return reply.status(413).send({ error: 'File too large' });
        }

        // Create storage key
        const timestamp = Date.now();
        const storageKey = `files/${userId}/${timestamp}-${data.filename}`;

        // Upload to storage
        const uploadedKey = await app.storage.upload(storageKey, buffer);

        // Generate signed URL
        const { url } = await app.storage.getSignedUrl(uploadedKey);

        // Save file metadata to database
        const file = await app.db
          .insert(schema.files)
          .values({
            userId,
            filename: data.filename,
            fileUrl: uploadedKey,
            fileSize: buffer.length,
            mimeType: data.mimetype,
            uploadedAt: new Date(),
          })
          .returning();

        app.logger.info(
          { userId, fileId: file[0].id, filename: data.filename, size: buffer.length },
          'File uploaded'
        );

        return {
          id: file[0].id,
          filename: file[0].filename,
          fileUrl: url,
          fileSize: file[0].fileSize,
        };
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to upload file');
        return reply.status(500).send({ error: 'Failed to upload file' });
      }
    }
  );

  // GET /api/files - Returns files for current user
  fastify.get(
    '/api/files',
    {
      schema: {
        description: 'Get files for current user',
        tags: ['files'],
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
      app.logger.info({ userId }, 'Fetching files');

      try {
        const files = await app.db
          .select()
          .from(schema.files)
          .where(eq(schema.files.userId, userId));

        app.logger.info({ userId, count: files.length }, 'Files fetched');
        return files;
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to fetch files');
        return reply.status(500).send({ error: 'Failed to fetch files' });
      }
    }
  );

  // GET /api/files/:id/download - Returns signed URL for download
  fastify.get(
    '/api/files/:id/download',
    {
      schema: {
        description: 'Get signed URL for file download',
        tags: ['files'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              expiresAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params as { id: string };
      const userId = session.user.id;

      app.logger.info({ userId, fileId: id }, 'Generating download URL');

      try {
        // Verify file ownership
        const file = await app.db.query.files.findFirst({
          where: eq(schema.files.id, id as any),
        });

        if (!file) {
          return reply.status(404).send({ error: 'File not found' });
        }

        if (file.userId !== userId) {
          return reply.status(403).send({ error: 'Forbidden: not file owner' });
        }

        // Generate signed URL
        const { url, expiresAt } = await app.storage.getSignedUrl(file.fileUrl);

        app.logger.info({ userId, fileId: id }, 'Download URL generated');

        return { url, expiresAt };
      } catch (error) {
        app.logger.error({ err: error, userId, fileId: id }, 'Failed to generate download URL');
        return reply.status(500).send({ error: 'Failed to generate download URL' });
      }
    }
  );

  // DELETE /api/files/:id - Deletes file
  fastify.delete(
    '/api/files/:id',
    {
      schema: {
        description: 'Delete file',
        tags: ['files'],
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

      app.logger.info({ userId, fileId: id }, 'Deleting file');

      try {
        // Verify file ownership
        const file = await app.db.query.files.findFirst({
          where: eq(schema.files.id, id as any),
        });

        if (!file) {
          return reply.status(404).send({ error: 'File not found' });
        }

        if (file.userId !== userId) {
          return reply.status(403).send({ error: 'Forbidden: not file owner' });
        }

        // Delete from storage
        await app.storage.delete(file.fileUrl);

        // Delete from database
        await app.db.delete(schema.files).where(eq(schema.files.id, id as any));

        app.logger.info({ userId, fileId: id }, 'File deleted');

        return { message: 'File deleted' };
      } catch (error) {
        app.logger.error({ err: error, userId, fileId: id }, 'Failed to delete file');
        return reply.status(500).send({ error: 'Failed to delete file' });
      }
    }
  );
}

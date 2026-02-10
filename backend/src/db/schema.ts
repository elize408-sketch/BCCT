import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  date,
  jsonb,
  uniqueIndex,
  index,
  time,
  check as pgCheck,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Profiles table (extends Better Auth users)
export const profiles = pgTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name'),
    phone: text('phone'),
    role: text('role').notNull(),
    goals: text('goals'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('profiles_email_idx').on(table.email),
    roleIdx: index('profiles_role_idx').on(table.role),
    roleCheck: pgCheck('role_enum', sql`role IN ('client', 'coach', 'org_admin')`),
  })
);

// Organizations table
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Org members table
export const orgMembers = pgTable(
  'org_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roleCheck: pgCheck('org_member_role_enum', sql`role IN ('admin', 'member')`),
  })
);

// Coach-client relationship
export const coachClients = pgTable(
  'coach_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    coachId: text('coach_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    coachIdIdx: index('coach_clients_coach_id_idx').on(table.coachId),
    clientIdIdx: index('coach_clients_client_id_idx').on(table.clientId),
    statusIdx: index('coach_clients_status_idx').on(table.status),
    statusCheck: pgCheck('status_enum', sql`status IN ('intake', 'active', 'paused', 'completed')`),
  })
);

// Program templates
export const programTemplates = pgTable('program_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  coachId: text('coach_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  published: boolean('published').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Program weeks
export const programWeeks = pgTable('program_weeks', {
  id: uuid('id').primaryKey().defaultRandom(),
  programId: uuid('program_id').notNull().references(() => programTemplates.id, { onDelete: 'cascade' }),
  weekNumber: integer('week_number').notNull(),
  title: text('title'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Program tasks
export const programTasks = pgTable(
  'program_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weekId: uuid('week_id').notNull().references(() => programWeeks.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    contentJson: jsonb('content_json'),
    orderIndex: integer('order_index'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    typeCheck: pgCheck('task_type_enum', sql`type IN ('reflection', 'exercise', 'reading', 'audio')`),
  })
);

// Client programs (assignments)
export const clientPrograms = pgTable('client_programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: text('client_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').notNull().references(() => programTemplates.id, { onDelete: 'cascade' }),
  assignedBy: text('assigned_by').notNull().references(() => profiles.id, { onDelete: 'restrict' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// Task completions
export const taskCompletions = pgTable('task_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientProgramId: uuid('client_program_id').notNull().references(() => clientPrograms.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').notNull().references(() => programTasks.id, { onDelete: 'cascade' }),
  completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
  responseJson: jsonb('response_json'),
}, (table) => ({
  clientProgramTaskIdx: uniqueIndex('task_completions_client_program_task_idx')
    .on(table.clientProgramId, table.taskId),
}));

// Checkins
export const checkins = pgTable(
  'checkins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    stress: integer('stress'),
    energy: integer('energy'),
    sleep: integer('sleep'),
    mood: integer('mood'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userDateIdx: uniqueIndex('checkins_user_date_idx').on(table.userId, table.date),
    stressCheck: pgCheck('stress_range', sql`stress >= 0 AND stress <= 10`),
    energyCheck: pgCheck('energy_range', sql`energy >= 0 AND energy <= 10`),
    sleepCheck: pgCheck('sleep_range', sql`sleep >= 0 AND sleep <= 10`),
    moodCheck: pgCheck('mood_range', sql`mood >= 0 AND mood <= 10`),
  })
);

// Appointments
export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    coachId: text('coach_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes'),
    notes: text('notes'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    coachScheduledIdx: index('appointments_coach_scheduled_idx').on(table.coachId, table.scheduledAt),
    clientScheduledIdx: index('appointments_client_scheduled_idx').on(table.clientId, table.scheduledAt),
    statusCheck: pgCheck('appointment_status_enum', sql`status IN ('scheduled', 'completed', 'cancelled')`),
  })
);

// Conversations
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  coachId: text('coach_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Messages
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  conversationCreatedIdx: index('messages_conversation_created_idx').on(table.conversationId, table.createdAt),
}));

// Coach notes
export const coachNotes = pgTable('coach_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  coachId: text('coach_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Files
export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
});

// Notification preferences
export const notificationPrefs = pgTable('notification_prefs', {
  userId: text('user_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  pushEnabled: boolean('push_enabled').default(true).notNull(),
  dailyCheckinTime: time('daily_checkin_time'),
  timezone: text('timezone'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Notifications outbox
export const notificationsOutbox = pgTable('notifications_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  dataJson: jsonb('data_json'),
  sendAfter: timestamp('send_after', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Device tokens
export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    platform: text('platform').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    platformCheck: pgCheck('platform_enum', sql`platform IN ('ios', 'android', 'web')`),
  })
);

// Audit logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => profiles.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

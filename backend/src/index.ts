import { createApplication, resend } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';
import { emailOTP } from "better-auth/plugins";

// Combine schemas for full database type support
const schema = { ...appSchema, ...authSchema };

// Create application
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Setup authentication with email OTP
app.withAuth({
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        // Send OTP via email - don't await to prevent timing attacks
        resend.emails.send({
          from: 'BCCT <noreply@example.com>',
          to: email,
          subject: type === 'sign-in' ? 'Your sign-in code for BCCT' : 'Your verification code for BCCT',
          html: `<p>Your verification code is: <strong>${otp}</strong></p><p>Valid for 10 minutes.</p>`,
        });
      },
    }),
  ],
});

// Setup storage for file uploads
app.withStorage();

// Import route registration functions
import { registerProfileRoutes } from './routes/profile.js';
import { registerClientRoutes } from './routes/client.js';
import { registerCoachRoutes } from './routes/coach.js';
import { registerOrgRoutes } from './routes/org.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerFileRoutes } from './routes/files.js';
import { registerNotificationRoutes } from './routes/notifications.js';

// Register all route modules
registerProfileRoutes(app);
registerClientRoutes(app);
registerCoachRoutes(app);
registerOrgRoutes(app);
registerChatRoutes(app);
registerFileRoutes(app);
registerNotificationRoutes(app);

await app.run();
app.logger.info('Application running');

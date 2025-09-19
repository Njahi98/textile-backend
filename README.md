## Backend Textile Project

This is the backend for a textile management system, built with Node.js, Express, TypeScript, and Prisma (PostgreSQL).

## Features

### Authentication & Security
- JWT authentication/Google Login authentication with refresh tokens and role-based access (USER, ADMIN, SUPERADMIN)
- Session management with device tracking and automatic cleanup
- Password reset via email with Google SMTP integration
- Rate limiting and CORS protection

### User & Worker Management
- Complete CRUD operations for users and workers
- User status management (active, inactive, suspended) 
- Worker CSV import/export functionality
- Avatar and profile management with Cloudinary integration

### Production Management
- Production line CRUD with capacity tracking and status control
- Assignment system for workers to production lines with shift management
- Assignment calendar view and conflict detection
- Product management with image upload and category organization

### Performance & Analytics
- Performance record tracking (pieces made, time taken, error rates)
- Real-time metrics and productivity analytics
- AI-powered insights using Google Gemini API for data analysis

### Real-Time Communication
- Live chat system with Socket.IO (group and direct messaging)
- File sharing with multiple format support (images, documents, videos)
- Message read receipts and real-time user presence
- Push notifications for messages and system alerts

### Security & Compliance
- Comprehensive audit logging system (tracks user actions, exports, and system events for accountability)

### Additional Features
- Dashboard with comprehensive metrics and charts
- Account management with profile updates
- Automated session cleanup and graceful shutdown handling

### Main Endpoints
  - `/api/auth` – Auth flows
  - `/api/users` – User CRUD
  - `/api/workers` – Worker CRUD, CSV import
  - `/api/production-lines` – Production line CRUD, metrics, toggle status
  - `/api/assignments` – Assign workers to lines, shifts, positions; history tracking
  - `/api/products` – Product CRUD, inventory codes, categories, image upload
  - `/api/performance` – Performance records (create, query, filter by worker/product/line/date)
  - `/api/chat` – Conversations, messages, file uploads, read receipts
  - `/api/insights` – AI Analytics, reports, dashboard KPIs
  - `/api/settings/account` – Account settings (password update, account information update, avatar update)
  - `/api/notifications` – in-Dashboard Notifications, mark as read/unread
  - `/api/audit-logs` – Audit logging system

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up your `.env` file with the following variables:

   - `DATABASE_URL` – PostgreSQL connection string
   - `FRONTEND_URL` – Allowed CORS origin (e.g., http://localhost:3000)
   - `PORT` – Server listening port (e.g., `5000`)
   - `NODE_ENV` – Set to `production` in production environments
   - `JWT_SECRET` – Secret for JWT authentication
   - `JWT_REFRESH_SECRET` – Secret for refresh token authentication
   - `GOOGLE_APP_USER` – Google account email for sending password reset emails
   - `GOOGLE_APP_PASSWORD` – Google app password for sending password reset emails
   - `GEMINI_API_KEY` – Google Gemini API key for AI features and natural language processing
   - `CLOUDINARY_CLOUD_NAME` – Cloudinary Cloud name for uploading images
   - `CLOUDINARY_API_KEY` – Cloudinary API Key for uploading images
   - `CLOUDINARY_API_SECRET` – Cloudinary API Secret for uploading images
   - `GOOGLE_CLIENT_ID` – Google OAuth 2.0 Client ID for login via Google  
   - `GOOGLE_CLIENT_SECRET` – Google OAuth 2.0 Client Secret for login via Google  

3. Run migrations:
   ```bash
   npx prisma init --datasource-provider postgresql --output ../generated/prisma
   npx prisma generate
   npx prisma migrate dev --name migration_name
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

###  Frontend
See [`Textile Frontend`](https://github.com/Njahi98/textile-frontend) for frontend setup and API details.
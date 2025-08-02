## Backend Textile Project

This is the backend for a textile management system, built with Node.js, Express, TypeScript, and Prisma (PostgreSQL).

### Features
- User authentication (JWT, roles: USER, ADMIN, SUPERADMIN)
- Admin CRUD for users, workers, and production lines
- Worker management (CRUD, CSV import)
- Production line management (CRUD, toggle active/inactive, metrics)
- Assignment, Product and performance tracking
- Validation with Zod

### Main Endpoints
- `/api/auth` – Register, login, password reset, get current user
- `/api/users` – Admin CRUD for users
- `/api/workers` – Admin CRUD for workers, CSV import (`POST /import`)
- `/api/production-lines` – Admin CRUD for production lines, toggle status, view metrics
- `/api/assignments` – Admin CRUD for Assignments, Assign workers to production lines, shifts, positions, view Assignements calendar, check conflicts
- `/api/products` – Admin CRUD for products, toggle status, upload product images with Cloudinary

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up your `.env` file with the following variables:

   - `DATABASE_URL` – PostgreSQL connection string
   - `FRONTEND_URL` – Allowed CORS origin (e.g., http://localhost:3000)
   - `PORT` – Server listening port (e.g., `5000`)
   - `JWT_SECRET` – Secret for JWT authentication
   - `NODE_ENV` – Set to `production` in production environments
   - `GOOGLE_APP_USER` – Google account email for sending password reset emails
   - `GOOGLE_APP_PASSWORD` – Google app password for sending password reset emails
   - `CLOUDINARY_CLOUD_NAME` – Cloudinary Cloud name for uploading images
   - `CLOUDINARY_API_KEY` – Cloudinary API Key for uploading images
   - `CLOUDINARY_API_SECRET` – Cloudinary API Secret for uploading images
3. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

###  Frontend
See [`Textile Frontend`](https://github.com/Njahi98/textile-frontend) for frontend setup and API details.
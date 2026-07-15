# BE_MusicApp (Node.js Backend)

> Express.js + TypeScript + MongoDB + MinIO + Socket.IO

A modular backend architecture providing RESTful APIs for authentication, user management, file storage (MinIO), and a real-time messaging system (Socket.IO).

---

## 🚀 Features

- **Authentication**: JWT-based login/register, Google OAuth, Refresh Tokens, Password Reset.
- **User Management**: CRUD operations with role-based access control.
- **File Storage**: Direct-to-MinIO uploads via Presigned URLs, automatic WebP conversion for images.
- **Real-time Chat**: 1-1 and Group messaging using Socket.IO with MongoDB persistence.
- **Security & Best Practices**: Helmet, CORS, Rate Limiting, Joi validation, Winston logging, API documentation (Swagger).

---

## 🛠 Prerequisites

Make sure you have the following installed on your machine:
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)
- [MinIO](https://min.io/) (Local or Docker)

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory and copy the contents from `.env.example`. Update the values according to your environment.

```env
# ─── App ───
NODE_ENV=development
PORT=3000

# ─── MongoDB ───
MONGODB_HOST=cluster0.lybwnco.mongodb.net
MONGODB_USER=your_db_user
MONGODB_PASS=your_db_pass
MONGODB_DB=nodejs-app

# ─── JWT ───
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# ─── Google OAuth ───
GOOGLE_CLIENT_ID=your_google_client_id

# ─── MinIO Storage ───
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=uploads
```

---

## 📦 Installation & Running Locally

### 1. Start MinIO (using Docker)
The project requires MinIO for file storage. You can run it quickly using Docker:
```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  -v ~/minio/data:/data \
  quay.io/minio/minio server /data --console-address ":9001"
```
*Note: Make sure to create a bucket named `uploads` (or whatever you set in `MINIO_BUCKET_NAME`) and set its access policy to `public` so files can be accessed via URL.*

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
```bash
npm run dev
```
The server will start at `http://localhost:3000`.

---

## 📖 API Documentation

Once the server is running, you can access the Swagger UI documentation at:
👉 **[http://localhost:3000/docs](http://localhost:3000/docs)**

---

## 📁 Project Structure

```
src/
├── modules/          # Feature modules (Domain-driven)
│   ├── auth/         # Authentication (Register, Login, Google OAuth, Reset Password)
│   ├── users/        # User management CRUD
│   ├── files/        # MinIO presigned URLs and song metadata DB saving
│   └── chat/         # Real-time Chat (1-1 and Groups) via REST & Socket.IO
├── shared/           # Shared utilities
│   ├── config/       # Env validation, database config, swagger config
│   ├── middlewares/  # Auth checking, request validation, error handling
│   ├── services/     # Third-party integrations (e.g., MinioService)
│   ├── utils/        # Logger (Winston), custom ApiError class
│   └── types/        # Global TypeScript interfaces
├── app.ts            # Express application setup & middleware registration
└── server.ts         # Server entry point & graceful shutdown logic
```

---

## 📡 Core API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `/health` | Server health check |
| **POST** | `/api/v1/auth/login` | User login |
| **POST** | `/api/v1/auth/register` | User registration |
| **POST** | `/api/v1/files/generate-minio-url` | Get MinIO presigned URL for direct upload |
| **POST** | `/api/v1/chat/conversations` | Create or get a 1-1 chat room |
| **POST** | `/api/v1/chat/groups` | Create a group chat |

*(Check the `/docs` route for the complete list and interactive API testing)*

---

## 🔧 NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `nodemon` | Start development server with hot-reload |
| `npm run build` | `tsc` | Compile TypeScript source code to `dist/` |
| `npm start` | `node dist/server.js` | Run the compiled production server |
| `npm run lint` | `eslint src/**/*.ts` | Run ESLint to find code issues |
| `npm run lint:fix` | `eslint src/**/*.ts --fix`| Auto-fix ESLint issues |
| `npm run format`| `prettier --write "src/**/*.ts"`| Format code with Prettier |

---

## 📝 Adding a New Module

To maintain the modular architecture, follow these steps when adding a new feature (e.g., `products`):

1. Create a folder `src/modules/products/`
2. Create the necessary files:
   - `products.model.ts` — Mongoose schema and interfaces
   - `products.dto.ts` — TypeScript interfaces for Data Transfer Objects
   - `products.validation.ts` — Joi validation schemas for requests
   - `products.service.ts` — Core business logic and DB interactions
   - `products.controller.ts` — Express request handlers (calling the service)
   - `products.routes.ts` — Express router definitions
3. Register the new router in `src/app.ts`:
   ```typescript
   import productsRoutes from '@modules/products/products.routes';
   // ...
   app.use('/api/v1/products', productsRoutes);
   ```

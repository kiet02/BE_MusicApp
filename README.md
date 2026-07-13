# Node.js Backend API

> Express.js + TypeScript + MongoDB — Modular Architecture

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- MongoDB (local or Atlas)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your settings
# MONGODB_URI=mongodb://localhost:27017/nodejs-app
# JWT_SECRET=your-secret-key
```

### Development

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
src/
├── modules/          # Feature modules
│   ├── auth/         # Authentication (register, login, me)
│   └── users/        # Users CRUD
├── shared/           # Shared utilities
│   ├── config/       # Env, database config
│   ├── middlewares/   # Auth, validation, error handling
│   ├── utils/        # API response, errors, logger
│   ├── constants/    # App-wide constants
│   └── types/        # Shared TypeScript types
├── app.ts            # Express app setup
└── server.ts         # Server entry point
```

## 📡 API Endpoints

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |

### Auth (`/api/v1/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ❌ | Register new user |
| POST | `/login` | ❌ | Login |
| GET | `/me` | ✅ | Get current user |

### Users (`/api/v1/users`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | ✅ | Any | List users (paginated) |
| GET | `/:id` | ✅ | Any | Get user by ID |
| POST | `/` | ✅ | Admin | Create user |
| PUT | `/:id` | ✅ | Admin | Update user |
| DELETE | `/:id` | ✅ | Admin | Delete user |

## 🔧 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `npm run format` | Format code with Prettier |

## 📝 Adding a New Module

1. Create folder `src/modules/<module-name>/`
2. Create files:
   - `<name>.model.ts` — Mongoose schema
   - `<name>.dto.ts` — DTOs
   - `<name>.validation.ts` — Joi schemas
   - `<name>.service.ts` — Business logic
   - `<name>.controller.ts` — Request handlers
   - `<name>.routes.ts` — Route definitions
3. Register routes in `src/app.ts`

## 🔒 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | — |
| `JWT_SECRET` | JWT signing secret | — |
| `JWT_EXPIRES_IN` | JWT expiration | `7d` |
# BE_MusicApp

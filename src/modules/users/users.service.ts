import { User, IUser } from './users.model';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { NotFoundError, ConflictError } from '@shared/utils/api-error';
import { PAGINATION } from '@shared/constants';

export class UsersService {
  async createUser(data: CreateUserDto): Promise<IUser> {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new ConflictError('Email already in use');
    }

    const user = await User.create(data);
    return user;
  }

  async getUsers(query: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
  }) {
    const page = query.page || PAGINATION.DEFAULT_PAGE;
    const limit = query.limit || PAGINATION.DEFAULT_LIMIT;
    const sort = query.sort || 'createdAt';
    const order = query.order || 'desc';
    const skip = (page - 1) * limit;

    // Build filter
    const filter: Record<string, unknown> = {};
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return {
      data: users,
      page,
      limit,
      total,
    };
  }

  async getUserById(id: string): Promise<IUser> {
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<IUser> {
    if (data.email) {
      const existingUser = await User.findOne({ email: data.email, d: { $ne: id } });
      if (existingUser) {
        throw new ConflictError('Email already in use');
      }
    }

    const user = await User.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      throw new NotFoundError('User');
    }
  }
}

export const usersService = new UsersService();

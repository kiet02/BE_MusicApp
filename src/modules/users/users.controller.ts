import { Request, Response } from 'express';
import { catchAsync } from '@shared/utils/catch-async';
import { ApiResponse } from '@shared/utils/api-response';
import { usersService } from './users.service';

export class UsersController {
  createUser = catchAsync(async (req: Request, res: Response) => {
    const user = await usersService.createUser(req.body);
    ApiResponse.created(res, user, 'User created successfully');
  });

  getUsers = catchAsync(async (req: Request, res: Response) => {
    const { data, page, limit, total } = await usersService.getUsers(req.query);
    ApiResponse.paginated(res, data, page, limit, total, 'Users retrieved successfully');
  });

  getUserById = catchAsync(async (req: Request, res: Response) => {
    const user = await usersService.getUserById(req.params.id as string);
    ApiResponse.success(res, user, 'User retrieved successfully');
  });

  updateUser = catchAsync(async (req: Request, res: Response) => {
    const user = await usersService.updateUser(req.params.id as string, req.body);
    ApiResponse.success(res, user, 'User updated successfully');
  });

  deleteUser = catchAsync(async (req: Request, res: Response) => {
    await usersService.deleteUser(req.params.id as string);
    ApiResponse.noContent(res);
  });
}

export const usersController = new UsersController();

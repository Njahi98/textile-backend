import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import bcrypt from 'bcrypt';
import { Role, Status } from '../generated/prisma';
import { deleteImageFromCloudinary } from '../utils/imageUpload';

interface CreateUserData {
  email: string;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: Role;
  isDeleted?:boolean;
  deletedAt?:Date;
}
interface idParams{
  id:string;
}

interface UpdateUserData {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: Role;
  password?: string;
  status:Status
  isDeleted?:boolean;
  deletedAt?:Date;
}

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where:{ isDeleted:false },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid user ID provided'
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId, isDeleted: false },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (
  req: Request<{}, {}, CreateUserData>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, username, firstName, lastName, phone, role } = req.body;

    const existingUserByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUserByEmail) {
      res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'An account with this email already exists'
      });
      return;
    }

    const existingUserByUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUserByUsername) {
      res.status(409).json({
        error: 'USERNAME_EXISTS',
        message: 'An account with this username already exists'
      });
      return;
    }

    if (phone) {
      const existingUserByPhone = await prisma.user.findUnique({
        where: { phone },
      });

      if (existingUserByPhone) {
        res.status(409).json({
          error: 'PHONE_EXISTS',
          message: 'An account with this phone number already exists'
        });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        role: role || 'USER',
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        role: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: Request<{ id: string }, {}, UpdateUserData>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid user ID provided'
      });
      return;
    }

    const { email, username, firstName, lastName, phone, role, password,status } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });

      if (emailExists) {
        res.status(409).json({
          error: 'EMAIL_EXISTS',
          message: 'This email is already in use'
        });
        return;
      }
    }

    if (username && username !== existingUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username },
      });

      if (usernameExists) {
        res.status(409).json({
          error: 'USERNAME_EXISTS',
          message: 'This username is already in use'
        });
        return;
      }
    }

    if (phone && phone !== existingUser.phone) {
      const phoneExists = await prisma.user.findUnique({
        where: { phone },
      });

      if (phoneExists) {
        res.status(409).json({
          error: 'PHONE_EXISTS',
          message: 'This phone number is already in use'
        });
        return;
      }
    }

    const updateData: any = {};
    if (email) updateData.email = email;
    if (username) updateData.username = username;
    if (firstName !== undefined) updateData.firstName = firstName || null;
    if (lastName !== undefined) updateData.lastName = lastName || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid user ID provided'
      });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarPublicId: true, email: true, phone: true, username: true }
    });

    if (!existingUser) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

      if (existingUser.avatarPublicId) {
      try {
        await deleteImageFromCloudinary(existingUser.avatarPublicId);
      } catch (error) {
        console.error('Failed to delete avatar from Cloudinary:', error);
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data:{
        isDeleted:true,
        deletedAt:new Date(),
        status:Status.inactive,
        email:`deleted_${existingUser.email}_${new Date().toISOString()}`,
        username:`deleted_${existingUser.username}_${new Date().toISOString()}`,
        phone:`deleted_${existingUser.phone}_${new Date().toISOString()}`,
        avatarPublicId:null,
        avatarUrl:null,
        firstName:null,
        lastName:null,
        googleId:null,
      }
    });

    await prisma.userSession.updateMany({
      where: { userId },
      data: { isActive: false },
    })

    await prisma.conversationParticipant.updateMany({
      where: { userId },
      data: { isActive: false },
    })
    

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

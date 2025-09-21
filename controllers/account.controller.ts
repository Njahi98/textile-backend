import { Response, NextFunction } from "express";
import { prisma } from '../server';
import bcrypt from "bcrypt"
import { Status } from 'generated/prisma';
import { AuthenticatedRequest } from "../types";
import { uploadImageToCloudinary, deleteImageFromCloudinary } from "../utils/imageUpload";

export const accountSettings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        role: true,
        avatarUrl: true,
        avatarPublicId: true,
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

export const updateAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const { email, username, firstName, lastName, phone, password, status } = req.body;

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
        avatarUrl: true,
        avatarPublicId: true,
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

export const updateAvatar = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get existing user to handle avatar replacement
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPublicId: true }
    });

    if (!existingUser) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: 'NO_FILE',
        message: 'No avatar file provided'
      });
      return;
    }

    try {
      // Upload new avatar
      const uploadResult = await uploadImageToCloudinary(req.file.buffer, 'avatars');

      // Delete old avatar if it exists
      if (existingUser.avatarPublicId) {
        await deleteImageFromCloudinary(existingUser.avatarPublicId);
      }

      // Update user with new avatar
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          avatarUrl: uploadResult.url,
          avatarPublicId: uploadResult.publicId,
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
          avatarUrl: true,
          avatarPublicId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({
        success: true,
        message: 'Avatar updated successfully',
        user: updatedUser,
      });
    } catch (uploadError) {
      res.status(400).json({
        error: 'AVATAR_UPLOAD_FAILED',
        message: 'Failed to upload avatar'
      });
      return;
    }
  } catch (error) {
    next(error);
  }
};

export const deleteAvatar = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPublicId: true, avatarUrl: true }
    });

    if (!user) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    if (!user.avatarPublicId) {
      res.status(400).json({
        error: 'NO_AVATAR',
        message: 'User has no avatar to delete'
      });
      return;
    }

    // Delete avatar from Cloudinary
    await deleteImageFromCloudinary(user.avatarPublicId);

    // Update user to remove avatar references
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: null,
        avatarPublicId: null,
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
        avatarUrl: true,
        avatarPublicId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      message: 'Avatar deleted successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPublicId: true, email:true,phone:true,username:true,}
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
      data: { isActive: false }
    });

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
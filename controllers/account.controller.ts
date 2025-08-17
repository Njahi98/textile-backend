import { Request, Response, NextFunction } from "express";
import { prisma } from "server";
import bcrypt from "bcrypt"
import { Role, Status } from 'generated/prisma';
import { AuthenticatedRequest } from "../types";


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

export const deleteAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

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

    await prisma.user.delete({
      where: { id: userId },
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
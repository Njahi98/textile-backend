import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';

export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid product ID' });
      return;
    }
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        performanceRecords: {
          include: { worker: true, productionLine: true },
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });
    if (!product) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Product not found' });
      return;
    }
    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, code, description, category, unitPrice } = req.body;
    const product = await prisma.product.create({
      data: {
        name,
        code,
        description: description || null,
        category: category || null,
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
      },
    });
    res.status(201).json({ success: true, message: 'Product created', product });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid product ID' });
      return;
    }
    const { name, code, description, category, unitPrice, isActive } = req.body;
    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        code,
        description,
        category,
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        isActive,
      },
    });
    res.json({ success: true, message: 'Product updated', product });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid product ID' });
      return;
    }
    await prisma.product.delete({ where: { id } });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
}; 
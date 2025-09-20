import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { uploadImageToCloudinary, deleteImageFromCloudinary } from '../utils/imageUpload';

export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      where: { isDeleted: false },
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
      where: { id, isDeleted: false },
      include: {
        performanceRecords: {
          where: {
            worker: { isDeleted: false },
            productionLine: { isDeleted: false },
          },
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
    let imageUrl = null;
    let imagePublicId = null;

    if (code) {
      const existingProduct = await prisma.product.findFirst({
        where: { code },
      });

      if (existingProduct) {
        res.status(409).json({
          error: 'CODE_EXISTS',
          message: 'A product with this code already exists'
        });
        return;
      }
    }

    // Handle image upload if provided
    if (req.file) {
      try {
        const uploadResult = await uploadImageToCloudinary(req.file.buffer, 'products');
        imageUrl = uploadResult.url;
        imagePublicId = uploadResult.publicId;
      } catch (uploadError) {
        res.status(400).json({ 
          error: 'IMAGE_UPLOAD_FAILED', 
          message: 'Failed to upload image' 
        });
        return;
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        code,
        description: description || null,
        category: category || null,
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        imageUrl,
        imagePublicId,
      },
    });

    res.status(201).json({ success: true, message: 'Product created', product });
  } catch (error) {
    // If product creation fails but image was uploaded, clean up the image
    if (req.file && req.body.imagePublicId) {
      await deleteImageFromCloudinary(req.body.imagePublicId);
    }
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

    // Get existing product to handle image replacement
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      select: { imagePublicId: true, code: true }
    });

    if (!existingProduct) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Product not found' });
      return;
    }

    const { name, code, description, category, unitPrice, isActive } = req.body;
    let imageUrl = undefined;
    let imagePublicId = undefined;

      if (code && code !== existingProduct.code) {
        const codeExists = await prisma.product.findUnique({
          where: { code },
        });

      if (codeExists) {
        res.status(409).json({
          error: 'CODE_EXISTS',
          message: 'A product with this code already exists'
        });
        return;
      }
    }

    // Handle new image upload
    if (req.file) {
      try {
        const uploadResult = await uploadImageToCloudinary(req.file.buffer, 'products');
        imageUrl = uploadResult.url;
        imagePublicId = uploadResult.publicId;

        // Delete old image if it exists
        if (existingProduct.imagePublicId) {
          await deleteImageFromCloudinary(existingProduct.imagePublicId);
        }
      } catch (uploadError) {
        res.status(400).json({ 
          error: 'IMAGE_UPLOAD_FAILED', 
          message: 'Failed to upload image' 
        });
        return;
      }
    }

    const updateData: any = {
      name,
      code,
      description,
      category,
      unitPrice: unitPrice ? parseFloat(unitPrice) : null,
      isActive,
    };

    // Only update image fields if new image was uploaded
    if (imageUrl !== undefined) {
      updateData.imageUrl = imageUrl;
      updateData.imagePublicId = imagePublicId;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
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

      const existingProduct = await prisma.product.findUnique({
        where: { id },
        select: { imagePublicId: true, code: true }
      });

    if (!existingProduct) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Product not found' });
      return;
    }

    await prisma.product.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
        code: `deleted_${existingProduct.code}_${new Date().toISOString()}`,
        imagePublicId: null,
        imageUrl: null,
      }
    });

    if (existingProduct.imagePublicId) {
      try {
        await deleteImageFromCloudinary(existingProduct.imagePublicId);
      } catch (error) {
        console.error('Failed to delete image from Cloudinary:', error);
      }
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const deleteProductImage = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid product ID' });
      return;
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { imagePublicId: true }
    });

    if (!product) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Product not found' });
      return;
    }

    if (!product.imagePublicId) {
      res.status(400).json({ error: 'NO_IMAGE', message: 'Product has no image to delete' });
      return;
    }

    // Delete image from Cloudinary
    await deleteImageFromCloudinary(product.imagePublicId);

    // Update product to remove image references
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        imageUrl: null,
        imagePublicId: null,
      },
    });

    res.json({ success: true, message: 'Product image deleted', product: updatedProduct });
  } catch (error) {
    next(error);
  }
};

export const toggleProductStatus = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid product ID' });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Product not found' });
      return;
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    });

    res.json({ 
      success: true, 
      message: `Product is now ${updatedProduct.isActive ? 'active' : 'inactive'}`, 
      product: updatedProduct 
    });
  } catch (error) {
    next(error);
  }
};
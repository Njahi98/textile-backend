import multer from 'multer';
import { Request } from 'express';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter for images only (your existing filter)
  const imageFileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// File filter for chat files (images, videos, documents)
  const chatFileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Videos
    'video/mp4', 'video/webm', 'video/quicktime', 'video/avi',
    // Documents
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv',
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'text/plain', // .txt
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not supported. Allowed types: images, videos, Excel files, CSV, PDF, and Word documents.`));
  }
};

// File filter for CSV only (for your data import functionality)
  const csvFileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ['text/csv', 'application/vnd.ms-excel'];
  
  if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'));
  }
};

// Configure different multer instances
export const upload = multer({
  storage: storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export const chatUpload = multer({
  storage: storage,
  fileFilter: chatFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export const csvUpload = multer({
  storage: storage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for CSV files (can be larger datasets)
  },
});

// Export middleware functions
export const uploadSingle = upload.single('image');
export const chatUploadSingle = chatUpload.single('file');
export const csvUploadSingle = csvUpload.single('csv');
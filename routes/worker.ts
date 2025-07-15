import { createWorker, deleteWorker, getAllWorkers, getWorkerById, importWorkers, updateWorker } from '@/controllers/worker.controller';
import { isAuthenticated, requireAdmin } from '@/middleware/isAuthenticated';
import { validate } from '@/middleware/validation';
import { workerCreateSchema, workerUpdateSchema } from '@/utils/validation';
import express from 'express';
import multer from 'multer';



const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});


router.use(isAuthenticated,requireAdmin);

router.get('/',getAllWorkers);
router.get('/:id', getWorkerById);
router.post('/',validate(workerCreateSchema),createWorker);
router.post('/import', upload.single('file'), importWorkers);
router.put('/:id',validate(workerUpdateSchema),updateWorker);
router.delete('/:id',deleteWorker);






export default router;
import { createWorker, deleteWorker, getAllWorkers, getWorkerById, importWorkers, updateWorker } from '../controllers/worker.controller';
import { isAuthenticated } from '../middleware/isAuthenticated';
import { validate } from '../middleware/validation';
import { workerCreateSchema, workerUpdateSchema } from '../utils/validation';
import express from 'express';
import multer from 'multer';
import { skipAudit } from '../middleware/auditMiddleware';



const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});


router.use(isAuthenticated);

router.get('/',getAllWorkers);
router.get('/:id', getWorkerById);
router.post('/',validate(workerCreateSchema),createWorker);
router.post('/import', skipAudit(), upload.single('file'), importWorkers);
router.put('/:id',validate(workerUpdateSchema),updateWorker);
router.delete('/:id',deleteWorker);






export default router;
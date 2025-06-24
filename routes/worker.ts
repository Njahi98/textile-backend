import { createWorker, deleteWorker, getAllWorkers, updateWorker } from '@/controllers/worker.controller';
import { isAuthenticated, requireAdmin } from '@/middleware/isAuthenticated';
import { validate } from '@/middleware/validation';
import { workerCreateSchema, workerUpdateSchema } from '@/utils/validation';
import express from 'express';

const router = express.Router();

router.use(isAuthenticated,requireAdmin);

router.get('/',getAllWorkers);
router.post('/',validate(workerCreateSchema),createWorker);
router.put('/:id',validate(workerUpdateSchema),updateWorker);
router.delete('/:id',deleteWorker);






export default router;
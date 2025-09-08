import express from 'express';
import {
  getAllAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignmentsCalendar,
  getAssignmentConflicts,
} from '@/controllers/assignment.controller';
import { isAuthenticated, requireAdmin } from '@/middleware/isAuthenticated';
import { validate } from '@/middleware/validation';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from '@/utils/validation';

const router = express.Router();

router.use(isAuthenticated);

router.get('/calendar', getAssignmentsCalendar);

router.get('/conflicts', getAssignmentConflicts);

router.get('/', getAllAssignments);

router.get('/:id', getAssignmentById);

router.post(
  '/',
  validate(createAssignmentSchema),
  createAssignment
);
router.put(
  '/:id',
  validate(updateAssignmentSchema),
  //@ts-ignore
  updateAssignment
);

router.delete('/:id', deleteAssignment);

export default router;

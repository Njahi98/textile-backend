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

router.get('/assignments/calendar', getAssignmentsCalendar);

router.get('/assignments/conflicts', getAssignmentConflicts);

router.get('/assignments/', getAllAssignments);

router.get('/assignments/:id', getAssignmentById);

router.post(
  '/assignments/',
  validate(createAssignmentSchema),
  createAssignment
);
router.put(
  '/assignments/:id',
  validate(updateAssignmentSchema),
  //@ts-ignore
  updateAssignment
);

router.delete('/assignments/:id', deleteAssignment);

export default router;

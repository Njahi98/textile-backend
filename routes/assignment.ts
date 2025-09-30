import express from 'express';
import {
  getAllAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignmentsCalendar,
} from '../controllers/assignment.controller';
import { isAuthenticated } from '../middleware/isAuthenticated';
import { validate, validateQuery } from '../middleware/validation';
import {
  calendarQuerySchema,
  createAssignmentSchema,
  updateAssignmentSchema,
} from '../utils/validation';

const router = express.Router();

router.use(isAuthenticated);

router.get('/calendar',validateQuery(calendarQuerySchema), getAssignmentsCalendar);

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

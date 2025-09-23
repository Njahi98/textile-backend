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

router.get('/assignments/calendar',validateQuery(calendarQuerySchema), getAssignmentsCalendar);

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

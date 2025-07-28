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



// Get assignments calendar (query validation)
// @ts-ignore
router.get('/calendar', isAuthenticated, getAssignmentsCalendar);

// Get assignment conflicts (optional query validation)
router.get('/conflicts', isAuthenticated, getAssignmentConflicts);

// @ts-ignore
router.get('/', isAuthenticated, getAllAssignments);

// @ts-ignore
router.get('/:id', isAuthenticated, getAssignmentById);

router.post(
  '/',
  isAuthenticated,
  requireAdmin,
  validate(createAssignmentSchema),
  createAssignment
);

router.put(
  '/:id',
  isAuthenticated,
  requireAdmin,
  validate(updateAssignmentSchema),
  // @ts-ignore
  updateAssignment
);

// @ts-ignore
router.delete('/:id', isAuthenticated, requireAdmin, deleteAssignment);



export default router;

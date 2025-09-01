import express, { Request, Response, NextFunction } from 'express';
import { isAuthenticated } from '../middleware/isAuthenticated';
import { validate, validateQuery } from '../middleware/validation';
import * as chatController from '../controllers/chat.controller';
import {
  createConversationSchema,
  markNotificationsReadSchema,
  searchUsersSchema,
  PaginationSchema,
} from '../utils/validation';
import { chatUploadSingle } from '../middleware/multer';


const router = express.Router();

router.use(isAuthenticated);

router.get('/conversations', 
  validateQuery(PaginationSchema),
  chatController.getConversations
);

router.post('/conversations', 
  validate(createConversationSchema),
  chatController.createConversation
);

router.get('/conversations/:conversationId/messages', 
  validateQuery(PaginationSchema),
  chatController.getConversationMessages
);
router.post('/conversations/:conversationId/upload', 
  chatUploadSingle,
  chatController.uploadFile
);

router.get('/notifications', 
  validateQuery(PaginationSchema),
  chatController.getNotifications
);

router.put('/notifications/read', 
  validate(markNotificationsReadSchema),
  chatController.markNotificationsRead
);

router.get('/users/search', 
  validateQuery(searchUsersSchema),
  chatController.searchUsers
);

router.post('/test-notification',
  chatController.testNotification
);

export default router;
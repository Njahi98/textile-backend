import express from 'express';
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

router.get('/chat/conversations', 
  validateQuery(PaginationSchema),
  chatController.getConversations
);

router.post('/chat/conversations', 
  validate(createConversationSchema),
  chatController.createConversation
);

router.get('/chat/conversations/:conversationId/messages', 
  validateQuery(PaginationSchema),
  chatController.getConversationMessages
);
router.post('/chat/conversations/:conversationId/upload', 
  chatUploadSingle,
  chatController.uploadFile
);

router.get('/chat/notifications', 
  validateQuery(PaginationSchema),
  chatController.getNotifications
);

router.put('/chat/notifications/read', 
  validate(markNotificationsReadSchema),
  chatController.markNotificationsRead
);

router.get('/chat/users/search', 
  validateQuery(searchUsersSchema),
  chatController.searchUsers
);

router.post('/chat/test-notification',
  chatController.testNotification
);

router.delete('/chat/notifications', 
  chatController.clearAllNotifications
);

export default router;
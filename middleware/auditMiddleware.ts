import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import AuditService from '../utils/auditService';
import { AuditResource } from '../generated/prisma';

// Map routes to resources
const routeResourceMap: { [key: string]: AuditResource } = {
  '/api/users': AuditResource.USER,
  '/api/workers': AuditResource.WORKER,
  '/api/products': AuditResource.PRODUCT,
  '/api/production-lines': AuditResource.PRODUCTION_LINE,
  '/api/assignments': AuditResource.ASSIGNMENT,
  '/api/performance-records': AuditResource.PERFORMANCE_RECORD,
  '/api/account': AuditResource.ACCOUNT,
  // Also map without /api/ prefix for when paths are stripped
  '/users': AuditResource.USER,
  '/workers': AuditResource.WORKER,
  '/products': AuditResource.PRODUCT,
  '/production-lines': AuditResource.PRODUCTION_LINE,
  '/assignments': AuditResource.ASSIGNMENT,
  '/performance-records': AuditResource.PERFORMANCE_RECORD,
  '/account': AuditResource.ACCOUNT,
};

// Get resource from route
function getResourceFromRoute(path: string): AuditResource | null {
  for (const [route, resource] of Object.entries(routeResourceMap)) {
    if (path.startsWith(route)) {
      return resource;
    }
  }
  return null;
}

// Get resource ID from URL
function getResourceIdFromUrl(path: string): string | null {
  const segments = path.split('/');
  // Look for numeric ID in URL segments
  for (const segment of segments) {
    if (/^\d+$/.test(segment)) {
      return segment;
    }
  }
  return null;
}

// Get action from HTTP method
function getActionFromMethod(method: string): string | null {
  switch (method) {
    case 'POST': return 'CREATE';
    case 'PUT':
    case 'PATCH': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    case 'GET': return null; // Don't log GET requests
    default: return null;
  }
}

interface AuditOptions {
  resource?: AuditResource;
  action?: string;
  skipAudit?: boolean;
  description?: string;
}

/**
 * Middleware to automatically log API actions
 */
export const auditLogger = (options: AuditOptions = {}) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Skip audit logging if specified
    if (options.skipAudit) {
      return next();
    }

    // Skip certain routes
    const skipRoutes = ['/api/health', '/api/auth/refresh', '/api/chat', '/chat'];
    if (skipRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }

    const originalSend = res.send;
    let responseBody: any;
    let oldValues: any;

    // Capture response data
    res.send = function (body: any) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // For UPDATE/DELETE operations, capture old values before the operation
    if ((req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') && req.user) {
      const resourceId = getResourceIdFromUrl(req.path);
      const resource = options.resource || getResourceFromRoute(req.path);
      
      if (resourceId && resource) {
        try {
          oldValues = await captureOldValues(resource, resourceId);
        } catch (error) {
          console.error('Error capturing old values for audit:', error);
        }
      }
    }

    // Continue with the original request
    next();

    // Log after response is sent
    res.on('finish', async () => {
      try {
        
        // Only log successful operations (2xx status codes)
        if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
          const resource = options.resource || getResourceFromRoute(req.path);
          
          if (!resource) {
            return;
          }

          const action = options.action || getActionFromMethod(req.method);
          
          // Skip logging if action is null (e.g., GET requests)
          if (!action) {
            return;
          }
          
          const resourceId = getResourceIdFromUrl(req.path);
          
          
          let newValues: any;
          try {
            const parsedResponse = typeof responseBody === 'string' ? 
              JSON.parse(responseBody) : responseBody;
            
            // Extract the created/updated entity from response
            if (parsedResponse.user) newValues = parsedResponse.user;
            else if (parsedResponse.worker) newValues = parsedResponse.worker;
            else if (parsedResponse.product) newValues = parsedResponse.product;
            else if (parsedResponse.productionLine) newValues = parsedResponse.productionLine;
            else if (parsedResponse.assignment) newValues = parsedResponse.assignment;
            else if (parsedResponse.performanceRecord) newValues = parsedResponse.performanceRecord;
          } catch (e) {
            // Ignore JSON parsing errors
          }

          await AuditService.log({
            userId: req.user.id,
            action: action as any,
            resource,
            resourceId: resourceId || null,
            oldValues,
            newValues,
            description: options.description || generateDescription(action, resource, resourceId),
          }, req);
        } else {
        }
      } catch (error) {
        console.error('Audit logging error:', error);
      }
    });
  };
};

// Capture old values before modification
async function captureOldValues(resource: AuditResource, resourceId: string): Promise<any> {
  const { prisma } = require('../server');
  const id = parseInt(resourceId);

  try {
    switch (resource) {
      case AuditResource.USER:
        return await prisma.user.findUnique({
          where: { id },
          select: {
            id: true, email: true, username: true, firstName: true, 
            lastName: true, phone: true, status: true, role: true
          }
        });
      case AuditResource.WORKER:
        return await prisma.worker.findUnique({
          where: { id },
          select: { id: true, name: true, cin: true, email: true, phone: true, role: true }
        });
      case AuditResource.PRODUCT:
        return await prisma.product.findUnique({
          where: { id },
          select: {
            id: true, name: true, code: true, description: true, 
            category: true, unitPrice: true, isActive: true
          }
        });
      case AuditResource.PRODUCTION_LINE:
        return await prisma.productionLine.findUnique({
          where: { id },
          select: {
            id: true, name: true, description: true, capacity: true, 
            targetOutput: true, location: true, isActive: true
          }
        });
      case AuditResource.ASSIGNMENT:
        return await prisma.assignment.findUnique({
          where: { id },
          select: {
            id: true, workerId: true, productionLineId: true, 
            position: true, date: true, shift: true
          }
        });
      case AuditResource.PERFORMANCE_RECORD:
        return await prisma.performanceRecord.findUnique({
          where: { id },
          select: {
            id: true, workerId: true, productId: true, productionLineId: true,
            date: true, piecesMade: true, shift: true, timeTaken: true, errorRate: true
          }
        });
      default:
        return null;
    }
  } catch (error) {
    console.error('Error capturing old values:', error);
    return null;
  }
}

// Generate human-readable description
function generateDescription(action: string, resource: AuditResource, resourceId?: string | null): string {
  const resourceName = resource.toLowerCase().replace('_', ' ');
  const actionName = action.toLowerCase();
  
  if (resourceId) {
    return `${actionName} ${resourceName} (ID: ${resourceId})`;
  }
  return `${actionName} ${resourceName}`;
}

/**
 * Middleware for specific audit logging with custom parameters
 */
export const auditAction = (
  action: string,
  resource: AuditResource,
  description?: string
) => {
  const options: AuditOptions = { action, resource };
  if (description) {
    options.description = description;
  }
  return auditLogger(options);
};

/**
 * Skip audit logging for specific routes
 */
export const skipAudit = () => {
  return auditLogger({ skipAudit: true });
};
import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRoles } from '../../../middleware/rbac';
import { sendError, sendSuccess } from '../../../utils/apiResponse';
import { checkoutOrder, getLedger, getOrderById, quoteOrder } from '../services/orderService';

const quoteInputSchema = z.object({
  cycleId: z.coerce.number().int().positive(),
  pickupPointId: z.coerce.number().int().positive(),
  pickupWindowId: z.coerce.number().int().positive(),
  taxJurisdictionCode: z.string().trim().min(1),
  items: z
    .array(
      z.object({
        listingId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().positive()
      })
    )
    .min(1)
});

const handleOrderError = (error: unknown, response: Response): boolean => {
  if (error instanceof z.ZodError) {
    sendError(response, 400, 'Invalid request payload.', 'INVALID_REQUEST_PAYLOAD', error.issues);
    return true;
  }

  if (error instanceof Error && error.message === 'INVALID_TAX_JURISDICTION') {
    sendError(response, 400, 'Tax jurisdiction not found.', 'INVALID_TAX_JURISDICTION');
    return true;
  }

  if (error instanceof Error && error.message.startsWith('INSUFFICIENT_INVENTORY:')) {
    sendError(response, 409, 'Insufficient inventory for one or more items.', 'INSUFFICIENT_INVENTORY');
    return true;
  }

  return false;
};

export const orderRouter = Router();

orderRouter.post('/orders/quote', requireAuth, requireRoles('MEMBER'), async (request, response, next) => {
  try {
    const payload = quoteInputSchema.parse(request.body);
    const quote = await quoteOrder(payload);
    sendSuccess(response, quote);
  } catch (error) {
    if (handleOrderError(error, response)) {
      return;
    }
    next(error);
  }
});

orderRouter.post('/orders/checkout', requireAuth, requireRoles('MEMBER'), async (request, response, next) => {
  try {
    const payload = quoteInputSchema.parse(request.body);
    const result = await checkoutOrder({
      userId: request.auth!.userId,
      input: payload
    });

    if (!result.ok) {
      const status = result.code === 'CAPACITY_EXCEEDED' ? 409 : 400;
      sendError(response, status, result.message ?? result.code, result.code);
      return;
    }

    sendSuccess(response, result, 201);
  } catch (error) {
    if (handleOrderError(error, response)) {
      return;
    }
    next(error);
  }
});

orderRouter.get('/orders/:id', requireAuth, requireRoles('MEMBER', 'GROUP_LEADER', 'REVIEWER', 'FINANCE_CLERK', 'ADMINISTRATOR'), async (request, response, next) => {
  try {
    const orderId = z.coerce.number().int().positive().parse(request.params.id);
    const order = await getOrderById({
      orderId,
      userId: request.auth!.userId,
      roles: request.auth!.roles
    });

    if (!order) {
      sendError(response, 404, 'Order not found.', 'ORDER_NOT_FOUND');
      return;
    }

    sendSuccess(response, order);
  } catch (error) {
    if (handleOrderError(error, response)) {
      return;
    }
    next(error);
  }
});

orderRouter.get('/finance/ledger', requireAuth, requireRoles('FINANCE_CLERK', 'ADMINISTRATOR'), async (_request, response, next) => {
  try {
    const rows = await getLedger();
    sendSuccess(response, rows);
  } catch (error) {
    next(error);
  }
});
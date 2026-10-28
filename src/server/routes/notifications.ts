import { Router, type Request, type Response } from 'express';
import { db } from '../db/index.ts';
import { notifications } from '../db/schema.ts';
import { eq, and, desc, or, isNull } from 'drizzle-orm';

export const notificationsRouter = Router();

// GET /api/notifications
notificationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { role, custodyId, userId } = req.query;

    const all = db.select().from(notifications).orderBy(desc(notifications.id)).limit(40).all();

    // Filter relevant notifications
    const filtered = all.filter((n) => {
      // If custodyId is specified and notification has custodyId, they must match (unless admin)
      if (custodyId && n.custodyId && n.custodyId !== Number(custodyId) && role !== 'admin') {
        return false;
      }
      // If targetRole is specified, it should match user's role or be null/broadcast
      if (n.targetRole && role && n.targetRole !== role && role !== 'admin') {
        return false;
      }
      // If targetUserId is specified, it should match userId
      if (n.targetUserId && userId && n.targetUserId !== Number(userId)) {
        return false;
      }
      return true;
    });

    const unreadCount = filtered.filter((n) => !n.isRead).length;

    res.json({
      notifications: filtered,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'خطأ في جلب الإشعارات' });
  }
});

// POST /api/notifications/:id/read
notificationsRouter.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).run();
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'فشل تحديث حالة الإشعار' });
  }
});

// POST /api/notifications/mark-all-read
notificationsRouter.post('/mark-all-read', async (req: Request, res: Response) => {
  try {
    const { custodyId, role } = req.body;
    if (custodyId) {
      db.update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.custodyId, Number(custodyId)))
        .run();
    } else {
      db.update(notifications).set({ isRead: true }).run();
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'فشل تحديث حالة الإشعارات' });
  }
});

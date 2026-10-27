import { Router, type Request, type Response } from 'express';
import { db } from '../db/index.ts';
import { custodies, users, items, warehouses, movements } from '../db/schema.ts';
import { count, eq, ne, desc } from 'drizzle-orm';
import { fromMilli } from '../../utils/rules.ts';

export const dashboardRouter = Router();

// GET /api/dashboard/stats
dashboardRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const custodiesCountRes = db.select({ value: count() }).from(custodies).get();
    const nonAdminUsersCountRes = db.select({ value: count() }).from(users).where(ne(users.role, 'admin')).get();
    const itemsCountRes = db.select({ value: count() }).from(items).get();
    const warehousesCountRes = db.select({ value: count() }).from(warehouses).get();
    const pendingMovementsRes = db.select({ value: count() }).from(movements).where(eq(movements.status, 'pending_approval')).get();

    const custodiesCount = custodiesCountRes?.value || 0;
    const usersCount = nonAdminUsersCountRes?.value || 0;
    const itemsCount = itemsCountRes?.value || 0;
    const warehousesCount = warehousesCountRes?.value || 0;
    const pendingMovementsCount = pendingMovementsRes?.value || 0;

    // Fetch recent 5 movements
    const recentMovementsRaw = db
      .select({
        id: movements.id,
        trx_number: movements.trxNumber,
        movement_type: movements.movementType,
        status: movements.status,
        quantity_milli: movements.quantityMilli,
        created_at: movements.createdAt,
        item_id: movements.itemId,
        custody_id: movements.custodyId,
        source_warehouse_id: movements.sourceWarehouseId,
        target_warehouse_id: movements.targetWarehouseId,
        created_by: movements.createdBy,
      })
      .from(movements)
      .orderBy(desc(movements.id))
      .limit(6)
      .all();

    const recentMovements = recentMovementsRaw.map((m) => {
      const it = db.select().from(items).where(eq(items.id, m.item_id)).get();
      const cu = db.select().from(custodies).where(eq(custodies.id, m.custody_id)).get();
      return {
        ...m,
        item_name: it?.name || 'صنف',
        item_code: it?.itemCode || '',
        custody_name: cu?.name || 'عهدة',
        quantity: fromMilli(m.quantity_milli),
      };
    });

    res.json({
      custodiesCount,
      usersCount,
      itemsCount,
      warehousesCount,
      pendingMovementsCount,
      recentMovements,
      stepsStatus: {
        step1Custody: custodiesCount > 0 ? 'completed' : 'ready',
        step2Users: custodiesCount === 0 ? 'incomplete' : usersCount >= 2 ? 'completed' : 'ready',
        step3Items: custodiesCount === 0 ? 'incomplete' : itemsCount > 0 ? 'completed' : 'ready',
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'خطأ في جلب إحصائيات لوحة التحكم' });
  }
});


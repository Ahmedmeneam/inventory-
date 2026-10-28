import { Router, type Request, type Response } from 'express';
import { db, sqlite } from '../db/index.ts';
import {
  warehouses,
  custodies,
  stockBalances,
  items,
  units,
  categories,
  movements,
  users,
  auditLogs,
} from '../db/schema.ts';
import { eq, and, or, desc, sql, sum, count } from 'drizzle-orm';
import { fromMilli, toMilli } from '../../utils/rules.ts';

export const warehousesRouter = Router();

// GET /api/warehouses - List all warehouses in the system with custody and stock stats
warehousesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { custodyId } = req.query;

    let baseQuery = db
      .select({
        id: warehouses.id,
        name: warehouses.name,
        custody_id: warehouses.custodyId,
        is_main: warehouses.isMain,
        is_general: warehouses.isGeneral,
        status: warehouses.status,
        created_at: warehouses.createdAt,
        custody_name: custodies.name,
        custody_code: custodies.code,
      })
      .from(warehouses)
      .leftJoin(custodies, eq(warehouses.custodyId, custodies.id));

    let allWarehouses = baseQuery.all();

    if (custodyId && custodyId !== 'all') {
      const cId = Number(custodyId);
      // Include custody warehouses AND general warehouses
      allWarehouses = allWarehouses.filter(
        (w) => w.custody_id === cId || w.is_general
      );
    }

    // Attach aggregated stock stats for each warehouse
    const result = allWarehouses.map((wh) => {
      const balances = db
        .select({
          distinctItems: count(stockBalances.itemId),
          totalQtyMilli: sum(stockBalances.quantityMilli),
          totalReservedMilli: sum(stockBalances.reservedQtyMilli),
        })
        .from(stockBalances)
        .where(eq(stockBalances.warehouseId, wh.id))
        .get();

      const totalQty = fromMilli(Number(balances?.totalQtyMilli || 0));
      const totalReserved = fromMilli(Number(balances?.totalReservedMilli || 0));
      const totalAvailable = Math.max(0, totalQty - totalReserved);

      return {
        ...wh,
        items_count: Number(balances?.distinctItems || 0),
        total_quantity: totalQty,
        total_reserved: totalReserved,
        total_available: totalAvailable,
      };
    });

    res.json({ warehouses: result });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ error: 'خطأ في جلب بيانات المخازن' });
  }
});

// GET /api/warehouses/:id - Single warehouse details
warehousesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const warehouseId = Number(req.params.id);

    const warehouse = db
      .select({
        id: warehouses.id,
        name: warehouses.name,
        custody_id: warehouses.custodyId,
        is_main: warehouses.isMain,
        is_general: warehouses.isGeneral,
        status: warehouses.status,
        created_at: warehouses.createdAt,
        custody_name: custodies.name,
        custody_code: custodies.code,
      })
      .from(warehouses)
      .leftJoin(custodies, eq(warehouses.custodyId, custodies.id))
      .where(eq(warehouses.id, warehouseId))
      .get();

    if (!warehouse) {
      res.status(404).json({ error: 'المخزن غير موجود' });
      return;
    }

    res.json({ warehouse });
  } catch (error) {
    console.error('Error fetching warehouse details:', error);
    res.status(500).json({ error: 'فشل جلب تفاصيل المخزن' });
  }
});

// GET /api/warehouses/:id/balances - Stock balances for a specific warehouse
warehousesRouter.get('/:id/balances', async (req: Request, res: Response) => {
  try {
    const warehouseId = Number(req.params.id);

    const rows = db
      .select({
        item_id: items.id,
        item_code: items.itemCode,
        item_name: items.name,
        category_name: categories.name,
        unit_name: units.name,
        unit_symbol: units.symbol,
        min_limit_milli: items.minLimitMilli,
        quantity_milli: stockBalances.quantityMilli,
        reserved_qty_milli: stockBalances.reservedQtyMilli,
      })
      .from(stockBalances)
      .innerJoin(items, eq(stockBalances.itemId, items.id))
      .leftJoin(categories, eq(items.categoryId, categories.id))
      .leftJoin(units, eq(items.unitId, units.id))
      .where(eq(stockBalances.warehouseId, warehouseId))
      .all();

    const result = rows.map((r) => {
      const qty = fromMilli(r.quantity_milli);
      const resv = fromMilli(r.reserved_qty_milli);
      const avail = Math.max(0, qty - resv);
      const minLimit = fromMilli(r.min_limit_milli);

      return {
        item_id: r.item_id,
        item_code: r.item_code,
        item_name: r.item_name,
        category_name: r.category_name || 'عام',
        unit_name: r.unit_name,
        unit_symbol: r.unit_symbol,
        quantity: qty,
        reserved_qty: resv,
        available_qty: avail,
        min_limit: minLimit,
        is_low_stock: qty <= minLimit,
      };
    });

    res.json({ balances: result });
  } catch (error) {
    console.error('Error fetching warehouse balances:', error);
    res.status(500).json({ error: 'فشل جلب أرصدة المخزن' });
  }
});

// GET /api/warehouses/:id/movements - Movement ledger entries for a specific warehouse
warehousesRouter.get('/:id/movements', async (req: Request, res: Response) => {
  try {
    const warehouseId = Number(req.params.id);

    const list = db
      .select({
        id: movements.id,
        trx_number: movements.trxNumber,
        movement_type: movements.movementType,
        status: movements.status,
        source_warehouse_id: movements.sourceWarehouseId,
        target_warehouse_id: movements.targetWarehouseId,
        item_id: movements.itemId,
        item_name: items.name,
        item_code: items.itemCode,
        unit_name: units.name,
        unit_symbol: units.symbol,
        quantity_milli: movements.quantityMilli,
        notes: movements.notes,
        created_at: movements.createdAt,
        creator_name: users.fullName,
        creator_code: users.userCode,
      })
      .from(movements)
      .leftJoin(items, eq(movements.itemId, items.id))
      .leftJoin(units, eq(items.unitId, units.id))
      .leftJoin(users, eq(movements.createdBy, users.id))
      .where(
        or(
          eq(movements.sourceWarehouseId, warehouseId),
          eq(movements.targetWarehouseId, warehouseId)
        )
      )
      .orderBy(desc(movements.id))
      .all();

    // Map warehouse names
    const allWhs = db.select().from(warehouses).all();
    const whMap = new Map(allWhs.map((w) => [w.id, w.name]));

    const result = list.map((m) => {
      const isIncoming = m.target_warehouse_id === warehouseId;
      const isOutgoing = m.source_warehouse_id === warehouseId;
      const qty = fromMilli(m.quantity_milli);

      return {
        ...m,
        quantity: qty,
        direction: isIncoming ? 'in' : isOutgoing ? 'out' : 'neutral',
        source_warehouse_name: m.source_warehouse_id ? whMap.get(m.source_warehouse_id) || '-' : '-',
        target_warehouse_name: m.target_warehouse_id ? whMap.get(m.target_warehouse_id) || '-' : '-',
      };
    });

    res.json({ movements: result });
  } catch (error) {
    console.error('Error fetching warehouse movements:', error);
    res.status(500).json({ error: 'فشل جلب حركات المخزن' });
  }
});

import { Router, type Request, type Response } from 'express';
import { db, sqlite } from '../db/index.ts';
import {
  movements,
  stockBalances,
  warehouses,
  custodies,
  items,
  units,
  categories,
  users,
  auditLogs,
} from '../db/schema.ts';
import { eq, and, desc, asc, sql, sum, not, inArray } from 'drizzle-orm';
import { fromMilli, toMilli, formatTrxNumber, getFiscalYear } from '../../utils/rules.ts';

export const ledgerRouter = Router();

// =================== GENERAL APPEND-ONLY LEDGER ===================

// GET /api/ledger - Comprehensive immutable movements ledger with full filters
ledgerRouter.get('/', async (req: Request, res: Response) => {
  try {
    const {
      custodyId,
      itemId,
      movementType,
      status,
      warehouseId,
      fromDate,
      toDate,
      search,
    } = req.query;

    const allMovements = db
      .select({
        id: movements.id,
        trx_number: movements.trxNumber,
        custody_id: movements.custodyId,
        custody_name: custodies.name,
        custody_code: custodies.code,
        movement_type: movements.movementType,
        status: movements.status,
        source_warehouse_id: movements.sourceWarehouseId,
        target_warehouse_id: movements.targetWarehouseId,
        item_id: movements.itemId,
        item_name: items.name,
        item_code: items.itemCode,
        category_name: categories.name,
        unit_name: units.name,
        unit_symbol: units.symbol,
        quantity_milli: movements.quantityMilli,
        notes: movements.notes,
        created_by: movements.createdBy,
        creator_name: users.fullName,
        creator_code: users.userCode,
        created_at: movements.createdAt,
        approved_by: movements.approvedBy,
        approved_at: movements.approvedAt,
        rejection_reason: movements.rejectionReason,
        reversal_of_id: movements.reversalOfId,
      })
      .from(movements)
      .leftJoin(custodies, eq(movements.custodyId, custodies.id))
      .leftJoin(items, eq(movements.itemId, items.id))
      .leftJoin(categories, eq(items.categoryId, categories.id))
      .leftJoin(units, eq(items.unitId, units.id))
      .leftJoin(users, eq(movements.createdBy, users.id))
      .orderBy(desc(movements.id))
      .all();

    // Fetch warehouse names map
    const allWarehouses = db.select().from(warehouses).all();
    const warehouseMap = new Map(allWarehouses.map((w) => [w.id, w.name]));

    // Fetch approver names map
    const allUsers = db.select().from(users).all();
    const userMap = new Map(allUsers.map((u) => [u.id, `${u.fullName} (${u.userCode})`]));

    // Fetch TRX map for reversals
    const trxMap = new Map(allMovements.map((m) => [m.id, m.trx_number]));

    let filtered = allMovements.map((m) => ({
      ...m,
      quantity: fromMilli(m.quantity_milli),
      source_warehouse_name: m.source_warehouse_id ? warehouseMap.get(m.source_warehouse_id) || '-' : '-',
      target_warehouse_name: m.target_warehouse_id ? warehouseMap.get(m.target_warehouse_id) || '-' : '-',
      approver_name: m.approved_by ? userMap.get(m.approved_by) || '-' : '-',
      reversal_of_trx: m.reversal_of_id ? trxMap.get(m.reversal_of_id) || `TRX-#${m.reversal_of_id}` : null,
      category_name: m.category_name || 'بدون تصنيف',
    }));

    // Apply filters
    if (custodyId && custodyId !== 'all') {
      const cId = Number(custodyId);
      filtered = filtered.filter((m) => m.custody_id === cId);
    }

    if (itemId && itemId !== 'all') {
      const iId = Number(itemId);
      filtered = filtered.filter((m) => m.item_id === iId);
    }

    if (movementType && movementType !== 'all') {
      filtered = filtered.filter((m) => m.movement_type === movementType);
    }

    if (status && status !== 'all') {
      filtered = filtered.filter((m) => m.status === status);
    }

    if (warehouseId && warehouseId !== 'all') {
      const wId = Number(warehouseId);
      filtered = filtered.filter(
        (m) => m.source_warehouse_id === wId || m.target_warehouse_id === wId
      );
    }

    if (fromDate) {
      filtered = filtered.filter((m) => m.created_at >= String(fromDate));
    }

    if (toDate) {
      const toDateEnd = `${String(toDate)}T23:59:59.999Z`;
      filtered = filtered.filter((m) => m.created_at <= toDateEnd);
    }

    if (search) {
      const q = String(search).trim().toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.trx_number?.toLowerCase().includes(q) ||
          m.item_name?.toLowerCase().includes(q) ||
          m.item_code?.toLowerCase().includes(q) ||
          m.custody_name?.toLowerCase().includes(q) ||
          m.creator_name?.toLowerCase().includes(q)
      );
    }

    res.json({
      success: true,
      count: filtered.length,
      movements: filtered,
    });
  } catch (error) {
    console.error('Error fetching general ledger:', error);
    res.status(500).json({ error: 'خطأ في جلب بيانات السجل العام للعمليات' });
  }
});

// =================== ITEM ACCOUNT STATEMENT & DISTRIBUTION ===================

// GET /api/ledger/item-statement/:itemId - Detailed item ledger and warehouse breakdown
ledgerRouter.get('/item-statement/:itemId', async (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.itemId);
    const { custodyId } = req.query;

    const item = db
      .select({
        id: items.id,
        item_code: items.itemCode,
        name: items.name,
        category_id: items.categoryId,
        category_name: categories.name,
        unit_id: items.unitId,
        unit_name: units.name,
        unit_symbol: units.symbol,
        min_limit_milli: items.minLimitMilli,
        created_at: items.createdAt,
      })
      .from(items)
      .leftJoin(categories, eq(items.categoryId, categories.id))
      .leftJoin(units, eq(items.unitId, units.id))
      .where(eq(items.id, itemId))
      .get();

    if (!item) {
      res.status(404).json({ error: 'الصنف غير موجود' });
      return;
    }

    // 1. Fetch stock balances across all warehouses
    let balancesQuery = db
      .select({
        custody_id: stockBalances.custodyId,
        warehouse_id: stockBalances.warehouseId,
        item_id: stockBalances.itemId,
        quantity_milli: stockBalances.quantityMilli,
        reserved_qty_milli: stockBalances.reservedQtyMilli,
        warehouse_name: warehouses.name,
        is_main: warehouses.isMain,
        is_general: warehouses.isGeneral,
        custody_name: custodies.name,
        custody_code: custodies.code,
      })
      .from(stockBalances)
      .innerJoin(warehouses, eq(stockBalances.warehouseId, warehouses.id))
      .innerJoin(custodies, eq(stockBalances.custodyId, custodies.id))
      .where(eq(stockBalances.itemId, itemId));

    if (custodyId && custodyId !== 'all') {
      balancesQuery = db
        .select({
          custody_id: stockBalances.custodyId,
          warehouse_id: stockBalances.warehouseId,
          item_id: stockBalances.itemId,
          quantity_milli: stockBalances.quantityMilli,
          reserved_qty_milli: stockBalances.reservedQtyMilli,
          warehouse_name: warehouses.name,
          is_main: warehouses.isMain,
          is_general: warehouses.isGeneral,
          custody_name: custodies.name,
          custody_code: custodies.code,
        })
        .from(stockBalances)
        .innerJoin(warehouses, eq(stockBalances.warehouseId, warehouses.id))
        .innerJoin(custodies, eq(stockBalances.custodyId, custodies.id))
        .where(
          and(
            eq(stockBalances.itemId, itemId),
            eq(stockBalances.custodyId, Number(custodyId))
          )
        );
    }

    const balances = balancesQuery.all();

    let totalQuantityMilli = 0;
    let totalReservedMilli = 0;

    const warehouseBreakdown = balances.map((b) => {
      totalQuantityMilli += b.quantity_milli;
      totalReservedMilli += b.reserved_qty_milli;

      return {
        custody_id: b.custody_id,
        custody_name: b.custody_name,
        custody_code: b.custody_code,
        warehouse_id: b.warehouse_id,
        warehouse_name: b.warehouse_name,
        warehouse_type: b.is_main ? 'رئيسي' : b.is_general ? 'عام للشركة' : 'فرعي',
        is_main: b.is_main,
        is_general: b.is_general,
        quantity: fromMilli(b.quantity_milli),
        reserved_qty: fromMilli(b.reserved_qty_milli),
        available_qty: fromMilli(Math.max(0, b.quantity_milli - b.reserved_qty_milli)),
      };
    });

    // 2. Fetch chronological movement history for this item (Ascending for running balance)
    let mQuery = db
      .select({
        id: movements.id,
        trx_number: movements.trxNumber,
        custody_id: movements.custodyId,
        custody_name: custodies.name,
        movement_type: movements.movementType,
        status: movements.status,
        source_warehouse_id: movements.sourceWarehouseId,
        target_warehouse_id: movements.targetWarehouseId,
        quantity_milli: movements.quantityMilli,
        created_at: movements.createdAt,
        notes: movements.notes,
        created_by: movements.createdBy,
        creator_name: users.fullName,
        reversal_of_id: movements.reversalOfId,
      })
      .from(movements)
      .leftJoin(custodies, eq(movements.custodyId, custodies.id))
      .leftJoin(users, eq(movements.createdBy, users.id))
      .where(
        and(
          eq(movements.itemId, itemId),
          inArray(movements.status, ['executed', 'executed_delegated', 'approved', 'reversed'])
        )
      )
      .orderBy(asc(movements.id))
      .all();

    if (custodyId && custodyId !== 'all') {
      mQuery = mQuery.filter((m) => m.custody_id === Number(custodyId));
    }

    const allWarehouses = db.select().from(warehouses).all();
    const warehouseMap = new Map(allWarehouses.map((w) => [w.id, w.name]));

    // Compute running company balance chronologically
    let runningMilli = 0;
    const history = mQuery.map((m) => {
      let impactMilli = 0;
      let impactType: 'in' | 'out' | 'transfer' = 'transfer';

      if (m.movement_type === 'addition') {
        impactMilli = m.quantity_milli;
        impactType = 'in';
      } else if (m.movement_type === 'issue' || m.movement_type === 'disposal') {
        impactMilli = -m.quantity_milli;
        impactType = 'out';
      } else if (m.movement_type === 'reversal') {
        // Reversal impact depends on what was reversed, checked mathematically
        impactMilli = m.quantity_milli; // signed appropriately when executed
        impactType = m.quantity_milli >= 0 ? 'in' : 'out';
      } else if (m.movement_type === 'adjustment') {
        impactMilli = m.quantity_milli;
        impactType = m.quantity_milli >= 0 ? 'in' : 'out';
      }

      // If reversed, note that this movement's effect was undone
      if (m.status !== 'reversed') {
        runningMilli += impactMilli;
      }

      return {
        id: m.id,
        trx_number: m.trx_number,
        date: m.created_at,
        movement_type: m.movement_type,
        status: m.status,
        custody_name: m.custody_name,
        source_warehouse: m.source_warehouse_id ? warehouseMap.get(m.source_warehouse_id) : '-',
        target_warehouse: m.target_warehouse_id ? warehouseMap.get(m.target_warehouse_id) : '-',
        quantity: fromMilli(m.quantity_milli),
        impact_type: impactType,
        running_balance: fromMilli(runningMilli),
        creator_name: m.creator_name || '-',
        notes: m.notes || '-',
      };
    });

    res.json({
      success: true,
      item: {
        ...item,
        category_name: item.category_name || 'بدون تصنيف',
        min_limit: fromMilli(item.min_limit_milli),
        total_quantity: fromMilli(totalQuantityMilli),
        total_reserved: fromMilli(totalReservedMilli),
        total_available: fromMilli(Math.max(0, totalQuantityMilli - totalReservedMilli)),
      },
      warehouse_breakdown: warehouseBreakdown,
      statement_history: history.reverse(), // display newest on top in UI
    });
  } catch (error) {
    console.error('Error fetching item statement:', error);
    res.status(500).json({ error: 'خطأ في جلب كشف حساب الصنف' });
  }
});

// =================== MOVEMENT REVERSAL ENGINE ===================

// POST /api/movements/:id/reverse - Strict full reversal with free stock verification
ledgerRouter.post('/:id/reverse', async (req: Request, res: Response) => {
  try {
    const movementId = Number(req.params.id);
    const { reason, userId, userRole } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ error: 'يرجى تسجيل سبب إلغاء/عكس الحركة كتابياً' });
      return;
    }

    // Role check: Only Department Head (supervisor) or Admin can execute reversals
    if (userRole && userRole !== 'supervisor' && userRole !== 'admin') {
      res.status(403).json({ error: 'صلاحية الحركات العكسية محصورة برئيس القسم ومسؤول النظام فقط' });
      return;
    }

    const orig = db.select().from(movements).where(eq(movements.id, movementId)).get();
    if (!orig) {
      res.status(404).json({ error: 'الحركة المراد عكسها غير موجودة' });
      return;
    }

    // Cannot reverse a cancelled or rejected movement
    if (orig.status === 'rejected' || orig.status === 'cancelled') {
      res.status(400).json({ error: 'لا يمكن عكس حركة ملغاة أو مرفوضة بالفعل' });
      return;
    }

    // Cannot reverse already reversed movement
    if (orig.status === 'reversed') {
      res.status(400).json({ error: 'هذه الحركة تم عكسها مسبقاً ولا يمكن عكسها مرة أخرى' });
      return;
    }

    // Cannot reverse a reversal movement
    if (orig.movementType === 'reversal') {
      res.status(400).json({ error: 'لا يمكن عكس حركة عكسية' });
      return;
    }

    // Cannot reverse a pending movement
    if (orig.status === 'pending_approval') {
      res.status(400).json({ error: 'الحركة لا تزال معلقة؛ يمكنك رفضها مباشرة من تبويب الطلبات المعلقة' });
      return;
    }

    const now = new Date();
    const fiscalYear = getFiscalYear(now);

    // Atomic transaction for reversible changes
    const transaction = sqlite.transaction(() => {
      // 1. Check free stock according to mathematical effect of the original movement
      if (orig.movementType === 'addition') {
        // Original addition added quantity to target warehouse -> Reversal must SUBTRACT from target warehouse
        if (!orig.targetWarehouseId) {
          throw new Error('بيانات المخزن المستهدف للحركة الأصلية غير مكتملة');
        }

        const bal = db
          .select()
          .from(stockBalances)
          .where(
            and(
              eq(stockBalances.custodyId, orig.custodyId),
              eq(stockBalances.warehouseId, orig.targetWarehouseId),
              eq(stockBalances.itemId, orig.itemId)
            )
          )
          .get();

        const currentQty = bal?.quantityMilli || 0;
        const reservedQty = bal?.reservedQtyMilli || 0;
        const freeQty = currentQty - reservedQty;

        if (freeQty < orig.quantityMilli) {
          throw new Error(
            `لا يمكن عكس حركة الإضافة؛ الرصيد الحر المتاح في المخزن (${fromMilli(freeQty)}) غير كافٍ لسحب الكمية المعكوسة (${fromMilli(orig.quantityMilli)}).`
          );
        }

        // Deduct from stock_balances
        db.update(stockBalances)
          .set({ quantityMilli: currentQty - orig.quantityMilli })
          .where(
            and(
              eq(stockBalances.custodyId, orig.custodyId),
              eq(stockBalances.warehouseId, orig.targetWarehouseId),
              eq(stockBalances.itemId, orig.itemId)
            )
          )
          .run();
      } else if (orig.movementType === 'issue' || orig.movementType === 'disposal') {
        // Original issue/disposal subtracted quantity from source warehouse -> Reversal RESTORES it
        if (!orig.sourceWarehouseId) {
          throw new Error('بيانات المخزن المنصرف منه غير مكتملة');
        }

        const bal = db
          .select()
          .from(stockBalances)
          .where(
            and(
              eq(stockBalances.custodyId, orig.custodyId),
              eq(stockBalances.warehouseId, orig.sourceWarehouseId),
              eq(stockBalances.itemId, orig.itemId)
            )
          )
          .get();

        if (bal) {
          db.update(stockBalances)
            .set({ quantityMilli: bal.quantityMilli + orig.quantityMilli })
            .where(
              and(
                eq(stockBalances.custodyId, orig.custodyId),
                eq(stockBalances.warehouseId, orig.sourceWarehouseId),
                eq(stockBalances.itemId, orig.itemId)
              )
            )
            .run();
        } else {
          db.insert(stockBalances)
            .values({
              custodyId: orig.custodyId,
              warehouseId: orig.sourceWarehouseId,
              itemId: orig.itemId,
              quantityMilli: orig.quantityMilli,
              reservedQtyMilli: 0,
            })
            .run();
        }
      } else if (orig.movementType === 'internal_transfer') {
        // Original moved from sourceWarehouse -> targetWarehouse
        // Reversal must return from targetWarehouse -> sourceWarehouse
        if (!orig.sourceWarehouseId || !orig.targetWarehouseId) {
          throw new Error('بيانات مخازن التحويل غير مكتملة');
        }

        const targetBal = db
          .select()
          .from(stockBalances)
          .where(
            and(
              eq(stockBalances.custodyId, orig.custodyId),
              eq(stockBalances.warehouseId, orig.targetWarehouseId),
              eq(stockBalances.itemId, orig.itemId)
            )
          )
          .get();

        const targetFree = (targetBal?.quantityMilli || 0) - (targetBal?.reservedQtyMilli || 0);
        if (targetFree < orig.quantityMilli) {
          throw new Error(
            `لا يمكن عكس التحويل؛ الرصيد الحر المتاح في المخزن المحول إليه (${fromMilli(targetFree)}) غير كافٍ لإعادة الكمية (${fromMilli(orig.quantityMilli)}).`
          );
        }

        // Deduct from target
        db.update(stockBalances)
          .set({ quantityMilli: (targetBal?.quantityMilli || 0) - orig.quantityMilli })
          .where(
            and(
              eq(stockBalances.custodyId, orig.custodyId),
              eq(stockBalances.warehouseId, orig.targetWarehouseId),
              eq(stockBalances.itemId, orig.itemId)
            )
          )
          .run();

        // Restore to source
        const sourceBal = db
          .select()
          .from(stockBalances)
          .where(
            and(
              eq(stockBalances.custodyId, orig.custodyId),
              eq(stockBalances.warehouseId, orig.sourceWarehouseId),
              eq(stockBalances.itemId, orig.itemId)
            )
          )
          .get();

        if (sourceBal) {
          db.update(stockBalances)
            .set({ quantityMilli: sourceBal.quantityMilli + orig.quantityMilli })
            .where(
              and(
                eq(stockBalances.custodyId, orig.custodyId),
                eq(stockBalances.warehouseId, orig.sourceWarehouseId),
                eq(stockBalances.itemId, orig.itemId)
              )
            )
            .run();
        } else {
          db.insert(stockBalances)
            .values({
              custodyId: orig.custodyId,
              warehouseId: orig.sourceWarehouseId,
              itemId: orig.itemId,
              quantityMilli: orig.quantityMilli,
              reservedQtyMilli: 0,
            })
            .run();
        }
      }

      // 2. Generate new TRX number for reversal
      const allFyMovements = db
        .select({ id: movements.id })
        .from(movements)
        .all();
      const nextSeq = allFyMovements.length + 1;
      const reversalTrx = formatTrxNumber(nextSeq, now);

      // 3. Mark original movement as reversed
      db.update(movements)
        .set({
          status: 'reversed',
          rejectionReason: `تم العكس بالحركة ${reversalTrx} للسبب: ${reason.trim()}`,
        })
        .where(eq(movements.id, orig.id))
        .run();

      // 4. Insert new reversal movement record in append-only ledger
      const reversalRecord = db
        .insert(movements)
        .values({
          trxNumber: reversalTrx,
          custodyId: orig.custodyId,
          movementType: 'reversal',
          status: 'approved',
          sourceWarehouseId: orig.targetWarehouseId || null,
          targetWarehouseId: orig.sourceWarehouseId || null,
          itemId: orig.itemId,
          quantityMilli: orig.quantityMilli,
          notes: `حركة عكسية للحركة [${orig.trxNumber}]. السبب: ${reason.trim()}`,
          createdBy: userId ? Number(userId) : orig.createdBy,
          createdAt: now.toISOString(),
          approvedBy: userId ? Number(userId) : orig.createdBy,
          approvedAt: now.toISOString(),
          reversalOfId: orig.id,
        })
        .returning()
        .get();

      // 5. Audit Log
      db.insert(auditLogs)
        .values({
          userId: userId ? Number(userId) : null,
          userCode: userRole || 'SYSTEM',
          action: 'MOVEMENT_REVERSED',
          details: JSON.stringify({
            originalId: orig.id,
            originalTrx: orig.trxNumber,
            reversalId: reversalRecord.id,
            reversalTrx: reversalRecord.trxNumber,
            reason: reason.trim(),
          }),
          createdAt: now.toISOString(),
        })
        .run();

      return reversalRecord;
    });

    const result = transaction();

    res.json({
      success: true,
      message: `تم عكس الحركة بنجاح وإصدار القيد العكسي برقم ${result.trxNumber}`,
      reversal: result,
    });
  } catch (error: any) {
    console.error('Error reversing movement:', error);
    res.status(400).json({ error: error.message || 'فشل إجراء الحركة العكسية' });
  }
});

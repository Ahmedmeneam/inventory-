import { Router, Request, Response } from 'express';
import { db, sqlite } from '../db/index.ts';
import {
  movements,
  stockBalances,
  delegationRules,
  warehouses,
  custodies,
  items,
  units,
  users,
  auditLogs,
} from '../db/schema.ts';
import { eq, and, sql, desc, count } from 'drizzle-orm';
import { toMilli, fromMilli, formatTrxNumber, evaluateDelegationRule } from '../../utils/rules.ts';

export const movementsRouter = Router();

// =================== MOVEMENT TRANSACTIONS & NUMBERING ===================

function getNextTrxNumber(): string {
  const totalCount = db.select({ value: count() }).from(movements).get();
  const nextSeq = (totalCount?.value || 0) + 1;
  return formatTrxNumber(nextSeq);
}

// GET /api/custodies/:id/movements - List movements with joins
movementsRouter.get('/:id/movements', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { status, type } = req.query;

    let query = db
      .select({
        id: movements.id,
        trx_number: movements.trxNumber,
        custody_id: movements.custodyId,
        movement_type: movements.movementType,
        status: movements.status,
        source_warehouse_id: movements.sourceWarehouseId,
        target_warehouse_id: movements.targetWarehouseId,
        item_id: movements.itemId,
        quantity_milli: movements.quantityMilli,
        notes: movements.notes,
        created_by: movements.createdBy,
        created_at: movements.createdAt,
        approved_by: movements.approvedBy,
        approved_at: movements.approvedAt,
        rejection_reason: movements.rejectionReason,
        item_name: items.name,
        item_code: items.itemCode,
        unit_name: units.name,
        unit_symbol: units.symbol,
        creator_name: users.fullName,
        creator_code: users.userCode,
      })
      .from(movements)
      .leftJoin(items, eq(movements.itemId, items.id))
      .leftJoin(units, eq(items.unitId, units.id))
      .leftJoin(users, eq(movements.createdBy, users.id))
      .where(eq(movements.custodyId, custodyId))
      .orderBy(desc(movements.id));

    const all = query.all();

    // Map warehouse names
    const allWarehouses = db.select().from(warehouses).where(eq(warehouses.custodyId, custodyId)).all();
    const whMap = new Map(allWarehouses.map((w) => [w.id, w.name]));

    let filtered = all.map((m) => ({
      ...m,
      quantity: fromMilli(m.quantity_milli),
      source_warehouse_name: m.source_warehouse_id ? whMap.get(m.source_warehouse_id) || 'مخزن' : null,
      target_warehouse_name: m.target_warehouse_id ? whMap.get(m.target_warehouse_id) || 'مخزن' : null,
    }));

    if (status) {
      filtered = filtered.filter((m) => m.status === status);
    }
    if (type) {
      filtered = filtered.filter((m) => m.movement_type === type);
    }

    res.json({ movements: filtered });
  } catch (error) {
    console.error('Error fetching movements:', error);
    res.status(500).json({ error: 'خطأ في جلب حركات المخزون' });
  }
});

// =================== DELEGATION CHECK & RULES ===================

// Helper: Calculate today's consumed delegated quantity dynamically
export function getTodayConsumedMilli(custodyId: number, warehouseId: number, itemId: number): number {
  // Today in local date format YYYY-MM-DD
  const todayStr = new Date().toISOString().slice(0, 10);

  const result = db
    .select({
      total: sql<number>`sum(${movements.quantityMilli})`,
    })
    .from(movements)
    .where(
      and(
        eq(movements.custodyId, custodyId),
        eq(movements.sourceWarehouseId, warehouseId),
        eq(movements.itemId, itemId),
        eq(movements.movementType, 'issue'),
        eq(movements.status, 'executed_delegated'),
        sql`date(${movements.createdAt}) = ${todayStr}`
      )
    )
    .get();

  return Number(result?.total || 0);
}

// POST /api/custodies/:id/delegation-check - Real-time badge preview for Issue form
movementsRouter.post('/:id/delegation-check', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { itemId, warehouseId, quantity } = req.body;

    if (!itemId || !warehouseId || !quantity) {
      res.json({ isDelegated: false, badge: 'amber', badgeText: 'يرجى إدخال الكمية والمخزن والصنف' });
      return;
    }

    const requestedQtyMilli = toMilli(Number(quantity));

    // Find rule for this item and warehouse
    const rule = db
      .select()
      .from(delegationRules)
      .where(
        and(
          eq(delegationRules.custodyId, custodyId),
          eq(delegationRules.warehouseId, Number(warehouseId)),
          eq(delegationRules.itemId, Number(itemId)),
          eq(delegationRules.status, 'active')
        )
      )
      .get();

    if (!rule) {
      res.json({
        isDelegated: false,
        badge: 'amber',
        badgeText: 'سيتطلب موافقة رئيس القسم وحجز الرصيد (السبب: صنف غير مفوض في هذا المخزن)',
        reason: 'صنف غير مفوض',
      });
      return;
    }

    const todayConsumedMilli = getTodayConsumedMilli(custodyId, Number(warehouseId), Number(itemId));

    const check = evaluateDelegationRule({
      isDelegatedItem: true,
      requestedQtyMilli,
      maxQtyPerOpMilli: rule.maxQtyPerOpMilli,
      dailyLimitMilli: rule.dailyLimitMilli,
      todayConsumedMilli,
    });

    res.json({
      ...check,
      max_qty_per_op: fromMilli(rule.maxQtyPerOpMilli),
      daily_limit: fromMilli(rule.dailyLimitMilli),
      today_consumed: fromMilli(todayConsumedMilli),
      remaining_today: fromMilli(check.remainingTodayMilli),
    });
  } catch (error) {
    console.error('Error checking delegation:', error);
    res.status(500).json({ error: 'خطأ في فحص صلاحية التفويض' });
  }
});

// GET /api/custodies/:id/delegation-rules - List delegation rules with live daily consumption
movementsRouter.get('/:id/delegation-rules', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);

    const rules = db
      .select({
        id: delegationRules.id,
        custody_id: delegationRules.custodyId,
        warehouse_id: delegationRules.warehouseId,
        item_id: delegationRules.itemId,
        max_qty_per_op_milli: delegationRules.maxQtyPerOpMilli,
        daily_limit_milli: delegationRules.dailyLimitMilli,
        status: delegationRules.status,
        created_at: delegationRules.createdAt,
        warehouse_name: warehouses.name,
        item_name: items.name,
        item_code: items.itemCode,
        unit_name: units.name,
        unit_symbol: units.symbol,
      })
      .from(delegationRules)
      .leftJoin(warehouses, eq(delegationRules.warehouseId, warehouses.id))
      .leftJoin(items, eq(delegationRules.itemId, items.id))
      .leftJoin(units, eq(items.unitId, units.id))
      .where(eq(delegationRules.custodyId, custodyId))
      .all();

    const withComputed = rules.map((r) => {
      const todayConsumedMilli = getTodayConsumedMilli(custodyId, r.warehouse_id, r.item_id);
      const remainingTodayMilli = Math.max(0, r.daily_limit_milli - todayConsumedMilli);

      return {
        ...r,
        max_qty_per_op: fromMilli(r.max_qty_per_op_milli),
        daily_limit: fromMilli(r.daily_limit_milli),
        today_consumed: fromMilli(todayConsumedMilli),
        remaining_today: fromMilli(remainingTodayMilli),
      };
    });

    res.json({ rules: withComputed });
  } catch (error) {
    console.error('Error fetching delegation rules:', error);
    res.status(500).json({ error: 'خطأ في جلب قواعد التفويض' });
  }
});

// POST /api/custodies/:id/delegation-rules - Add or update rule (Supervisor)
movementsRouter.post('/:id/delegation-rules', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { warehouseId, itemId, maxQtyPerOp, dailyLimit } = req.body;

    if (!warehouseId || !itemId || !maxQtyPerOp || !dailyLimit) {
      res.status(400).json({ error: 'يرجى استكمال جميع بيانات قاعدة التفويض' });
      return;
    }

    const maxQtyPerOpMilli = toMilli(Number(maxQtyPerOp));
    const dailyLimitMilli = toMilli(Number(dailyLimit));

    if (maxQtyPerOpMilli <= 0 || dailyLimitMilli <= 0) {
      res.status(400).json({ error: 'الحدود يجب أن تكون أرقاماً موجبة أكبر من صفر' });
      return;
    }

    if (maxQtyPerOpMilli > dailyLimitMilli) {
      res.status(400).json({ error: 'حد العملية الواحدة لا يمكن أن يتجاوز السقف التراكمي اليومي' });
      return;
    }

    // Check if rule already exists for this custody, warehouse, and item
    const existing = db
      .select()
      .from(delegationRules)
      .where(
        and(
          eq(delegationRules.custodyId, custodyId),
          eq(delegationRules.warehouseId, Number(warehouseId)),
          eq(delegationRules.itemId, Number(itemId))
        )
      )
      .get();

    if (existing) {
      db.update(delegationRules)
        .set({
          maxQtyPerOpMilli,
          dailyLimitMilli,
          status: 'active',
        })
        .where(eq(delegationRules.id, existing.id))
        .run();
    } else {
      db.insert(delegationRules)
        .values({
          custodyId,
          warehouseId: Number(warehouseId),
          itemId: Number(itemId),
          maxQtyPerOpMilli,
          dailyLimitMilli,
          status: 'active',
          createdAt: new Date().toISOString(),
        })
        .run();
    }

    res.json({ success: true, message: 'تم حفظ وتفعيل قاعدة التفويض بنجاح' });
  } catch (error) {
    console.error('Error saving delegation rule:', error);
    res.status(500).json({ error: 'فشل حفظ قاعدة التفويض' });
  }
});

// DELETE /api/custodies/:id/delegation-rules/:ruleId
movementsRouter.delete('/:id/delegation-rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const ruleId = Number(req.params.ruleId);
    db.delete(delegationRules).where(eq(delegationRules.id, ruleId)).run();
    res.json({ success: true, message: 'تم حذف قاعدة التفويض بنجاح' });
  } catch (error) {
    console.error('Error deleting delegation rule:', error);
    res.status(500).json({ error: 'فشل حذف قاعدة التفويض' });
  }
});

// =================== MOVEMENT EXECUTION ENDPOINTS ===================

// 1. ADDITION (وارد خارجي - حصر بالمخزن الرئيسي)
movementsRouter.post('/:id/movements/add', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { targetWarehouseId, itemId, quantity, notes, userId } = req.body;

    if (!targetWarehouseId || !itemId || !quantity) {
      res.status(400).json({ error: 'يرجى تحديد الصنف والمخزن والكمية' });
      return;
    }

    const qtyMilli = toMilli(Number(quantity));
    if (qtyMilli <= 0) {
      res.status(400).json({ error: 'كمية الوارد يجب أن تكون أكبر من صفر' });
      return;
    }

    // STRICT RULE: Target warehouse MUST be the Main Warehouse (is_main = true) of this custody
    const targetWh = db
      .select()
      .from(warehouses)
      .where(and(eq(warehouses.id, Number(targetWarehouseId)), eq(warehouses.custodyId, custodyId)))
      .get();

    if (!targetWh) {
      res.status(400).json({ error: 'المخزن المحدد غير موجود أو لا يتبع هذه العهدة' });
      return;
    }

    if (!targetWh.isMain) {
      res.status(400).json({
        error: 'مخالفة تشغيلية: حركات الوارد الخارجي (الإضافة) مقيدة حصرياً بالمخزن الرئيسي للعهدة فقط! للتخزين في المخازن الفرعية استخدم التحويل الداخلي.',
      });
      return;
    }

    if (targetWh.status === 'frozen') {
      res.status(400).json({ error: 'المخزن الرئيسي مجمد حالياً بسبب جلسة جرد نشطة' });
      return;
    }

    // Atomic transaction: create movement, update stock, lock initial import permanently
    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();
      const trxNumber = getNextTrxNumber();

      // 1. Insert Movement
      const newMovement = db
        .insert(movements)
        .values({
          trxNumber,
          custodyId,
          movementType: 'addition',
          status: 'executed',
          sourceWarehouseId: null,
          targetWarehouseId: targetWh.id,
          itemId: Number(itemId),
          quantityMilli: qtyMilli,
          notes: notes ? notes.trim() : null,
          createdBy: Number(userId) || 1,
          createdAt: now,
          approvedBy: Number(userId) || 1,
          approvedAt: now,
        })
        .returning()
        .get();

      // 2. Update stock balance
      const existingBalance = db
        .select()
        .from(stockBalances)
        .where(
          and(
            eq(stockBalances.custodyId, custodyId),
            eq(stockBalances.warehouseId, targetWh.id),
            eq(stockBalances.itemId, Number(itemId))
          )
        )
        .get();

      if (existingBalance) {
        db.update(stockBalances)
          .set({ quantityMilli: existingBalance.quantityMilli + qtyMilli })
          .where(
            and(
              eq(stockBalances.custodyId, custodyId),
              eq(stockBalances.warehouseId, targetWh.id),
              eq(stockBalances.itemId, Number(itemId))
            )
          )
          .run();
      } else {
        db.insert(stockBalances)
          .values({
            custodyId,
            warehouseId: targetWh.id,
            itemId: Number(itemId),
            quantityMilli: qtyMilli,
            reservedQtyMilli: 0,
          })
          .run();
      }

      // 3. Lock initial import permanently on first operational movement
      db.update(custodies)
        .set({ isInitialImportLocked: true })
        .where(eq(custodies.id, custodyId))
        .run();

      return newMovement;
    });

    const createdMovement = transaction();

    res.json({
      success: true,
      message: `تم تسجيل حركة الإضافة بنجاح برقم المعاملة ${createdMovement.trxNumber}`,
      movement: createdMovement,
    });
  } catch (error: any) {
    console.error('Error adding stock:', error);
    res.status(500).json({ error: error.message || 'فشلت عملية تسجيل الوارد' });
  }
});

// 2. ISSUE (خصم - مفوض فوري أو طلب معلق بحجز رصيد)
movementsRouter.post('/:id/movements/issue', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { sourceWarehouseId, itemId, quantity, notes, userId } = req.body;

    if (!sourceWarehouseId || !itemId || !quantity) {
      res.status(400).json({ error: 'يرجى تحديد الصنف والمخزن والكمية' });
      return;
    }

    const qtyMilli = toMilli(Number(quantity));
    if (qtyMilli <= 0) {
      res.status(400).json({ error: 'الكمية المطلوبة يجب أن تكون أكبر من صفر' });
      return;
    }

    const sourceWh = db.select().from(warehouses).where(eq(warehouses.id, Number(sourceWarehouseId))).get();
    if (!sourceWh || sourceWh.custodyId !== custodyId) {
      res.status(400).json({ error: 'المخزن المحدد غير صالح لهذه العهدة' });
      return;
    }

    if (sourceWh.status === 'frozen') {
      res.status(400).json({ error: 'المخزن مجمد حالياً بسبب جلسة جرد نشطة' });
      return;
    }

    // Check available free balance: (quantity - reserved) >= requested
    const balance = db
      .select()
      .from(stockBalances)
      .where(
        and(
          eq(stockBalances.custodyId, custodyId),
          eq(stockBalances.warehouseId, sourceWh.id),
          eq(stockBalances.itemId, Number(itemId))
        )
      )
      .get();

    const currentQtyMilli = balance?.quantityMilli || 0;
    const reservedMilli = balance?.reservedQtyMilli || 0;
    const freeMilli = currentQtyMilli - reservedMilli;

    if (freeMilli < qtyMilli) {
      res.status(400).json({
        error: `الرصيد المتاح غير كافٍ. الرصيد الحر المتاح: ${fromMilli(freeMilli)}، والمطلوب: ${fromMilli(qtyMilli)}`,
      });
      return;
    }

    // Evaluate delegation rule dynamically
    const rule = db
      .select()
      .from(delegationRules)
      .where(
        and(
          eq(delegationRules.custodyId, custodyId),
          eq(delegationRules.warehouseId, sourceWh.id),
          eq(delegationRules.itemId, Number(itemId)),
          eq(delegationRules.status, 'active')
        )
      )
      .get();

    const todayConsumedMilli = getTodayConsumedMilli(custodyId, sourceWh.id, Number(itemId));

    const check = evaluateDelegationRule({
      isDelegatedItem: !!rule,
      requestedQtyMilli: qtyMilli,
      maxQtyPerOpMilli: rule?.maxQtyPerOpMilli || 0,
      dailyLimitMilli: rule?.dailyLimitMilli || 0,
      todayConsumedMilli,
    });

    const isImmediateDelegated = check.isDelegated;
    const movementStatus = isImmediateDelegated ? 'executed_delegated' : 'pending_approval';

    // Atomic transaction
    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();
      const trxNumber = getNextTrxNumber();

      const newMovement = db
        .insert(movements)
        .values({
          trxNumber,
          custodyId,
          movementType: 'issue',
          status: movementStatus,
          sourceWarehouseId: sourceWh.id,
          targetWarehouseId: null,
          itemId: Number(itemId),
          quantityMilli: qtyMilli,
          notes: notes ? notes.trim() : null,
          createdBy: Number(userId) || 1,
          createdAt: now,
          approvedBy: isImmediateDelegated ? Number(userId) || 1 : null,
          approvedAt: isImmediateDelegated ? now : null,
        })
        .returning()
        .get();

      if (isImmediateDelegated) {
        // Path A: Immediate Deduction from Actual Quantity
        db.update(stockBalances)
          .set({ quantityMilli: currentQtyMilli - qtyMilli })
          .where(
            and(
              eq(stockBalances.custodyId, custodyId),
              eq(stockBalances.warehouseId, sourceWh.id),
              eq(stockBalances.itemId, Number(itemId))
            )
          )
          .run();
      } else {
        // Path B: Reserve Stock immediately without deducting actual quantity
        db.update(stockBalances)
          .set({ reservedQtyMilli: reservedMilli + qtyMilli })
          .where(
            and(
              eq(stockBalances.custodyId, custodyId),
              eq(stockBalances.warehouseId, sourceWh.id),
              eq(stockBalances.itemId, Number(itemId))
            )
          )
          .run();
      }

      // Lock initial import permanently
      db.update(custodies)
        .set({ isInitialImportLocked: true })
        .where(eq(custodies.id, custodyId))
        .run();

      return { movement: newMovement, isImmediateDelegated, check };
    });

    const result = transaction();

    res.json({
      success: true,
      isImmediateDelegated: result.isImmediateDelegated,
      message: result.isImmediateDelegated
        ? `تم تنفيذ الخصم المفوض فورياً برقم ${result.movement.trxNumber}`
        : `تم رفع طلب الخصم برقم ${result.movement.trxNumber} وحجز الكمية لحين موافقة رئيس القسم`,
      movement: result.movement,
    });
  } catch (error: any) {
    console.error('Error executing issue:', error);
    res.status(500).json({ error: error.message || 'فشلت عملية تسجيل الخصم' });
  }
});

// 3. INTERNAL TRANSFER (تحويل داخلي ذري بين مخازن نفس العهدة)
movementsRouter.post('/:id/movements/transfer', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { sourceWarehouseId, targetWarehouseId, itemId, quantity, notes, userId } = req.body;

    if (!sourceWarehouseId || !targetWarehouseId || !itemId || !quantity) {
      res.status(400).json({ error: 'يرجى استكمال بيانات التحويل الداخلي' });
      return;
    }

    if (Number(sourceWarehouseId) === Number(targetWarehouseId)) {
      res.status(400).json({ error: 'المخزن المصدر والمخزن الهدف متطابقان، لا يمكن التحويل لنفس المخزن' });
      return;
    }

    const qtyMilli = toMilli(Number(quantity));
    if (qtyMilli <= 0) {
      res.status(400).json({ error: 'كمية التحويل يجب أن تكون أكبر من صفر' });
      return;
    }

    // STRICT RULE: Both warehouses must belong to the exact same custody!
    const sourceWh = db.select().from(warehouses).where(eq(warehouses.id, Number(sourceWarehouseId))).get();
    const targetWh = db.select().from(warehouses).where(eq(warehouses.id, Number(targetWarehouseId))).get();

    if (!sourceWh || !targetWh || sourceWh.custodyId !== custodyId || targetWh.custodyId !== custodyId) {
      res.status(400).json({ error: 'التحويل الداخلي محصور حصرياً بين مخازن نفس العهدة' });
      return;
    }

    if (sourceWh.status === 'frozen' || targetWh.status === 'frozen') {
      res.status(400).json({ error: 'أحد المخازن المحددة مجمد حالياً بسبب جلسة جرد نشطة' });
      return;
    }

    // Check available free balance in source warehouse
    const sourceBal = db
      .select()
      .from(stockBalances)
      .where(
        and(
          eq(stockBalances.custodyId, custodyId),
          eq(stockBalances.warehouseId, sourceWh.id),
          eq(stockBalances.itemId, Number(itemId))
        )
      )
      .get();

    const currentQtyMilli = sourceBal?.quantityMilli || 0;
    const reservedMilli = sourceBal?.reservedQtyMilli || 0;
    const freeMilli = currentQtyMilli - reservedMilli;

    if (freeMilli < qtyMilli) {
      res.status(400).json({
        error: `الرصيد المتاح في مخزن المصدر غير كافٍ. المتاح: ${fromMilli(freeMilli)}، والمطلوب: ${fromMilli(qtyMilli)}`,
      });
      return;
    }

    // Atomic Transfer Transaction
    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();
      const trxNumber = getNextTrxNumber();

      // 1. Create movement (executed immediately by storekeeper)
      const newMovement = db
        .insert(movements)
        .values({
          trxNumber,
          custodyId,
          movementType: 'internal_transfer',
          status: 'executed',
          sourceWarehouseId: sourceWh.id,
          targetWarehouseId: targetWh.id,
          itemId: Number(itemId),
          quantityMilli: qtyMilli,
          notes: notes ? notes.trim() : null,
          createdBy: Number(userId) || 1,
          createdAt: now,
          approvedBy: Number(userId) || 1,
          approvedAt: now,
        })
        .returning()
        .get();

      // 2. Decrement source warehouse
      db.update(stockBalances)
        .set({ quantityMilli: currentQtyMilli - qtyMilli })
        .where(
          and(
            eq(stockBalances.custodyId, custodyId),
            eq(stockBalances.warehouseId, sourceWh.id),
            eq(stockBalances.itemId, Number(itemId))
          )
        )
        .run();

      // 3. Increment target warehouse
      const targetBal = db
        .select()
        .from(stockBalances)
        .where(
          and(
            eq(stockBalances.custodyId, custodyId),
            eq(stockBalances.warehouseId, targetWh.id),
            eq(stockBalances.itemId, Number(itemId))
          )
        )
        .get();

      if (targetBal) {
        db.update(stockBalances)
          .set({ quantityMilli: targetBal.quantityMilli + qtyMilli })
          .where(
            and(
              eq(stockBalances.custodyId, custodyId),
              eq(stockBalances.warehouseId, targetWh.id),
              eq(stockBalances.itemId, Number(itemId))
            )
          )
          .run();
      } else {
        db.insert(stockBalances)
          .values({
            custodyId,
            warehouseId: targetWh.id,
            itemId: Number(itemId),
            quantityMilli: qtyMilli,
            reservedQtyMilli: 0,
          })
          .run();
      }

      // Lock initial import
      db.update(custodies)
        .set({ isInitialImportLocked: true })
        .where(eq(custodies.id, custodyId))
        .run();

      return newMovement;
    });

    const result = transaction();

    res.json({
      success: true,
      message: `تم تنفيذ التحويل الداخلي بنجاح برقم ${result.trxNumber}`,
      movement: result,
    });
  } catch (error: any) {
    console.error('Error executing transfer:', error);
    res.status(500).json({ error: error.message || 'فشلت عملية التحويل الداخلي' });
  }
});

// 4. DISPOSAL (خروج نهائي - إتلاف / تكهين)
movementsRouter.post('/:id/movements/disposal', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { sourceWarehouseId, itemId, quantity, notes, userId } = req.body;

    if (!sourceWarehouseId || !itemId || !quantity) {
      res.status(400).json({ error: 'يرجى تحديد الصنف والمخزن والكمية' });
      return;
    }

    const qtyMilli = toMilli(Number(quantity));
    if (qtyMilli <= 0) {
      res.status(400).json({ error: 'الكمية المطلوبة يجب أن تكون أكبر من صفر' });
      return;
    }

    const sourceWh = db.select().from(warehouses).where(eq(warehouses.id, Number(sourceWarehouseId))).get();
    if (!sourceWh || sourceWh.custodyId !== custodyId) {
      res.status(400).json({ error: 'المخزن غير صالح' });
      return;
    }

    if (sourceWh.status === 'frozen') {
      res.status(400).json({ error: 'المخزن مجمد حالياً' });
      return;
    }

    const bal = db
      .select()
      .from(stockBalances)
      .where(
        and(
          eq(stockBalances.custodyId, custodyId),
          eq(stockBalances.warehouseId, sourceWh.id),
          eq(stockBalances.itemId, Number(itemId))
        )
      )
      .get();

    const currentQtyMilli = bal?.quantityMilli || 0;
    const reservedMilli = bal?.reservedQtyMilli || 0;
    const freeMilli = currentQtyMilli - reservedMilli;

    if (freeMilli < qtyMilli) {
      res.status(400).json({ error: `الرصيد المتاح غير كافٍ. المتاح: ${fromMilli(freeMilli)}` });
      return;
    }

    // Atomic: create movement with status 'pending_approval' and reserve stock
    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();
      const trxNumber = getNextTrxNumber();

      const newMovement = db
        .insert(movements)
        .values({
          trxNumber,
          custodyId,
          movementType: 'disposal',
          status: 'pending_approval',
          sourceWarehouseId: sourceWh.id,
          targetWarehouseId: null,
          itemId: Number(itemId),
          quantityMilli: qtyMilli,
          notes: notes ? notes.trim() : 'طلب خروج نهائي (إتلاف/تكهين)',
          createdBy: Number(userId) || 1,
          createdAt: now,
        })
        .returning()
        .get();

      // Reserve stock
      db.update(stockBalances)
        .set({ reservedQtyMilli: reservedMilli + qtyMilli })
        .where(
          and(
            eq(stockBalances.custodyId, custodyId),
            eq(stockBalances.warehouseId, sourceWh.id),
            eq(stockBalances.itemId, Number(itemId))
          )
        )
        .run();

      db.update(custodies)
        .set({ isInitialImportLocked: true })
        .where(eq(custodies.id, custodyId))
        .run();

      return newMovement;
    });

    const created = transaction();

    res.json({
      success: true,
      message: `تم رفع طلب الخروج النهائي برقم ${created.trxNumber} وحجز الكمية بانتظار قرار رئيس القسم`,
      movement: created,
    });
  } catch (error: any) {
    console.error('Error requesting disposal:', error);
    res.status(500).json({ error: error.message || 'فشل تسجيل طلب الخروج النهائي' });
  }
});

// =================== PENDING MOVEMENTS APPROVAL & REJECTION ===================

// POST /api/movements/:id/approve - Supervisor Approves (deducts actual qty and unreserves)
movementsRouter.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const movementId = Number(req.params.id);
    const { supervisorUserId } = req.body;

    const mov = db.select().from(movements).where(eq(movements.id, movementId)).get();
    if (!mov || mov.status !== 'pending_approval') {
      res.status(400).json({ error: 'الحركة غير معلقة أو تم البت فيها مسبقاً' });
      return;
    }

    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();

      // 1. Update movement status
      db.update(movements)
        .set({
          status: 'executed',
          approvedBy: supervisorUserId ? Number(supervisorUserId) : null,
          approvedAt: now,
        })
        .where(eq(movements.id, mov.id))
        .run();

      // 2. Deduct from actual stock AND remove reservation
      const bal = db
        .select()
        .from(stockBalances)
        .where(
          and(
            eq(stockBalances.custodyId, mov.custodyId),
            eq(stockBalances.warehouseId, mov.sourceWarehouseId!),
            eq(stockBalances.itemId, mov.itemId)
          )
        )
        .get();

      if (bal) {
        db.update(stockBalances)
          .set({
            quantityMilli: bal.quantityMilli - mov.quantityMilli,
            reservedQtyMilli: Math.max(0, bal.reservedQtyMilli - mov.quantityMilli),
          })
          .where(
            and(
              eq(stockBalances.custodyId, mov.custodyId),
              eq(stockBalances.warehouseId, mov.sourceWarehouseId!),
              eq(stockBalances.itemId, mov.itemId)
            )
          )
          .run();
      }

      // Audit log
      db.insert(auditLogs)
        .values({
          userId: supervisorUserId ? Number(supervisorUserId) : null,
          userCode: 'SUPERVISOR',
          action: 'MOVEMENT_APPROVED',
          details: JSON.stringify({ trxNumber: mov.trxNumber, qtyMilli: mov.quantityMilli }),
          createdAt: now,
        })
        .run();

      return true;
    });

    transaction();

    res.json({ success: true, message: `تم اعتماد الطلب ${mov.trxNumber} وخصم الرصيد وفك الحجز بنجاح` });
  } catch (error: any) {
    console.error('Error approving movement:', error);
    res.status(500).json({ error: error.message || 'فشل اعتماد الطلب' });
  }
});

// POST /api/movements/:id/reject - Supervisor Rejects (unreserves ONLY, no deduction)
movementsRouter.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const movementId = Number(req.params.id);
    const { reason, supervisorUserId } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ error: 'يرجى تسجيل سبب الرفض الإلزامي' });
      return;
    }

    const mov = db.select().from(movements).where(eq(movements.id, movementId)).get();
    if (!mov || mov.status !== 'pending_approval') {
      res.status(400).json({ error: 'الحركة غير معلقة' });
      return;
    }

    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();

      // 1. Update movement status
      db.update(movements)
        .set({
          status: 'rejected',
          rejectionReason: reason.trim(),
          approvedBy: supervisorUserId ? Number(supervisorUserId) : null,
          approvedAt: now,
        })
        .where(eq(movements.id, mov.id))
        .run();

      // 2. Unreserve stock ONLY (actual quantity remains intact!)
      const bal = db
        .select()
        .from(stockBalances)
        .where(
          and(
            eq(stockBalances.custodyId, mov.custodyId),
            eq(stockBalances.warehouseId, mov.sourceWarehouseId!),
            eq(stockBalances.itemId, mov.itemId)
          )
        )
        .get();

      if (bal) {
        db.update(stockBalances)
          .set({
            reservedQtyMilli: Math.max(0, bal.reservedQtyMilli - mov.quantityMilli),
          })
          .where(
            and(
              eq(stockBalances.custodyId, mov.custodyId),
              eq(stockBalances.warehouseId, mov.sourceWarehouseId!),
              eq(stockBalances.itemId, mov.itemId)
            )
          )
          .run();
      }

      return true;
    });

    transaction();

    res.json({ success: true, message: `تم رفض الطلب ${mov.trxNumber} وفك حجز الكمية بنجاح وإعادتها للرصيد المتاح` });
  } catch (error: any) {
    console.error('Error rejecting movement:', error);
    res.status(500).json({ error: error.message || 'فشل رفض الطلب' });
  }
});

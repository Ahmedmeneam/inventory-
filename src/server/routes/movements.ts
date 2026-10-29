import { Router, type Request, type Response } from 'express';
import { db, sqlite } from '../db/index.ts';
import {
  movements,
  stockBalances,
  delegationRules,
  warehouses,
  custodies,
  items,
  units,
  custodyItems,
  users,
  auditLogs,
  notifications,
} from '../db/schema.ts';
import { eq, and, or, sql, desc, count } from 'drizzle-orm';
import { toMilli, fromMilli, formatTrxNumber, evaluateDelegationRule, getFiscalYear } from '../../utils/rules.ts';

export const movementsRouter = Router();

// =================== MOVEMENT TRANSACTIONS & NUMBERING ===================

function getNextTrxNumber(date: Date = new Date()): string {
  const fiscalYear = getFiscalYear(date);
  const prefix = `TRX-${fiscalYear}-`;
  const rows = db
    .select({ trxNumber: movements.trxNumber })
    .from(movements)
    .where(sql`${movements.trxNumber} LIKE ${prefix + '%'}`)
    .all();
  const maxSequence = rows.reduce((max, row) => {
    const match = row.trxNumber.match(new RegExp(`^TRX-${fiscalYear}-(\\d+)$`));
    const sequence = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return formatTrxNumber(maxSequence + 1, date);
}
movementsRouter.get('/next-trx-number', (_req: Request, res: Response) => {
  res.json({ nextTrxNumber: getNextTrxNumber() });
});

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
        receiver_name: movements.receiverName,
        receiver_phone: movements.receiverPhone,
        doc_ref: movements.docRef,
        department: movements.department,
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
    const allWarehouses = db.select().from(warehouses).all();
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
    const { targetWarehouseId, itemId, quantity, notes, userId, trxNumber } = req.body;

    if (!targetWarehouseId || !itemId || !quantity) {
      res.status(400).json({ error: 'يرجى تحديد الصنف والمخزن والكمية' });
      return;
    }

    const qtyMilli = toMilli(Number(quantity));
    if (qtyMilli <= 0) {
      res.status(400).json({ error: 'كمية الوارد يجب أن تكون أكبر من صفر' });
      return;
    }

    // Validate target warehouse exists and belongs to this custody (or is general company warehouse)
    const targetWh = db
      .select()
      .from(warehouses)
      .where(
        and(
          eq(warehouses.id, Number(targetWarehouseId)),
          or(eq(warehouses.custodyId, custodyId), eq(warehouses.isGeneral, true))
        )
      )
      .get();

    if (!targetWh) {
      res.status(400).json({ error: 'المخزن المحدد غير موجود أو لا يتبع هذه العهدة' });
      return;
    }

    if (targetWh.status === 'frozen') {
      res.status(400).json({ error: 'المخزن مجمد حالياً بسبب جلسة جرد نشطة' });
      return;
    }

    const userObj = userId ? db.select().from(users).where(eq(users.id, Number(userId))).get() : null;
    const isStorekeeper = userObj?.role === 'storekeeper';
    const isPending = isStorekeeper; // Storekeeper additions require supervisor approval

    // Atomic transaction: create movement, update stock (if direct), lock initial import permanently
    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();
      const requestedTrxNumber = typeof req.body.trxNumber === 'string' ? req.body.trxNumber.trim() : '';
      const trxNumber = requestedTrxNumber || getNextTrxNumber();
      if (db.select().from(movements).where(eq(movements.trxNumber, trxNumber)).get()) {
        throw new Error(`رقم العملية ${trxNumber} مسجل مسبقاً`);
      }

      // 1. Insert Movement (pending_approval if storekeeper, executed if supervisor/admin)
      const newMovement = db
        .insert(movements)
        .values({
          trxNumber,
          custodyId,
          movementType: 'addition',
          status: isPending ? 'pending_approval' : 'executed',
          sourceWarehouseId: null,
          targetWarehouseId: targetWh.id,
          itemId: Number(itemId),
          quantityMilli: qtyMilli,
          notes: notes ? notes.trim() : (isPending ? 'وارد خارجي معلق بانتظار موافقة رئيس القسم' : null),
          createdBy: Number(userId) || 1,
          createdAt: now,
          approvedBy: isPending ? null : (Number(userId) || 1),
          approvedAt: isPending ? null : now,
        })
        .returning()
        .get();

      // 2. Update stock balance ONLY if directly executed (supervisor/admin)
      if (!isPending) {
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
      } else {
        // Send notification to supervisor of this custody
        const itemObj = db.select().from(items).where(eq(items.id, Number(itemId))).get();
        db.insert(notifications).values({
          custodyId,
          targetRole: 'supervisor',
          targetUserId: null,
          title: 'طلب وارد خارجي جديد بانتظار الاعتماد',
          message: `قام أمين العهدة (${userObj?.fullName || 'أمين العهدة'}) بتسجيل وارد خارجي للصنف (${itemObj?.name || 'صنف'}) بكمية ${fromMilli(qtyMilli)} بالمخزن الرئيسي. يتطلب موافقتك.`,
          linkTab: 'pending',
          relatedId: newMovement.id,
          isRead: false,
          createdAt: now,
        }).run();
      }

      // 3. Lock initial import permanently on first operational movement
      db.update(custodies)
        .set({ isInitialImportLocked: true })
        .where(eq(custodies.id, custodyId))
        .run();

      return { movement: newMovement, isPending };
    });

    const result = transaction();

    res.json({
      success: true,
      isPending: result.isPending,
      message: result.isPending
        ? `تم تسجيل طلب الوارد الخارجي برقم ${result.movement.trxNumber} وحالته معلقة بانتظار موافقة رئيس القسم (تم إرسال إشعار لرئيس القسم)`
        : `تم تسجيل حركة الإضافة بنجاح برقم المعاملة ${result.movement.trxNumber} وإضافتها للمخزن الرئيسي`,
      movement: result.movement,
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
    const { sourceWarehouseId, itemId, quantity, notes, userId, trxNumber } = req.body;

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
      const requestedTrxNumber = typeof req.body.trxNumber === 'string' ? req.body.trxNumber.trim() : '';
      const trxNumber = requestedTrxNumber || getNextTrxNumber();
      if (db.select().from(movements).where(eq(movements.trxNumber, trxNumber)).get()) {
        throw new Error(`رقم العملية ${trxNumber} مسجل مسبقاً`);
      }

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

        // Send notification to supervisor
        const itemObj = db.select().from(items).where(eq(items.id, Number(itemId))).get();
        const userObj = userId ? db.select().from(users).where(eq(users.id, Number(userId))).get() : null;
        db.insert(notifications).values({
          custodyId,
          targetRole: 'supervisor',
          targetUserId: null,
          title: 'طلب خصم مخزني جديد بانتظار الاعتماد',
          message: `قام أمين العهدة (${userObj?.fullName || 'أمين العهدة'}) برفع طلب خصم للصنف (${itemObj?.name || 'صنف'}) بكمية ${fromMilli(qtyMilli)} من مخزن (${sourceWh.name}). يتطلب موافقتك وحجزت الكمية.`,
          linkTab: 'pending',
          relatedId: newMovement.id,
          isRead: false,
          createdAt: now,
        }).run();
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
    const { sourceWarehouseId, targetWarehouseId, itemId, quantity, notes, userId, trxNumber } = req.body;

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

    const userObj = userId ? db.select().from(users).where(eq(users.id, Number(userId))).get() : null;
    const isStorekeeper = userObj?.role === 'storekeeper';
    const isPending = isStorekeeper; // Storekeeper transfer requires supervisor approval

    // Atomic Transfer Transaction
    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();
      const requestedTrxNumber = typeof req.body.trxNumber === 'string' ? req.body.trxNumber.trim() : '';
      const trxNumber = requestedTrxNumber || getNextTrxNumber();
      if (db.select().from(movements).where(eq(movements.trxNumber, trxNumber)).get()) {
        throw new Error(`رقم العملية ${trxNumber} مسجل مسبقاً`);
      }

      // 1. Create movement
      const newMovement = db
        .insert(movements)
        .values({
          trxNumber,
          custodyId,
          movementType: 'internal_transfer',
          status: isPending ? 'pending_approval' : 'executed',
          sourceWarehouseId: sourceWh.id,
          targetWarehouseId: targetWh.id,
          itemId: Number(itemId),
          quantityMilli: qtyMilli,
          notes: notes ? notes.trim() : (isPending ? 'تحويل داخلي معلق بانتظار موافقة رئيس القسم' : null),
          createdBy: Number(userId) || 1,
          createdAt: now,
          approvedBy: isPending ? null : (Number(userId) || 1),
          approvedAt: isPending ? null : now,
        })
        .returning()
        .get();

      if (!isPending) {
        // Direct execution (supervisor/admin)
        // Decrement source warehouse
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

        // Increment target warehouse
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
      } else {
        // Storekeeper: Reserve stock in source warehouse to prevent double-spending
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

        // Send notification to supervisor
        const itemObj = db.select().from(items).where(eq(items.id, Number(itemId))).get();
        db.insert(notifications).values({
          custodyId,
          targetRole: 'supervisor',
          targetUserId: null,
          title: 'طلب تحويل داخلي جديد بانتظار الاعتماد',
          message: `قام أمين العهدة (${userObj?.fullName || 'أمين العهدة'}) بطلب تحويل داخلي للصنف (${itemObj?.name || 'صنف'}) بكمية ${fromMilli(qtyMilli)} من (${sourceWh.name}) إلى (${targetWh.name}).`,
          linkTab: 'pending',
          relatedId: newMovement.id,
          isRead: false,
          createdAt: now,
        }).run();
      }

      // Lock initial import
      db.update(custodies)
        .set({ isInitialImportLocked: true })
        .where(eq(custodies.id, custodyId))
        .run();

      return { movement: newMovement, isPending };
    });

    const result = transaction();

    res.json({
      success: true,
      isPending: result.isPending,
      message: result.isPending
        ? `تم تسجيل طلب التحويل الداخلي برقم ${result.movement.trxNumber} وحجز الكمية بمخزن المصدر لحين موافقة رئيس القسم`
        : `تم تنفيذ التحويل الداخلي بنجاح برقم ${result.movement.trxNumber}`,
      movement: result.movement,
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
    const { sourceWarehouseId, itemId, quantity, notes, userId, trxNumber } = req.body;

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
      const requestedTrxNumber = typeof req.body.trxNumber === 'string' ? req.body.trxNumber.trim() : '';
      const trxNumber = requestedTrxNumber || getNextTrxNumber();
      if (db.select().from(movements).where(eq(movements.trxNumber, trxNumber)).get()) {
        throw new Error(`رقم العملية ${trxNumber} مسجل مسبقاً`);
      }

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

      // Send notification to supervisor
      const itemObj = db.select().from(items).where(eq(items.id, Number(itemId))).get();
      const userObj = userId ? db.select().from(users).where(eq(users.id, Number(userId))).get() : null;
      db.insert(notifications).values({
        custodyId,
        targetRole: 'supervisor',
        targetUserId: null,
        title: 'طلب خروج نهائي (إتلاف/تكهين) جديد',
        message: `قام أمين العهدة (${userObj?.fullName || 'أمين العهدة'}) برفع طلب خروج نهائي للصنف (${itemObj?.name || 'صنف'}) بكمية ${fromMilli(qtyMilli)} من مخزن (${sourceWh.name}). يتطلب موافقتك وحجزت الكمية.`,
        linkTab: 'pending',
        relatedId: newMovement.id,
        isRead: false,
        createdAt: now,
      }).run();

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

// POST /api/movements/:id/approve - Supervisor Approves
movementsRouter.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const movementId = Number(req.params.id);
    const { supervisorUserId } = req.body;

    // Check authority: Storekeeper cannot approve!
    const approver = supervisorUserId ? db.select().from(users).where(eq(users.id, Number(supervisorUserId))).get() : null;
    if (approver?.role === 'storekeeper') {
      res.status(403).json({ error: 'صلاحية مرفوضة: لا يملك أمين العهدة صلاحية الاعتماد. الاعتماد محصور برئيس القسم ومسؤول النظام.' });
      return;
    }

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

      // 2. Handle stock balances depending on movement type
      if (mov.movementType === 'addition') {
        // Increment actual stock in target warehouse (the main warehouse)
        const targetBal = db
          .select()
          .from(stockBalances)
          .where(
            and(
              eq(stockBalances.custodyId, mov.custodyId),
              eq(stockBalances.warehouseId, mov.targetWarehouseId!),
              eq(stockBalances.itemId, mov.itemId)
            )
          )
          .get();

        if (targetBal) {
          db.update(stockBalances)
            .set({ quantityMilli: targetBal.quantityMilli + mov.quantityMilli })
            .where(
              and(
                eq(stockBalances.custodyId, mov.custodyId),
                eq(stockBalances.warehouseId, mov.targetWarehouseId!),
                eq(stockBalances.itemId, mov.itemId)
              )
            )
            .run();
        } else {
          db.insert(stockBalances)
            .values({
              custodyId: mov.custodyId,
              warehouseId: mov.targetWarehouseId!,
              itemId: mov.itemId,
              quantityMilli: mov.quantityMilli,
              reservedQtyMilli: 0,
            })
            .run();
        }
      } else if (mov.movementType === 'internal_transfer') {
        // Decrement and unreserve in source warehouse
        const srcBal = db
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

        if (srcBal) {
          db.update(stockBalances)
            .set({
              quantityMilli: srcBal.quantityMilli - mov.quantityMilli,
              reservedQtyMilli: Math.max(0, srcBal.reservedQtyMilli - mov.quantityMilli),
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

        // Increment in target warehouse
        const tgtBal = db
          .select()
          .from(stockBalances)
          .where(
            and(
              eq(stockBalances.custodyId, mov.custodyId),
              eq(stockBalances.warehouseId, mov.targetWarehouseId!),
              eq(stockBalances.itemId, mov.itemId)
            )
          )
          .get();

        if (tgtBal) {
          db.update(stockBalances)
            .set({ quantityMilli: tgtBal.quantityMilli + mov.quantityMilli })
            .where(
              and(
                eq(stockBalances.custodyId, mov.custodyId),
                eq(stockBalances.warehouseId, mov.targetWarehouseId!),
                eq(stockBalances.itemId, mov.itemId)
              )
            )
            .run();
        } else {
          db.insert(stockBalances)
            .values({
              custodyId: mov.custodyId,
              warehouseId: mov.targetWarehouseId!,
              itemId: mov.itemId,
              quantityMilli: mov.quantityMilli,
              reservedQtyMilli: 0,
            })
            .run();
        }
      } else {
        // Issue or Disposal: Deduct from actual stock AND remove reservation
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
      }

      // Send in-app notification to the storekeeper who created the request
      db.insert(notifications).values({
        custodyId: mov.custodyId,
        targetRole: 'storekeeper',
        targetUserId: mov.createdBy,
        title: `تمت الموافقة على طلبك (${mov.trxNumber})`,
        message: `وافق رئيس القسم على المعاملة (${mov.trxNumber}) وتم تحديث الأرصدة المخزنية بنجاح.`,
        linkTab: 'movements',
        relatedId: mov.id,
        isRead: false,
        createdAt: now,
      }).run();

      // Audit log
      db.insert(auditLogs)
        .values({
          userId: supervisorUserId ? Number(supervisorUserId) : null,
          userCode: approver?.userCode || 'SUPERVISOR',
          action: 'MOVEMENT_APPROVED',
          details: JSON.stringify({ trxNumber: mov.trxNumber, type: mov.movementType, qtyMilli: mov.quantityMilli }),
          createdAt: now,
        })
        .run();

      return true;
    });

    transaction();

    res.json({ success: true, message: `تم اعتماد المعاملة ${mov.trxNumber} وتحديث الأرصدة بنجاح وإرسال إشعار لأمين العهدة` });
  } catch (error: any) {
    console.error('Error approving movement:', error);
    res.status(500).json({ error: error.message || 'فشل اعتماد الطلب' });
  }
});

// POST /api/movements/:id/reject - Supervisor Rejects
movementsRouter.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const movementId = Number(req.params.id);
    const { reason, supervisorUserId } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ error: 'يرجى تسجيل سبب الرفض الإلزامي' });
      return;
    }

    // Check authority: Storekeeper cannot reject!
    const rejecter = supervisorUserId ? db.select().from(users).where(eq(users.id, Number(supervisorUserId))).get() : null;
    if (rejecter?.role === 'storekeeper') {
      res.status(403).json({ error: 'صلاحية مرفوضة: لا يملك أمين العهدة صلاحية رفض العمليات. الرفض محصور برئيس القسم ومسؤول النظام.' });
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

      // 2. Unreserve stock if was reserved (not addition)
      if (mov.movementType !== 'addition' && mov.sourceWarehouseId) {
        const bal = db
          .select()
          .from(stockBalances)
          .where(
            and(
              eq(stockBalances.custodyId, mov.custodyId),
              eq(stockBalances.warehouseId, mov.sourceWarehouseId),
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
                eq(stockBalances.warehouseId, mov.sourceWarehouseId),
                eq(stockBalances.itemId, mov.itemId)
              )
            )
            .run();
        }
      }

      // Send notification to storekeeper
      db.insert(notifications).values({
        custodyId: mov.custodyId,
        targetRole: 'storekeeper',
        targetUserId: mov.createdBy,
        title: `تم رفض طلبك (${mov.trxNumber})`,
        message: `رفض رئيس القسم المعاملة (${mov.trxNumber}). سبب الرفض: ${reason.trim()}`,
        linkTab: 'movements',
        relatedId: mov.id,
        isRead: false,
        createdAt: now,
      }).run();

      return true;
    });

    transaction();

    res.json({ success: true, message: `تم رفض الطلب ${mov.trxNumber} وفك أي حجز للكمية وإرسال إشعار لأمين العهدة` });
  } catch (error: any) {
    console.error('Error rejecting movement:', error);
    res.status(500).json({ error: error.message || 'فشل رفض الطلب' });
  }
});

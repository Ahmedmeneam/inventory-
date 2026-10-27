import { Router, type Request, type Response } from 'express';
import { db, sqlite } from '../db/index.ts';
import {
  inventorySessions,
  inventoryCounts,
  warehouses,
  custodies,
  items,
  units,
  categories,
  stockBalances,
  movements,
  users,
  auditLogs,
  fiscalClosings,
  custodyItems,
} from '../db/schema.ts';
import { eq, and, desc, asc, sql, sum } from 'drizzle-orm';
import { fromMilli, toMilli, formatTrxNumber, getFiscalYear } from '../../utils/rules.ts';
import bcrypt from 'bcryptjs';

export const inventoryRouter = Router();

// =================== PERIODIC INVENTORY SESSIONS ===================

// GET /api/inventory/sessions - List all inventory sessions
inventoryRouter.get('/sessions', async (req: Request, res: Response) => {
  try {
    const { custodyId, status } = req.query;

    let query = db
      .select({
        id: inventorySessions.id,
        custody_id: inventorySessions.custodyId,
        custody_name: custodies.name,
        custody_code: custodies.code,
        warehouse_id: inventorySessions.warehouseId,
        warehouse_name: warehouses.name,
        is_main: warehouses.isMain,
        started_by: inventorySessions.startedBy,
        starter_name: users.fullName,
        started_at: inventorySessions.startedAt,
        status: inventorySessions.status,
        completed_by: inventorySessions.completedBy,
        completed_at: inventorySessions.completedAt,
        cancellation_reason: inventorySessions.cancellationReason,
        notes: inventorySessions.notes,
      })
      .from(inventorySessions)
      .leftJoin(custodies, eq(inventorySessions.custodyId, custodies.id))
      .leftJoin(warehouses, eq(inventorySessions.warehouseId, warehouses.id))
      .leftJoin(users, eq(inventorySessions.startedBy, users.id))
      .orderBy(desc(inventorySessions.id));

    let list = query.all();

    if (custodyId && custodyId !== 'all') {
      const cId = Number(custodyId);
      list = list.filter((s) => s.custody_id === cId);
    }

    if (status && status !== 'all') {
      list = list.filter((s) => s.status === status);
    }

    res.json({
      success: true,
      count: list.length,
      sessions: list,
    });
  } catch (error) {
    console.error('Error fetching inventory sessions:', error);
    res.status(500).json({ error: 'خطأ في جلب جلسات الجرد' });
  }
});

// GET /api/inventory/sessions/:id - Single session details with counts
inventoryRouter.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.id);

    const session = db
      .select({
        id: inventorySessions.id,
        custody_id: inventorySessions.custodyId,
        custody_name: custodies.name,
        custody_code: custodies.code,
        warehouse_id: inventorySessions.warehouseId,
        warehouse_name: warehouses.name,
        warehouse_status: warehouses.status,
        started_by: inventorySessions.startedBy,
        starter_name: users.fullName,
        started_at: inventorySessions.startedAt,
        status: inventorySessions.status,
        completed_by: inventorySessions.completedBy,
        completed_at: inventorySessions.completedAt,
        cancellation_reason: inventorySessions.cancellationReason,
        notes: inventorySessions.notes,
      })
      .from(inventorySessions)
      .leftJoin(custodies, eq(inventorySessions.custodyId, custodies.id))
      .leftJoin(warehouses, eq(inventorySessions.warehouseId, warehouses.id))
      .leftJoin(users, eq(inventorySessions.startedBy, users.id))
      .where(eq(inventorySessions.id, sessionId))
      .get();

    if (!session) {
      res.status(404).json({ error: 'جلسة الجرد غير موجودة' });
      return;
    }

    // Get completer name if completed
    let completerName = null;
    if (session.completed_by) {
      const comp = db.select().from(users).where(eq(users.id, session.completed_by)).get();
      completerName = comp ? `${comp.fullName} (${comp.userCode})` : null;
    }

    // Get all item counts in this session
    const counts = db
      .select({
        id: inventoryCounts.id,
        session_id: inventoryCounts.sessionId,
        item_id: inventoryCounts.itemId,
        item_code: items.itemCode,
        item_name: items.name,
        category_name: categories.name,
        unit_name: units.name,
        unit_symbol: units.symbol,
        book_quantity_milli: inventoryCounts.bookQuantityMilli,
        actual_quantity_milli: inventoryCounts.actualQuantityMilli,
        difference_milli: inventoryCounts.differenceMilli,
        notes: inventoryCounts.notes,
      })
      .from(inventoryCounts)
      .innerJoin(items, eq(inventoryCounts.itemId, items.id))
      .leftJoin(categories, eq(items.categoryId, categories.id))
      .leftJoin(units, eq(items.unitId, units.id))
      .where(eq(inventoryCounts.sessionId, sessionId))
      .orderBy(asc(items.itemCode))
      .all();

    const formattedCounts = counts.map((c) => ({
      ...c,
      category_name: c.category_name || 'بدون تصنيف',
      book_quantity: fromMilli(c.book_quantity_milli),
      actual_quantity: fromMilli(c.actual_quantity_milli),
      difference: fromMilli(c.difference_milli),
    }));

    // Summary metrics
    const totalItems = counts.length;
    const surplusCount = counts.filter((c) => c.difference_milli > 0).length;
    const deficitCount = counts.filter((c) => c.difference_milli < 0).length;
    const matchedCount = counts.filter((c) => c.difference_milli === 0).length;

    res.json({
      success: true,
      session: {
        ...session,
        completer_name: completerName,
      },
      counts: formattedCounts,
      metrics: {
        totalItems,
        surplusCount,
        deficitCount,
        matchedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({ error: 'خطأ في جلب بيانات محضر الجرد' });
  }
});

// POST /api/inventory/sessions - Start new inventory session & freeze warehouse immediately
inventoryRouter.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { custodyId, warehouseId, notes, userId, userRole } = req.body;

    if (!custodyId || !warehouseId) {
      res.status(400).json({ error: 'يرجى تحديد العهدة والمخزن المراد جرده' });
      return;
    }

    if (userRole && userRole !== 'supervisor' && userRole !== 'admin') {
      res.status(403).json({ error: 'صلاحية بدء الجرد وتجميد المخزن محصورة برئيس القسم ومسؤول النظام' });
      return;
    }

    const wh = db.select().from(warehouses).where(eq(warehouses.id, Number(warehouseId))).get();
    if (!wh) {
      res.status(404).json({ error: 'المخزن غير موجود' });
      return;
    }

    if (wh.status === 'frozen') {
      res.status(400).json({ error: 'هذا المخزن مجمد بالفعل في جلسة جرد أخرى جارية' });
      return;
    }

    const cust = db.select().from(custodies).where(eq(custodies.id, Number(custodyId))).get();
    if (!cust) {
      res.status(404).json({ error: 'العهدة غير موجودة' });
      return;
    }

    // Atomic transaction: freeze warehouse + create session + populate initial counts from current book balance
    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();

      // 1. Freeze warehouse immediately
      db.update(warehouses)
        .set({ status: 'frozen' })
        .where(eq(warehouses.id, wh.id))
        .run();

      // 2. Insert session
      const newSession = db
        .insert(inventorySessions)
        .values({
          custodyId: cust.id,
          warehouseId: wh.id,
          startedBy: userId ? Number(userId) : 1,
          startedAt: now,
          status: 'in_progress',
          notes: notes ? notes.trim() : null,
        })
        .returning()
        .get();

      // 3. Find all items linked to this custody
      const linked = db
        .select({ itemId: custodyItems.itemId })
        .from(custodyItems)
        .where(eq(custodyItems.custodyId, cust.id))
        .all();

      // Also include any items that might have a balance in this warehouse
      const existingBalances = db
        .select({
          itemId: stockBalances.itemId,
          quantityMilli: stockBalances.quantityMilli,
        })
        .from(stockBalances)
        .where(
          and(
            eq(stockBalances.custodyId, cust.id),
            eq(stockBalances.warehouseId, wh.id)
          )
        )
        .all();

      const balanceMap = new Map(existingBalances.map((b) => [b.itemId, b.quantityMilli]));

      const allItemIdsSet = new Set<number>();
      linked.forEach((l) => allItemIdsSet.add(l.itemId));
      existingBalances.forEach((b) => allItemIdsSet.add(b.itemId));

      // 4. Pre-populate inventory_counts rows
      const insertCount = sqlite.prepare(`
        INSERT INTO inventory_counts (session_id, item_id, book_quantity_milli, actual_quantity_milli, difference_milli, notes)
        VALUES (?, ?, ?, ?, 0, NULL)
      `);

      for (const itemId of allItemIdsSet) {
        const bookQtyMilli = balanceMap.get(itemId) || 0;
        insertCount.run(newSession.id, itemId, bookQtyMilli, bookQtyMilli);
      }

      // 5. Audit log
      db.insert(auditLogs)
        .values({
          userId: userId ? Number(userId) : null,
          userCode: userRole || 'SYSTEM',
          action: 'INVENTORY_SESSION_STARTED',
          details: JSON.stringify({
            sessionId: newSession.id,
            warehouseId: wh.id,
            warehouseName: wh.name,
            custodyId: cust.id,
            itemCount: allItemIdsSet.size,
          }),
          createdAt: now,
        })
        .run();

      return newSession;
    });

    const result = transaction();

    res.json({
      success: true,
      message: `تم بدء جلسة الجرد وتجميد المخزن [${wh.name}] بنجاح`,
      session: result,
    });
  } catch (error: any) {
    console.error('Error starting inventory session:', error);
    res.status(500).json({ error: error.message || 'فشل بدء جلسة الجرد' });
  }
});

// PUT /api/inventory/sessions/:id/counts - Update counted actual quantities
inventoryRouter.put('/sessions/:id/counts', async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.id);
    const { counts } = req.body; // Array of { id: number, actual_quantity: number, notes?: string }

    if (!Array.isArray(counts)) {
      res.status(400).json({ error: 'صيغة بيانات العد الفعلي غير صحيحة' });
      return;
    }

    const session = db
      .select()
      .from(inventorySessions)
      .where(eq(inventorySessions.id, sessionId))
      .get();

    if (!session) {
      res.status(404).json({ error: 'جلسة الجرد غير موجودة' });
      return;
    }

    if (session.status !== 'in_progress') {
      res.status(400).json({ error: 'لا يمكن تعديل عد جلسة جرد مكتملة أو ملغاة' });
      return;
    }

    const transaction = sqlite.transaction(() => {
      const updateStmt = sqlite.prepare(`
        UPDATE inventory_counts 
        SET actual_quantity_milli = ?, difference_milli = (? - book_quantity_milli), notes = ?
        WHERE id = ? AND session_id = ?
      `);

      for (const c of counts) {
        const actualMilli = toMilli(Number(c.actual_quantity) || 0);
        updateStmt.run(
          actualMilli,
          actualMilli,
          c.notes ? String(c.notes).trim() : null,
          Number(c.id),
          sessionId
        );
      }
    });

    transaction();

    res.json({
      success: true,
      message: 'تم حفظ أرقام العد الفعلي واحتساب الفروقات بنجاح',
    });
  } catch (error: any) {
    console.error('Error updating inventory counts:', error);
    res.status(500).json({ error: error.message || 'فشل حفظ أرقام العد الفعلي' });
  }
});

// POST /api/inventory/sessions/:id/complete - Approve inventory report, apply adjustments, unfreeze warehouse
inventoryRouter.post('/sessions/:id/complete', async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.id);
    const { userId, userRole, notes } = req.body;

    if (userRole && userRole !== 'supervisor' && userRole !== 'admin') {
      res.status(403).json({ error: 'صلاحية اعتماد محضر الجرد والتسويات محصورة برئيس القسم ومسؤول النظام' });
      return;
    }

    const session = db
      .select()
      .from(inventorySessions)
      .where(eq(inventorySessions.id, sessionId))
      .get();

    if (!session) {
      res.status(404).json({ error: 'جلسة الجرد غير موجودة' });
      return;
    }

    if (session.status !== 'in_progress') {
      res.status(400).json({ error: 'جلسة الجرد ليست في حالة جارية' });
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Atomic transaction: generate adjustments for items with difference != 0 + update balances + unfreeze
    const transaction = sqlite.transaction(() => {
      const counts = db
        .select()
        .from(inventoryCounts)
        .where(eq(inventoryCounts.sessionId, sessionId))
        .all();

      let adjustmentCount = 0;

      for (const c of counts) {
        if (c.differenceMilli !== 0) {
          adjustmentCount++;
          // Generate adjustment movement
          const allMovements = db.select({ id: movements.id }).from(movements).all();
          const nextSeq = allMovements.length + 1;
          const trxNumber = formatTrxNumber(nextSeq, now);

          const isSurplus = c.differenceMilli > 0;
          const diffAbs = Math.abs(c.differenceMilli);

          db.insert(movements)
            .values({
              trxNumber,
              custodyId: session.custodyId,
              movementType: 'adjustment',
              status: 'approved',
              sourceWarehouseId: !isSurplus ? session.warehouseId : null,
              targetWarehouseId: isSurplus ? session.warehouseId : null,
              itemId: c.itemId,
              quantityMilli: diffAbs,
              notes: `تسوية جردية (${isSurplus ? 'زيادة' : 'عجز'}) لمحضر الجرد #${session.id}. ${c.notes || ''}`.trim(),
              createdBy: userId ? Number(userId) : session.startedBy,
              createdAt: nowIso,
              approvedBy: userId ? Number(userId) : session.startedBy,
              approvedAt: nowIso,
            })
            .run();

          // Update stock_balances to match actual counted quantity
          const existingBal = db
            .select()
            .from(stockBalances)
            .where(
              and(
                eq(stockBalances.custodyId, session.custodyId),
                eq(stockBalances.warehouseId, session.warehouseId),
                eq(stockBalances.itemId, c.itemId)
              )
            )
            .get();

          if (existingBal) {
            db.update(stockBalances)
              .set({ quantityMilli: c.actualQuantityMilli })
              .where(
                and(
                  eq(stockBalances.custodyId, session.custodyId),
                  eq(stockBalances.warehouseId, session.warehouseId),
                  eq(stockBalances.itemId, c.itemId)
                )
              )
              .run();
          } else {
            db.insert(stockBalances)
              .values({
                custodyId: session.custodyId,
                warehouseId: session.warehouseId,
                itemId: c.itemId,
                quantityMilli: c.actualQuantityMilli,
                reservedQtyMilli: 0,
              })
              .run();
          }
        }
      }

      // 2. Mark session completed
      db.update(inventorySessions)
        .set({
          status: 'completed',
          completedBy: userId ? Number(userId) : session.startedBy,
          completedAt: nowIso,
          notes: notes ? notes.trim() : session.notes,
        })
        .where(eq(inventorySessions.id, session.id))
        .run();

      // 3. Unfreeze warehouse!
      db.update(warehouses)
        .set({ status: 'active' })
        .where(eq(warehouses.id, session.warehouseId))
        .run();

      // 4. Audit log
      db.insert(auditLogs)
        .values({
          userId: userId ? Number(userId) : null,
          userCode: userRole || 'SYSTEM',
          action: 'INVENTORY_SESSION_COMPLETED',
          details: JSON.stringify({
            sessionId: session.id,
            warehouseId: session.warehouseId,
            adjustmentsGenerated: adjustmentCount,
          }),
          createdAt: nowIso,
        })
        .run();

      return { adjustmentCount };
    });

    const result = transaction();

    res.json({
      success: true,
      message: `تم اعتماد محضر الجرد بنجاح، وتوليد ${result.adjustmentCount} حركات تسوية مخزنية آلية، وفك تجميد المخزن`,
    });
  } catch (error: any) {
    console.error('Error completing inventory session:', error);
    res.status(500).json({ error: error.message || 'فشل اعتماد محضر الجرد' });
  }
});

// POST /api/inventory/sessions/:id/cancel - Cancel session & unfreeze warehouse immediately
inventoryRouter.post('/sessions/:id/cancel', async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.id);
    const { reason, userId, userRole } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ error: 'يرجى تسجيل سبب إلغاء الجلسة كتابياً' });
      return;
    }

    if (userRole && userRole !== 'supervisor' && userRole !== 'admin') {
      res.status(403).json({ error: 'صلاحية إلغاء الجرد محصورة برئيس القسم ومسؤول النظام' });
      return;
    }

    const session = db
      .select()
      .from(inventorySessions)
      .where(eq(inventorySessions.id, sessionId))
      .get();

    if (!session) {
      res.status(404).json({ error: 'جلسة الجرد غير موجودة' });
      return;
    }

    if (session.status !== 'in_progress') {
      res.status(400).json({ error: 'لا يمكن إلغاء جلسة غير جارية' });
      return;
    }

    const nowIso = new Date().toISOString();

    const transaction = sqlite.transaction(() => {
      // 1. Mark session cancelled with reason
      db.update(inventorySessions)
        .set({
          status: 'cancelled',
          cancellationReason: reason.trim(),
        })
        .where(eq(inventorySessions.id, session.id))
        .run();

      // 2. Unfreeze warehouse immediately
      db.update(warehouses)
        .set({ status: 'active' })
        .where(eq(warehouses.id, session.warehouseId))
        .run();

      // 3. Audit log
      db.insert(auditLogs)
        .values({
          userId: userId ? Number(userId) : null,
          userCode: userRole || 'SYSTEM',
          action: 'INVENTORY_SESSION_CANCELLED',
          details: JSON.stringify({
            sessionId: session.id,
            warehouseId: session.warehouseId,
            reason: reason.trim(),
          }),
          createdAt: nowIso,
        })
        .run();
    });

    transaction();

    res.json({
      success: true,
      message: 'تم إلغاء جلسة الجرد وفك تجميد المخزن فوراً دون أي مساس بالأرصدة الدفترية',
    });
  } catch (error: any) {
    console.error('Error cancelling inventory session:', error);
    res.status(500).json({ error: error.message || 'فشل إلغاء جلسة الجرد' });
  }
});

// =================== ANNUAL FISCAL CLOSING ===================

// GET /api/inventory/annual-closing/status - Check 4 conditions & fiscal metrics
inventoryRouter.get('/annual-closing/status', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const currentFiscalYear = getFiscalYear(now);

    // Condition 1: Check pending movements (must be 0)
    const pendingMovements = db
      .select({ id: movements.id })
      .from(movements)
      .where(eq(movements.status, 'pending_approval'))
      .all();

    // Condition 2: Check open inventory sessions (must be 0)
    const openSessions = db
      .select({ id: inventorySessions.id })
      .from(inventorySessions)
      .where(eq(inventorySessions.status, 'in_progress'))
      .all();

    // Condition 3: Check if already closed
    const pastClosing = db
      .select()
      .from(fiscalClosings)
      .where(eq(fiscalClosings.fiscalYear, currentFiscalYear))
      .get();

    // Summary metrics
    const totalItems = db.select({ id: items.id }).from(items).all().length;
    const totalBalances = db
      .select({ total: sum(stockBalances.quantityMilli) })
      .from(stockBalances)
      .get();
    const totalQty = fromMilli(Number(totalBalances?.total || 0));

    // Past closings list
    const pastClosingsList = db.select().from(fiscalClosings).orderBy(desc(fiscalClosings.fiscalYear)).all();

    const isEligible = pendingMovements.length === 0 && openSessions.length === 0 && !pastClosing;

    res.json({
      currentFiscalYear,
      isEligible,
      conditions: {
        pendingMovementsCount: pendingMovements.length,
        hasNoPendingMovements: pendingMovements.length === 0,
        openSessionsCount: openSessions.length,
        hasNoOpenSessions: openSessions.length === 0,
        isAlreadyClosed: !!pastClosing,
      },
      metrics: {
        totalItems,
        totalQuantity: totalQty,
      },
      currentClosing: pastClosing || null,
      history: pastClosingsList,
    });
  } catch (error) {
    console.error('Error checking annual closing status:', error);
    res.status(500).json({ error: 'خطأ في فحص حالة الإقفال السنوي' });
  }
});

// POST /api/inventory/annual-closing/execute - Execute quantitative fiscal closing & snapshot
inventoryRouter.post('/annual-closing/execute', async (req: Request, res: Response) => {
  try {
    const { adminPassword, adminUserId, notes } = req.body;

    // Verify Admin Password
    const adminQuery = adminUserId ? eq(users.id, Number(adminUserId)) : eq(users.role, 'admin');
    const admin = db.select().from(users).where(adminQuery).get();
    if (!admin || !admin.passwordHash || !bcrypt.compareSync(adminPassword || '', admin.passwordHash)) {
      res.status(403).json({ error: 'تأكيد كلمة مرور مسؤول النظام غير صحيح' });
      return;
    }

    const now = new Date();
    const currentFiscalYear = getFiscalYear(now);

    // Verify conditions strictly
    const pendingCount = db
      .select({ id: movements.id })
      .from(movements)
      .where(eq(movements.status, 'pending_approval'))
      .all().length;

    if (pendingCount > 0) {
      res.status(400).json({ error: `لا يمكن تنفيذ الإقفال لوجود ${pendingCount} طلبات معلقة بانتظار الاعتماد` });
      return;
    }

    const openSessionsCount = db
      .select({ id: inventorySessions.id })
      .from(inventorySessions)
      .where(eq(inventorySessions.status, 'in_progress'))
      .all().length;

    if (openSessionsCount > 0) {
      res.status(400).json({ error: `لا يمكن تنفيذ الإقفال لوجود ${openSessionsCount} جلسات جرد مفتوحة` });
      return;
    }

    const alreadyClosed = db
      .select()
      .from(fiscalClosings)
      .where(eq(fiscalClosings.fiscalYear, currentFiscalYear))
      .get();

    if (alreadyClosed) {
      res.status(400).json({ error: `السنة المالية ${currentFiscalYear} تم إقفالها وتجميدها مسبقاً` });
      return;
    }

    // Atomic snapshot and closing
    const transaction = sqlite.transaction(() => {
      const nowIso = now.toISOString();

      // Gather complete snapshot of stock balances across all custodies & warehouses
      const allBalances = db
        .select({
          custody_id: stockBalances.custodyId,
          custody_name: custodies.name,
          custody_code: custodies.code,
          warehouse_id: stockBalances.warehouseId,
          warehouse_name: warehouses.name,
          item_id: stockBalances.itemId,
          item_code: items.itemCode,
          item_name: items.name,
          unit_name: units.name,
          quantity_milli: stockBalances.quantityMilli,
        })
        .from(stockBalances)
        .leftJoin(custodies, eq(stockBalances.custodyId, custodies.id))
        .leftJoin(warehouses, eq(stockBalances.warehouseId, warehouses.id))
        .leftJoin(items, eq(stockBalances.itemId, items.id))
        .leftJoin(units, eq(items.unitId, units.id))
        .all();

      const totalItemsSet = new Set(allBalances.map((b) => b.item_id));
      const totalQtyMilli = allBalances.reduce((acc, b) => acc + (b.quantity_milli || 0), 0);

      const snapshot = {
        fiscalYear: currentFiscalYear,
        closedAt: nowIso,
        closedByAdminCode: admin.userCode,
        closedByAdminName: admin.fullName,
        balances: allBalances.map((b) => ({
          ...b,
          quantity: fromMilli(b.quantity_milli || 0),
        })),
      };

      const record = db
        .insert(fiscalClosings)
        .values({
          fiscalYear: currentFiscalYear,
          closedAt: nowIso,
          closedBy: admin.id,
          totalItemsCount: totalItemsSet.size,
          totalQuantityMilli: totalQtyMilli,
          status: 'closed',
          notes: notes ? notes.trim() : `إقفال كمي رسمي للسنة المالية ${currentFiscalYear}`,
          snapshotJson: JSON.stringify(snapshot),
        })
        .returning()
        .get();

      // Audit log
      db.insert(auditLogs)
        .values({
          userId: admin.id,
          userCode: admin.userCode,
          action: 'FISCAL_YEAR_CLOSED',
          details: JSON.stringify({
            fiscalYear: currentFiscalYear,
            totalItems: totalItemsSet.size,
            totalQuantity: fromMilli(totalQtyMilli),
          }),
          createdAt: nowIso,
        })
        .run();

      return record;
    });

    const result = transaction();

    res.json({
      success: true,
      message: `تم إقفال السنة المالية ${currentFiscalYear} كمياً وتجميد أرصدتها بنجاح`,
      closing: result,
    });
  } catch (error: any) {
    console.error('Error executing annual closing:', error);
    res.status(500).json({ error: error.message || 'فشل تنفيذ الإقفال السنوي' });
  }
});

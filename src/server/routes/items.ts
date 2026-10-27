import { Router, type Request, type Response } from 'express';
import { db, sqlite } from '../db/index.ts';
import { units, categories, items, custodyItems, itemProposals, custodies, stockBalances, auditLogs } from '../db/schema.ts';
import { eq, and, sql } from 'drizzle-orm';
import { toMilli, fromMilli } from '../../utils/rules.ts';

export const itemsRouter = Router();

// =================== UNITS OF MEASUREMENT ===================

// GET /api/units
itemsRouter.get('/units', async (_req: Request, res: Response) => {
  try {
    const list = db.select().from(units).all();
    res.json({ units: list });
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'خطأ في جلب وحدات القياس' });
  }
});

// POST /api/units
itemsRouter.post('/units', async (req: Request, res: Response) => {
  try {
    const { name, symbol } = req.body;
    if (!name || !symbol) {
      res.status(400).json({ error: 'يرجى إدخال اسم ورمز وحدة القياس' });
      return;
    }

    const cleanName = name.trim();
    const cleanSymbol = symbol.trim();

    const existing = db.select().from(units).where(eq(units.name, cleanName)).get();
    if (existing) {
      res.status(400).json({ error: 'وحدة القياس معرفة مسبقاً' });
      return;
    }

    const newUnit = db.insert(units).values({ name: cleanName, symbol: cleanSymbol }).returning().get();
    res.json({ success: true, unit: newUnit });
  } catch (error) {
    console.error('Error creating unit:', error);
    res.status(500).json({ error: 'فشل إنشاء وحدة القياس' });
  }
});

// =================== CATEGORIES ===================

// GET /api/categories
itemsRouter.get('/categories', async (_req: Request, res: Response) => {
  try {
    const list = db.select().from(categories).all();
    res.json({ categories: list });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'خطأ في جلب التصنيفات' });
  }
});

// POST /api/categories
itemsRouter.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name, prefix } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'يرجى إدخال اسم التصنيف' });
      return;
    }

    const cleanName = name.trim();
    let cleanPrefix = prefix ? prefix.trim().toUpperCase() : '';

    if (!cleanPrefix) {
      const allCats = db.select().from(categories).all();
      const nextNum = allCats.length + 1;
      cleanPrefix = `CAT${String(nextNum).padStart(2, '0')}`;
      let salt = 1;
      while (allCats.some((c) => c.prefix === cleanPrefix)) {
        cleanPrefix = `CAT${String(nextNum + salt).padStart(2, '0')}`;
        salt++;
      }
    }

    const existing = db.select().from(categories).where(eq(categories.prefix, cleanPrefix)).get();
    if (existing) {
      res.status(400).json({ error: 'بادئة التصنيف مستخدمة مسبقاً' });
      return;
    }

    const newCategory = db.insert(categories).values({ name: cleanName, prefix: cleanPrefix }).returning().get();
    res.json({ success: true, category: newCategory });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'فشل إنشاء التصنيف' });
  }
});

// POST /api/items/bulk-categorize - Assign category to multiple items at once
itemsRouter.post('/items/bulk-categorize', async (req: Request, res: Response) => {
  try {
    const { itemIds, categoryId } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ error: 'يرجى اختيار صنف واحد على الأقل' });
      return;
    }

    const catId = categoryId ? Number(categoryId) : null;
    if (catId) {
      const category = db.select().from(categories).where(eq(categories.id, catId)).get();
      if (!category) {
        res.status(404).json({ error: 'التصنيف المحدد غير موجود' });
        return;
      }
    }

    const updateStmt = sqlite.prepare('UPDATE items SET category_id = ? WHERE id = ?');
    const transaction = sqlite.transaction(() => {
      for (const id of itemIds) {
        updateStmt.run(catId, Number(id));
      }
    });

    transaction();

    res.json({
      success: true,
      message: `تم تحديث تصنيف ${itemIds.length} صنف بنجاح`,
      updatedCount: itemIds.length,
    });
  } catch (error) {
    console.error('Error in bulk categorize:', error);
    res.status(500).json({ error: 'فشل التحديث الجماعي للتصنيف' });
  }
});

// =================== CENTRAL CATALOG ITEMS ===================

// GET /api/items - Central items list with category and unit
itemsRouter.get('/items', async (_req: Request, res: Response) => {
  try {
    const allItems = db
      .select({
        id: items.id,
        item_code: items.itemCode,
        name: items.name,
        category_id: items.categoryId,
        unit_id: items.unitId,
        min_limit_milli: items.minLimitMilli,
        created_at: items.createdAt,
        category_name: categories.name,
        category_prefix: categories.prefix,
        unit_name: units.name,
        unit_symbol: units.symbol,
      })
      .from(items)
      .leftJoin(categories, eq(items.categoryId, categories.id))
      .leftJoin(units, eq(items.unitId, units.id))
      .all();

    const result = allItems.map((it) => ({
      ...it,
      category_name: it.category_name || 'بدون تصنيف',
      category_prefix: it.category_prefix || 'ITEM',
      min_limit: fromMilli(it.min_limit_milli),
    }));

    res.json({ items: result });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'خطأ في جلب الأصناف المركزية' });
  }
});

// POST /api/items - Create item in central catalog with auto code [PREFIX]-0001
itemsRouter.post('/items', async (req: Request, res: Response) => {
  try {
    const { name, categoryId, unitId, minLimit, customCode } = req.body;

    if (!name || !unitId) {
      res.status(400).json({ error: 'يرجى إدخال اسم الصنف ووحدة القياس' });
      return;
    }

    let category = null;
    if (categoryId) {
      category = db.select().from(categories).where(eq(categories.id, Number(categoryId))).get();
    }

    const unit = db.select().from(units).where(eq(units.id, Number(unitId))).get();
    if (!unit) {
      res.status(400).json({ error: 'وحدة القياس المحددة غير موجودة' });
      return;
    }

    let itemCode = '';
    if (customCode && customCode.trim()) {
      itemCode = customCode.trim().toUpperCase();
    } else {
      // Auto sequential code by prefix: e.g. WOD-0001 or ITEM-0001
      const prefix = category ? category.prefix : 'ITEM';
      const allItemsWithPrefix = db
        .select()
        .from(items)
        .all()
        .filter((i) => i.itemCode.startsWith(`${prefix}-`));
      const nextSeq = allItemsWithPrefix.length + 1;
      itemCode = `${prefix}-${String(nextSeq).padStart(4, '0')}`;
      let salt = 1;
      while (db.select().from(items).where(eq(items.itemCode, itemCode)).get()) {
        itemCode = `${prefix}-${String(nextSeq + salt).padStart(4, '0')}`;
        salt++;
      }
    }

    // Verify code uniqueness
    const existing = db.select().from(items).where(eq(items.itemCode, itemCode)).get();
    if (existing) {
      res.status(400).json({ error: `كود الصنف ${itemCode} مستخدم مسبقاً` });
      return;
    }

    const minLimitMilli = toMilli(Number(minLimit) || 0);

    const newItem = db
      .insert(items)
      .values({
        itemCode,
        name: name.trim(),
        categoryId: category ? category.id : null,
        unitId: unit.id,
        minLimitMilli,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    res.json({
      success: true,
      message: 'تم إضافة الصنف للكتالوج المركزي بنجاح',
      item: {
        ...newItem,
        category_name: category?.name || 'بدون تصنيف',
        category_prefix: category?.prefix || 'ITEM',
        unit_name: unit.name,
        unit_symbol: unit.symbol,
        min_limit: fromMilli(newItem.minLimitMilli),
      },
    });
  } catch (error) {
    console.error('Error creating central item:', error);
    res.status(500).json({ error: 'فشل إضافة الصنف للكتالوج' });
  }
});

// =================== CUSTODY ITEMS LINKING ===================

// GET /api/custodies/:id/items - List items linked to a custody
itemsRouter.get('/custodies/:id/items', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);

    const linked = db
      .select({
        item_id: items.id,
        item_code: items.itemCode,
        name: items.name,
        category_id: items.categoryId,
        category_name: categories.name,
        unit_id: items.unitId,
        unit_name: units.name,
        unit_symbol: units.symbol,
        min_limit_milli: items.minLimitMilli,
      })
      .from(custodyItems)
      .innerJoin(items, eq(custodyItems.itemId, items.id))
      .leftJoin(categories, eq(items.categoryId, categories.id))
      .leftJoin(units, eq(items.unitId, units.id))
      .where(eq(custodyItems.custodyId, custodyId))
      .all();

    // Fetch total balance for this custody
    const result = linked.map((it) => {
      const balance = db
        .select({
          totalQty: sql<number>`sum(quantity_milli)`,
          totalReserved: sql<number>`sum(reserved_qty_milli)`,
        })
        .from(stockBalances)
        .where(and(eq(stockBalances.custodyId, custodyId), eq(stockBalances.itemId, it.item_id)))
        .get();

      const qtyMilli = balance?.totalQty || 0;
      const reservedMilli = balance?.totalReserved || 0;

      return {
        ...it,
        category_name: it.category_name || 'بدون تصنيف',
        min_limit: fromMilli(it.min_limit_milli),
        quantity: fromMilli(qtyMilli),
        reserved_qty: fromMilli(reservedMilli),
        available_qty: fromMilli(Math.max(0, qtyMilli - reservedMilli)),
      };
    });

    res.json({ items: result });
  } catch (error) {
    console.error('Error fetching custody items:', error);
    res.status(500).json({ error: 'خطأ في جلب أصناف العهدة' });
  }
});

// POST /api/custodies/:id/items - Link items to custody
itemsRouter.post('/custodies/:id/items', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { itemIds } = req.body; // array of item IDs

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ error: 'يرجى تحديد الأصناف المراد ربطها بالعهدة' });
      return;
    }

    const custody = db.select().from(custodies).where(eq(custodies.id, custodyId)).get();
    if (!custody) {
      res.status(404).json({ error: 'العهدة غير موجودة' });
      return;
    }

    let addedCount = 0;
    sqlite.transaction(() => {
      for (const id of itemIds) {
        const itemId = Number(id);
        const exists = db
          .select()
          .from(custodyItems)
          .where(and(eq(custodyItems.custodyId, custodyId), eq(custodyItems.itemId, itemId)))
          .get();

        if (!exists) {
          db.insert(custodyItems).values({ custodyId, itemId }).run();
          addedCount++;
        }
      }
    })();

    res.json({
      success: true,
      message: `تم ربط ${addedCount} صنف بالعهدة بنجاح`,
      addedCount,
    });
  } catch (error) {
    console.error('Error linking items:', error);
    res.status(500).json({ error: 'فشل ربط الأصناف بالعهدة' });
  }
});

// POST /api/custodies/:id/items/create - Directly create item and link to custody in one atomic action
itemsRouter.post('/custodies/:id/items/create', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { name, categoryId, unitId, minLimit, customCode } = req.body;

    if (!name || !categoryId || !unitId) {
      res.status(400).json({ error: 'يرجى استكمال البيانات الإلزامية للصنف (الاسم، التصنيف، الوحدة)' });
      return;
    }

    const custody = db.select().from(custodies).where(eq(custodies.id, custodyId)).get();
    if (!custody) {
      res.status(404).json({ error: 'العهدة غير موجودة' });
      return;
    }

    const category = db.select().from(categories).where(eq(categories.id, Number(categoryId))).get();
    if (!category) {
      res.status(400).json({ error: 'التصنيف المحدد غير موجود' });
      return;
    }

    const unit = db.select().from(units).where(eq(units.id, Number(unitId))).get();
    if (!unit) {
      res.status(400).json({ error: 'وحدة القياس المحددة غير موجودة' });
      return;
    }

    let itemCode = '';
    if (customCode && customCode.trim()) {
      itemCode = customCode.trim().toUpperCase();
    } else {
      const categoryItems = db.select().from(items).where(eq(items.categoryId, category.id)).all();
      const nextSeq = categoryItems.length + 1;
      itemCode = `${category.prefix}-${String(nextSeq).padStart(4, '0')}`;
    }

    const existing = db.select().from(items).where(eq(items.itemCode, itemCode)).get();
    if (existing) {
      res.status(400).json({ error: `كود الصنف ${itemCode} مستخدم مسبقاً` });
      return;
    }

    const minLimitMilli = toMilli(Number(minLimit) || 0);

    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();
      const newItem = db
        .insert(items)
        .values({
          itemCode,
          name: name.trim(),
          categoryId: category.id,
          unitId: unit.id,
          minLimitMilli,
          createdAt: now,
        })
        .returning()
        .get();

      db.insert(custodyItems)
        .values({
          custodyId,
          itemId: newItem.id,
        })
        .run();

      return newItem;
    });

    const createdItem = transaction();

    res.json({
      success: true,
      message: `تم إنشاء الصنف ${createdItem.itemCode} وربطه بالعهدة بنجاح`,
      item: {
        item_id: createdItem.id,
        item_code: createdItem.itemCode,
        name: createdItem.name,
        category_id: createdItem.categoryId,
        category_name: category.name,
        unit_id: createdItem.unitId,
        unit_name: unit.name,
        unit_symbol: unit.symbol,
        min_limit: fromMilli(createdItem.minLimitMilli),
        quantity: 0,
        reserved_qty: 0,
        available_qty: 0,
      },
    });
  } catch (error: any) {
    console.error('Error creating custody item:', error);
    res.status(500).json({ error: error.message || 'فشل إنشاء الصنف للعهدة' });
  }
});

// DELETE /api/custodies/:id/items/:itemId - Unlink item from custody (only if balance is 0)
itemsRouter.delete('/custodies/:id/items/:itemId', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const itemId = Number(req.params.itemId);

    // Verify balance is 0
    const balance = db
      .select({ total: sql<number>`sum(quantity_milli)` })
      .from(stockBalances)
      .where(and(eq(stockBalances.custodyId, custodyId), eq(stockBalances.itemId, itemId)))
      .get();

    if ((balance?.total || 0) > 0) {
      res.status(400).json({ error: 'لا يمكن فك ارتباط الصنف بالعهدة لوجود رصيد فعلي منه في المخازن' });
      return;
    }

    db.delete(custodyItems)
      .where(and(eq(custodyItems.custodyId, custodyId), eq(custodyItems.itemId, itemId)))
      .run();

    res.json({ success: true, message: 'تم فك ارتباط الصنف بالعهدة بنجاح' });
  } catch (error) {
    console.error('Error unlinking item:', error);
    res.status(500).json({ error: 'فشل فك ارتباط الصنف' });
  }
});

// =================== ITEM PROPOSALS CYCLE ===================

// GET /api/custodies/:id/proposals - List proposals for custody
itemsRouter.get('/custodies/:id/proposals', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const list = db
      .select({
        id: itemProposals.id,
        custody_id: itemProposals.custodyId,
        suggested_name: itemProposals.suggestedName,
        suggested_category_id: itemProposals.suggestedCategoryId,
        category_name: categories.name,
        category_prefix: categories.prefix,
        suggested_unit_id: itemProposals.suggestedUnitId,
        unit_name: units.name,
        unit_symbol: units.symbol,
        min_limit_milli: itemProposals.minLimitMilli,
        notes: itemProposals.notes,
        status: itemProposals.status,
        rejection_reason: itemProposals.rejectionReason,
        created_by: itemProposals.createdBy,
        created_at: itemProposals.createdAt,
      })
      .from(itemProposals)
      .leftJoin(categories, eq(itemProposals.suggestedCategoryId, categories.id))
      .leftJoin(units, eq(itemProposals.suggestedUnitId, units.id))
      .where(eq(itemProposals.custodyId, custodyId))
      .all();

    res.json({
      proposals: list.map((p) => ({
        ...p,
        min_limit: fromMilli(p.min_limit_milli),
      })),
    });
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({ error: 'خطأ في جلب مقترحات الأصناف' });
  }
});

// POST /api/custodies/:id/proposals - Storekeeper proposes new item
itemsRouter.post('/custodies/:id/proposals', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { suggestedName, suggestedCategoryId, suggestedUnitId, minLimit, notes, userId } = req.body;

    if (!suggestedName || !suggestedCategoryId || !suggestedUnitId) {
      res.status(400).json({ error: 'يرجى استكمال بيانات المقترح' });
      return;
    }

    const minLimitMilli = toMilli(Number(minLimit) || 0);

    const newProposal = db
      .insert(itemProposals)
      .values({
        custodyId,
        suggestedName: suggestedName.trim(),
        suggestedCategoryId: Number(suggestedCategoryId),
        suggestedUnitId: Number(suggestedUnitId),
        minLimitMilli,
        notes: notes ? notes.trim() : null,
        status: 'pending',
        createdBy: Number(userId) || 1,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    res.json({
      success: true,
      message: 'تم رفع مقترح الصنف بنجاح وبانتظار اعتماد رئيس القسم',
      proposal: newProposal,
    });
  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(500).json({ error: 'فشل تقديم مقترح الصنف' });
  }
});

// POST /api/proposals/:id/approve - Supervisor approves proposal -> auto creates central item & links to custody
itemsRouter.post('/proposals/:id/approve', async (req: Request, res: Response) => {
  try {
    const proposalId = Number(req.params.id);
    const { supervisorUserId } = req.body;

    const proposal = db.select().from(itemProposals).where(eq(itemProposals.id, proposalId)).get();
    if (!proposal || proposal.status !== 'pending') {
      res.status(400).json({ error: 'المقترح غير متاح للاعتماد' });
      return;
    }

    const category = db.select().from(categories).where(eq(categories.id, proposal.suggestedCategoryId)).get();
    if (!category) {
      res.status(400).json({ error: 'تصنيف المقترح غير موجود' });
      return;
    }

    // Atomic transaction: create item in central catalog, link to custody, mark proposal approved
    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();
      const catItems = db.select().from(items).where(eq(items.categoryId, category.id)).all();
      const nextSeq = catItems.length + 1;
      const itemCode = `${category.prefix}-${String(nextSeq).padStart(4, '0')}`;

      // Insert central item
      const newItem = db
        .insert(items)
        .values({
          itemCode,
          name: proposal.suggestedName,
          categoryId: proposal.suggestedCategoryId,
          unitId: proposal.suggestedUnitId,
          minLimitMilli: proposal.minLimitMilli,
          createdAt: now,
        })
        .returning()
        .get();

      // Link to custody
      db.insert(custodyItems)
        .values({
          custodyId: proposal.custodyId,
          itemId: newItem.id,
        })
        .run();

      // Update proposal
      db.update(itemProposals)
        .set({
          status: 'approved',
          reviewedBy: supervisorUserId ? Number(supervisorUserId) : null,
          reviewedAt: now,
        })
        .where(eq(itemProposals.id, proposal.id))
        .run();

      return newItem;
    });

    const approvedItem = transaction();

    res.json({
      success: true,
      message: `تم اعتماد المقترح وإدراج الصنف ${approvedItem.itemCode} بالكتالوج وربطه بالعهدة`,
      item: approvedItem,
    });
  } catch (error: any) {
    console.error('Error approving proposal:', error);
    res.status(500).json({ error: error.message || 'فشل اعتماد مقترح الصنف' });
  }
});

// POST /api/proposals/:id/reject - Supervisor rejects proposal with reason
itemsRouter.post('/proposals/:id/reject', async (req: Request, res: Response) => {
  try {
    const proposalId = Number(req.params.id);
    const { reason, supervisorUserId } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ error: 'يرجى توضيح سبب رفض المقترح' });
      return;
    }

    const proposal = db.select().from(itemProposals).where(eq(itemProposals.id, proposalId)).get();
    if (!proposal || proposal.status !== 'pending') {
      res.status(400).json({ error: 'المقترح غير متاح للرفض' });
      return;
    }

    db.update(itemProposals)
      .set({
        status: 'rejected',
        rejectionReason: reason.trim(),
        reviewedBy: supervisorUserId ? Number(supervisorUserId) : null,
        reviewedAt: new Date().toISOString(),
      })
      .where(eq(itemProposals.id, proposalId))
      .run();

    res.json({ success: true, message: 'تم رفض مقترح الصنف وتسجيل السبب' });
  } catch (error) {
    console.error('Error rejecting proposal:', error);
    res.status(500).json({ error: 'فشل رفض المقترح' });
  }
});

import { Router, Request, Response } from 'express';
import { db, sqlite } from '../db/index.ts';
import { custodies, warehouses, categories, units, items, custodyItems, stockBalances, movements, users, auditLogs } from '../db/schema.ts';
import { eq, and, sql, count } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { toMilli, fromMilli, formatTrxNumber } from '../../utils/rules.ts';

export const importRouter = Router();

// Validation helper for rows
interface ImportRow {
  rowNumber: number;
  itemName: string;
  categoryName: string;
  categoryPrefix?: string;
  unitName: string;
  unitSymbol?: string;
  initialQty: number;
  minLimit: number;
}

interface ValidationError {
  rowNumber: number;
  field: string;
  message: string;
}

// POST /api/custodies/:id/import/validate
importRouter.post('/:id/validate', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { rows } = req.body;

    const custody = db.select().from(custodies).where(eq(custodies.id, custodyId)).get();
    if (!custody) {
      res.status(404).json({ error: 'العهدة غير موجودة' });
      return;
    }

    if (custody.isInitialImportLocked) {
      res.status(400).json({
        error: 'الاستيراد التأسيسي مقفل نهائياً لهذه العهدة ولا يمكن إعادة استيراد أرصدة تأسيسية لها',
      });
      return;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'الملف فارغ أو لا يحتوي على أي صفوف صالحة' });
      return;
    }

    const errors: ValidationError[] = [];
    const validRows: ImportRow[] = [];
    const seenNames = new Set<string>();

    rows.forEach((r: any, idx: number) => {
      const rowNum = idx + 1;
      const itemName = String(r.itemName || r['اسم الصنف'] || '').trim();
      const categoryName = String(r.categoryName || r['التصنيف'] || '').trim();
      const unitName = String(r.unitName || r['وحدة القياس'] || '').trim();
      const qtyRaw = r.initialQty !== undefined ? r.initialQty : r['الكمية الافتتاحية'];
      const minLimitRaw = r.minLimit !== undefined ? r.minLimit : r['حد الأمان'];

      if (!itemName) {
        errors.push({ rowNumber: rowNum, field: 'itemName', message: 'اسم الصنف فارغ' });
      } else if (seenNames.has(itemName.toLowerCase())) {
        errors.push({ rowNumber: rowNum, field: 'itemName', message: `اسم الصنف "${itemName}" مكرر داخل الملف` });
      } else {
        seenNames.add(itemName.toLowerCase());
      }

      if (!categoryName) {
        errors.push({ rowNumber: rowNum, field: 'categoryName', message: 'التصنيف فارغ' });
      }

      if (!unitName) {
        errors.push({ rowNumber: rowNum, field: 'unitName', message: 'وحدة القياس فارغة' });
      }

      const initialQty = Number(qtyRaw);
      if (isNaN(initialQty) || initialQty < 0) {
        errors.push({ rowNumber: rowNum, field: 'initialQty', message: 'الكمية الافتتاحية يجب أن تكون رقماً موجباً أو صفراً' });
      }

      const minLimit = Number(minLimitRaw || 0);
      if (isNaN(minLimit) || minLimit < 0) {
        errors.push({ rowNumber: rowNum, field: 'minLimit', message: 'حد الأمان يجب أن يكون رقماً موجباً أو صفراً' });
      }

      if (itemName && categoryName && unitName && !isNaN(initialQty) && initialQty >= 0) {
        validRows.push({
          rowNumber: rowNum,
          itemName,
          categoryName,
          categoryPrefix: r.categoryPrefix ? String(r.categoryPrefix).trim().toUpperCase() : undefined,
          unitName,
          unitSymbol: r.unitSymbol ? String(r.unitSymbol).trim() : undefined,
          initialQty,
          minLimit,
        });
      }
    });

    const canImport = errors.length === 0 && validRows.length > 0;

    res.json({
      canImport,
      totalRows: rows.length,
      validCount: validRows.length,
      errorCount: errors.length,
      errors,
      previewRows: validRows.slice(0, 50),
    });
  } catch (error) {
    console.error('Error validating import:', error);
    res.status(500).json({ error: 'خطأ أثناء فحص وتدقيق سطور الملف' });
  }
});

// POST /api/custodies/:id/import/commit (All-or-Nothing atomic execution)
importRouter.post('/:id/commit', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { rows, adminPassword, adminUserId } = req.body;

    // Verify Admin Password
    const adminQuery = adminUserId ? eq(users.id, Number(adminUserId)) : eq(users.role, 'admin');
    const admin = db.select().from(users).where(adminQuery).get();
    if (!admin || !admin.passwordHash || !bcrypt.compareSync(adminPassword || '', admin.passwordHash)) {
      res.status(403).json({ error: 'تأكيد كلمة مرور مسؤول النظام غير صحيح' });
      return;
    }

    const custody = db.select().from(custodies).where(eq(custodies.id, custodyId)).get();
    if (!custody) {
      res.status(404).json({ error: 'العهدة غير موجودة' });
      return;
    }

    if (custody.isInitialImportLocked) {
      res.status(400).json({ error: 'الاستيراد التأسيسي مقفل نهائياً لهذه العهدة' });
      return;
    }

    const mainWarehouse = db
      .select()
      .from(warehouses)
      .where(and(eq(warehouses.custodyId, custodyId), eq(warehouses.isMain, true)))
      .get();

    if (!mainWarehouse) {
      res.status(400).json({ error: 'المخزن الرئيسي للعهدة غير موجود' });
      return;
    }

    // Atomic All-or-Nothing Transaction
    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();
      let importedCount = 0;
      let totalQtyMilli = 0;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const itemName = String(r.itemName).trim();
        const categoryName = String(r.categoryName).trim();
        const unitName = String(r.unitName).trim();
        const initialQty = Number(r.initialQty) || 0;
        const minLimit = Number(r.minLimit) || 0;

        // 1. Get or create Category
        let category = db.select().from(categories).where(eq(categories.name, categoryName)).get();
        if (!category) {
          const prefix = (r.categoryPrefix || categoryName.slice(0, 3)).toUpperCase().replace(/[^A-Z]/g, 'CAT') || 'GEN';
          // Ensure prefix unique
          let finalPrefix = prefix;
          let counter = 1;
          while (db.select().from(categories).where(eq(categories.prefix, finalPrefix)).get()) {
            finalPrefix = `${prefix}${counter}`;
            counter++;
          }
          category = db.insert(categories).values({ name: categoryName, prefix: finalPrefix }).returning().get();
        }

        // 2. Get or create Unit
        let unit = db.select().from(units).where(eq(units.name, unitName)).get();
        if (!unit) {
          const symbol = r.unitSymbol ? String(r.unitSymbol).trim() : unitName.slice(0, 2);
          unit = db.insert(units).values({ name: unitName, symbol }).returning().get();
        }

        // 3. Get or create Item in Central Catalog
        let item = db.select().from(items).where(eq(items.name, itemName)).get();
        if (!item) {
          const catItems = db.select().from(items).where(eq(items.categoryId, category.id)).all();
          const itemCode = `${category.prefix}-${String(catItems.length + 1).padStart(4, '0')}`;

          item = db
            .insert(items)
            .values({
              itemCode,
              name: itemName,
              categoryId: category.id,
              unitId: unit.id,
              minLimitMilli: toMilli(minLimit),
              createdAt: now,
            })
            .returning()
            .get();
        }

        // 4. Link item to custody
        const isLinked = db
          .select()
          .from(custodyItems)
          .where(and(eq(custodyItems.custodyId, custodyId), eq(custodyItems.itemId, item.id)))
          .get();

        if (!isLinked) {
          db.insert(custodyItems).values({ custodyId, itemId: item.id }).run();
        }

        // 5. If initial quantity > 0, seat in Main Warehouse of custody
        if (initialQty > 0) {
          const qtyMilli = toMilli(initialQty);
          totalQtyMilli += qtyMilli;

          const existingBalance = db
            .select()
            .from(stockBalances)
            .where(
              and(
                eq(stockBalances.custodyId, custodyId),
                eq(stockBalances.warehouseId, mainWarehouse.id),
                eq(stockBalances.itemId, item.id)
              )
            )
            .get();

          if (existingBalance) {
            db.update(stockBalances)
              .set({ quantityMilli: existingBalance.quantityMilli + qtyMilli })
              .where(
                and(
                  eq(stockBalances.custodyId, custodyId),
                  eq(stockBalances.warehouseId, mainWarehouse.id),
                  eq(stockBalances.itemId, item.id)
                )
              )
              .run();
          } else {
            db.insert(stockBalances)
              .values({
                custodyId,
                warehouseId: mainWarehouse.id,
                itemId: item.id,
                quantityMilli: qtyMilli,
                reservedQtyMilli: 0,
              })
              .run();
          }

          // Record opening movement
          const movCount = db.select({ value: count() }).from(movements).get();
          const trxNumber = formatTrxNumber((movCount?.value || 0) + 1);

          db.insert(movements)
            .values({
              trxNumber,
              custodyId,
              movementType: 'addition',
              status: 'executed',
              sourceWarehouseId: null,
              targetWarehouseId: mainWarehouse.id,
              itemId: item.id,
              quantityMilli: qtyMilli,
              notes: 'رصيد افتتاحي عبر الاستيراد التأسيسي للعهدة',
              createdBy: admin.id,
              createdAt: now,
              approvedBy: admin.id,
              approvedAt: now,
            })
            .run();
        }

        importedCount++;
      }

      // 6. Lock initial import permanently for this custody as mandated
      db.update(custodies)
        .set({ isInitialImportLocked: true })
        .where(eq(custodies.id, custodyId))
        .run();

      // 7. Audit Log
      db.insert(auditLogs)
        .values({
          userId: admin.id,
          userCode: admin.userCode,
          action: 'FOUNDATIONAL_IMPORT_COMMITTED',
          details: JSON.stringify({
            custodyId,
            importedCount,
            totalQtyMilli,
          }),
          createdAt: now,
        })
        .run();

      return { importedCount, totalQtyMilli };
    });

    const result = transaction();

    res.json({
      success: true,
      message: `تم اعتماد الاستيراد التأسيسي بنجاح: تم إدراج ${result.importedCount} صنف وتثبيت الأرصدة الافتتاحية وإقفال الاستيراد نهائياً للعهدة`,
      ...result,
    });
  } catch (error: any) {
    console.error('Error committing import:', error);
    res.status(500).json({ error: error.message || 'فشلت عملية حفظ وتأكيد الاستيراد' });
  }
});

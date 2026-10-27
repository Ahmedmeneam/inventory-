import { Router, Request, Response } from 'express';
import { db, sqlite } from '../db/index.ts';
import { custodies, warehouses, users, stockBalances, movements, auditLogs } from '../db/schema.ts';
import { eq, and, sql, sum } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const custodyRouter = Router();

// GET /api/custodies - List all custodies with main warehouse and user counts
custodyRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const allCustodies = db.select().from(custodies).all();

    const result = allCustodies.map((cust) => {
      // Find main warehouse
      const mainWarehouse = db
        .select()
        .from(warehouses)
        .where(and(eq(warehouses.custodyId, cust.id), eq(warehouses.isMain, true)))
        .get();

      // Find all warehouses for this custody
      const allWarehouses = db
        .select()
        .from(warehouses)
        .where(eq(warehouses.custodyId, cust.id))
        .all();

      // Count assigned staff
      const assignedUsers = db
        .select({
          id: users.id,
          user_code: users.userCode,
          full_name: users.fullName,
          role: users.role,
        })
        .from(users)
        .where(eq(users.custodyId, cust.id))
        .all();

      return {
        ...cust,
        main_warehouse_id: mainWarehouse?.id || null,
        main_warehouse_name: mainWarehouse?.name || null,
        warehouses: allWarehouses,
        users: assignedUsers,
        users_count: assignedUsers.length,
      };
    });

    res.json({ custodies: result });
  } catch (error) {
    console.error('Error fetching custodies:', error);
    res.status(500).json({ error: 'خطأ في جلب بيانات العهد' });
  }
});

// POST /api/custodies - Create new custody and automatically provision its Main Warehouse (is_main = true)
custodyRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { code, name } = req.body;

    if (!code || !name) {
      res.status(400).json({ error: 'يرجى إدخال رمز واسم العهدة' });
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (cleanCode.length < 2 || cleanCode.length > 8) {
      res.status(400).json({ error: 'رمز العهدة يجب أن يكون بين 2 إلى 8 أحرف إنجليزية' });
      return;
    }

    // Check code uniqueness
    const existing = db.select().from(custodies).where(eq(custodies.code, cleanCode)).get();
    if (existing) {
      res.status(400).json({ error: 'رمز العهدة مسجل مسبقاً، يرجى اختيار رمز آخر' });
      return;
    }

    // Atomic transaction: create custody + automatic main warehouse
    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();

      const newCustody = db
        .insert(custodies)
        .values({
          code: cleanCode,
          name: cleanName,
          status: 'active',
          isInitialImportLocked: false,
          createdAt: now,
        })
        .returning()
        .get();

      // Rule: Automatically create the custody's mandatory Main Warehouse
      const mainWarehouseName = `المخزن الرئيسي لعهدة ${cleanName}`;
      const newWarehouse = db
        .insert(warehouses)
        .values({
          name: mainWarehouseName,
          custodyId: newCustody.id,
          isMain: true,
          isGeneral: false,
          status: 'active',
          createdAt: now,
        })
        .returning()
        .get();

      // Audit log
      db.insert(auditLogs)
        .values({
          userId: null,
          userCode: 'SYSTEM',
          action: 'CUSTODY_CREATED',
          details: JSON.stringify({
            custodyId: newCustody.id,
            code: cleanCode,
            name: cleanName,
            mainWarehouseId: newWarehouse.id,
          }),
          createdAt: now,
        })
        .run();

      return {
        ...newCustody,
        main_warehouse_id: newWarehouse.id,
        main_warehouse_name: newWarehouse.name,
      };
    });

    const created = transaction();
    res.json({
      success: true,
      message: `تم إنشاء العهدة ومخزنها الرئيسي التلقائي بنجاح`,
      custody: created,
    });
  } catch (error: any) {
    console.error('Error creating custody:', error);
    res.status(500).json({ error: error.message || 'فشل إنشاء العهدة' });
  }
});

// POST /api/custodies/:id/archive - Archive custody with zero-balance validation
custodyRouter.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { adminPassword, adminUserId } = req.body;

    // Verify admin
    const adminQuery = adminUserId
      ? eq(users.id, Number(adminUserId))
      : eq(users.role, 'admin');
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

    // Check balances across all warehouses for this custody
    const balances = db
      .select({ totalMilli: sum(stockBalances.quantityMilli) })
      .from(stockBalances)
      .where(eq(stockBalances.custodyId, custodyId))
      .get();

    const totalStock = Number(balances?.totalMilli || 0);
    if (totalStock > 0) {
      res.status(400).json({
        error: `لا يمكن أرشفة العهدة لوجود رصيد متبقي قدره ${(totalStock / 1000).toFixed(3)} وحدة. يجب تصفير الرصيد أولاً بحركات معتمدة.`,
      });
      return;
    }

    // Check pending movements
    const pending = db
      .select()
      .from(movements)
      .where(and(eq(movements.custodyId, custodyId), eq(movements.status, 'pending_approval')))
      .all();

    if (pending.length > 0) {
      res.status(400).json({
        error: `لا يمكن أرشفة العهدة لوجود ${pending.length} طلبات معلقة بانتظار الاعتماد. يجب حسمها أولاً.`,
      });
      return;
    }

    db.update(custodies)
      .set({ status: 'archived' })
      .where(eq(custodies.id, custodyId))
      .run();

    db.insert(auditLogs)
      .values({
        userId: admin.id,
        userCode: admin.userCode,
        action: 'CUSTODY_ARCHIVED',
        details: JSON.stringify({ custodyId }),
        createdAt: new Date().toISOString(),
      })
      .run();

    res.json({ success: true, message: 'تم أرشفة العهدة بنجاح وتجميد حركاتها' });
  } catch (error) {
    console.error('Error archiving custody:', error);
    res.status(500).json({ error: 'فشل أرشفة العهدة' });
  }
});

// GET /api/custodies/:id/warehouses - List warehouses for custody
custodyRouter.get('/:id/warehouses', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const list = db
      .select()
      .from(warehouses)
      .where(eq(warehouses.custodyId, custodyId))
      .all();
    res.json({ warehouses: list });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ error: 'خطأ في جلب مخازن العهدة' });
  }
});

// POST /api/custodies/:id/warehouses - Add secondary warehouse to custody
custodyRouter.post('/:id/warehouses', async (req: Request, res: Response) => {
  try {
    const custodyId = Number(req.params.id);
    const { name } = req.body;

    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: 'يرجى إدخال اسم المخزن الفرعي' });
      return;
    }

    const custody = db.select().from(custodies).where(eq(custodies.id, custodyId)).get();
    if (!custody) {
      res.status(404).json({ error: 'العهدة غير موجودة' });
      return;
    }

    const newWarehouse = db
      .insert(warehouses)
      .values({
        name: name.trim(),
        custodyId,
        isMain: false,
        isGeneral: false,
        status: 'active',
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    res.json({
      success: true,
      message: 'تم إضافة المخزن الفرعي للعهدة بنجاح',
      warehouse: newWarehouse,
    });
  } catch (error) {
    console.error('Error adding warehouse:', error);
    res.status(500).json({ error: 'فشل إضافة المخزن الفرعي' });
  }
});

// GET /api/warehouses/all - List all warehouses in the system (for dropdowns and general management)
custodyRouter.get('/all/list', async (_req: Request, res: Response) => {
  try {
    const allWarehouses = db
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
      .all();

    res.json({ warehouses: allWarehouses });
  } catch (error) {
    console.error('Error fetching all warehouses:', error);
    res.status(500).json({ error: 'خطأ في جلب قائمة المخازن' });
  }
});

// POST /api/warehouses/general - Create general company warehouse
custodyRouter.post('/general', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: 'يرجى إدخال اسم المخزن العام' });
      return;
    }

    const newWarehouse = db
      .insert(warehouses)
      .values({
        name: name.trim(),
        custodyId: null,
        isMain: false,
        isGeneral: true,
        status: 'active',
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    res.json({
      success: true,
      message: 'تم إنشاء المخزن العام للشركة بنجاح',
      warehouse: newWarehouse,
    });
  } catch (error) {
    console.error('Error adding general warehouse:', error);
    res.status(500).json({ error: 'فشل إنشاء المخزن العام' });
  }
});

import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, sqlite } from '../db/index.ts';
import { companySettings, users, auditLogs } from '../db/schema.ts';
import { count, eq } from 'drizzle-orm';
import { validatePasswordStrength } from '../../utils/rules.ts';

export const setupRouter = Router();

// GET /api/setup/status
setupRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const settings = db.select().from(companySettings).get();
    const userCountResult = db.select({ value: count() }).from(users).get();
    const hasUsers = (userCountResult?.value || 0) > 0;

    if (!settings || !settings.isConfigured || !hasUsers) {
      res.json({
        isConfigured: false,
        hasAdmin: false,
      });
      return;
    }

    res.json({
      isConfigured: true,
      companyName: settings.companyName,
      hasAdmin: true,
    });
  } catch (error) {
    console.error('Error fetching setup status:', error);
    res.status(500).json({ error: 'خطأ في التحقق من حالة التهيئة' });
  }
});

// POST /api/setup/init
setupRouter.post('/init', async (req: Request, res: Response) => {
  try {
    const { companyName, adminName, adminEmail, password } = req.body;

    if (!companyName || companyName.trim().length < 2) {
      res.status(400).json({ error: 'يرجى إدخال اسم المنشأة / الشركة بشكل صحيح' });
      return;
    }

    if (!adminName || adminName.trim().length < 3) {
      res.status(400).json({ error: 'يرجى إدخال اسم مسؤول النظام ثلاثياً' });
      return;
    }

    const pwdCheck = validatePasswordStrength(password);
    if (!pwdCheck.valid) {
      res.status(400).json({ error: pwdCheck.message });
      return;
    }

    // Atomic transaction: verify it was not already configured
    const transaction = sqlite.transaction(() => {
      const existingSettings = db.select().from(companySettings).get();
      const existingUserCount = db.select({ value: count() }).from(users).get();

      if (existingSettings?.isConfigured && (existingUserCount?.value || 0) > 0) {
        throw new Error('النظام مهيأ بالفعل ولا يمكن تكرار معالج التهيئة');
      }

      const now = new Date().toISOString();
      const passwordHash = bcrypt.hashSync(password, 12);

      // Create or update company settings
      if (existingSettings) {
        db.update(companySettings)
          .set({
            companyName: companyName.trim(),
            adminEmail: adminEmail ? adminEmail.trim() : null,
            isConfigured: 1,
          })
          .where(eq(companySettings.id, existingSettings.id))
          .run();
      } else {
        db.insert(companySettings)
          .values({
            companyName: companyName.trim(),
            adminEmail: adminEmail ? adminEmail.trim() : null,
            isConfigured: 1,
            createdAt: now,
          })
          .run();
      }

      // Create First Admin user with code ADM-001
      const insertUser = db.insert(users)
        .values({
          userCode: 'ADM-001',
          fullName: adminName.trim(),
          phone: null,
          role: 'admin',
          custodyId: null,
          passwordHash: passwordHash,
          tempPasswordHash: null,
          tempPasswordExpiresAt: null,
          mustChangePassword: false,
          status: 'active',
          createdAt: now,
        })
        .returning()
        .get();

      // Log setup audit trail
      db.insert(auditLogs)
        .values({
          userId: insertUser.id,
          userCode: 'ADM-001',
          action: 'SETUP_INITIALIZED',
          details: JSON.stringify({
            companyName: companyName.trim(),
            adminName: adminName.trim(),
            adminEmail: adminEmail || null,
          }),
          ipAddress: req.ip || '127.0.0.1',
          createdAt: now,
        })
        .run();

      return insertUser;
    });

    const adminUser = transaction();

    res.json({
      success: true,
      message: 'تمت تهيئة النظام وتأسيس حساب مسؤول النظام بنجاح',
      user: {
        id: adminUser.id,
        user_code: adminUser.userCode,
        full_name: adminUser.fullName,
        role: adminUser.role,
        must_change_password: adminUser.mustChangePassword,
        status: adminUser.status,
      },
    });
  } catch (error: any) {
    console.error('Error in setup init:', error);
    res.status(400).json({ error: error.message || 'فشلت عملية تهيئة النظام' });
  }
});

// POST /api/setup/factory-reset - Securely reset database to 100% clean state for new company
setupRouter.post('/factory-reset', async (req: Request, res: Response) => {
  try {
    const { confirmationPhrase, adminPassword } = req.body;

    // Check security confirmation
    const validPhrase = confirmationPhrase && (
      confirmationPhrase.trim() === 'إعادة ضبط المصنع' ||
      confirmationPhrase.trim() === 'RESET-FACTORY' ||
      confirmationPhrase.trim() === 'تصفير النظام'
    );

    let isAuthorized = false;

    // If confirmation phrase is matched -> authorized
    if (validPhrase) {
      isAuthorized = true;
    } else if (adminPassword) {
      // Check if admin password is valid for the first admin
      const adminUser = db.select().from(users).where(eq(users.role, 'admin')).get();
      if (adminUser && adminUser.passwordHash) {
        const matches = bcrypt.compareSync(adminPassword, adminUser.passwordHash);
        if (matches) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      res.status(403).json({
        error: 'تصريح غير مقبول: يرجى كتابة عبارة التأكيد "إعادة ضبط المصنع" أو إدخال كلمة مرور مسؤول النظام للتأكيد الأمني.',
      });
      return;
    }

    // Atomic wipe of all application data
    const transaction = sqlite.transaction(() => {
      sqlite.exec(`
        DELETE FROM notifications;
        DELETE FROM audit_logs;
        DELETE FROM item_proposals;
        DELETE FROM inventory_counts;
        DELETE FROM inventory_sessions;
        DELETE FROM fiscal_closings;
        DELETE FROM movements;
        DELETE FROM delegation_rules;
        DELETE FROM stock_balances;
        DELETE FROM custody_items;
        DELETE FROM items;
        DELETE FROM categories;
        DELETE FROM warehouses;
        DELETE FROM users;
        DELETE FROM custodies;
        DELETE FROM company_settings;
        DELETE FROM sqlite_sequence;
      `);

      // Re-seed standard units (as per Clean Slate specifications)
      const standardUnits = [
        { name: 'قطعة', symbol: 'ق' },
        { name: 'كرتونة', symbol: 'كرتونة' },
        { name: 'كيلو جرام', symbol: 'كجم' },
        { name: 'جرام', symbol: 'جم' },
        { name: 'طن', symbol: 'طن' },
        { name: 'متر', symbol: 'م' },
        { name: 'متر مربع', symbol: 'م²' },
        { name: 'متر مكعب', symbol: 'م³' },
        { name: 'لتر', symbol: 'لتر' },
        { name: 'ملليلتر', symbol: 'مل' },
        { name: 'علبة', symbol: 'علبة' },
        { name: 'لفة / رول', symbol: 'لفة' },
        { name: 'برميل', symbol: 'برميل' },
        { name: 'شيكارة / كيس', symbol: 'شيكارة' },
        { name: 'لوح', symbol: 'لوح' },
        { name: 'دستة', symbol: 'دستة' },
        { name: 'زوج', symbol: 'زوج' },
        { name: 'حزمة', symbol: 'حزمة' },
        { name: 'طقم', symbol: 'طقم' },
        { name: 'عبوة', symbol: 'عبوة' },
      ];

      const insertUnit = sqlite.prepare('INSERT OR IGNORE INTO units (name, symbol) VALUES (?, ?)');
      for (const u of standardUnits) {
        insertUnit.run(u.name, u.symbol);
      }
    });

    transaction();

    res.json({
      success: true,
      message: 'تمت إعادة ضبط المصنع وتصفير قاعدة البيانات بالكامل بنجاح. النظام الآن في حالته النظيفة الأصلية وجاهز لمعالج التهيئة لشركة جديدة.',
    });
  } catch (error: any) {
    console.error('Error during factory reset:', error);
    res.status(500).json({ error: error.message || 'فشلت عملية إعادة ضبط المصنع' });
  }
});


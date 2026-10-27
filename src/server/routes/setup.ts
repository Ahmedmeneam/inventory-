import { Router, Request, Response } from 'express';
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

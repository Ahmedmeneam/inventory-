import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.ts';
import { users, custodies, auditLogs } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { validatePasswordStrength } from '../../utils/rules.ts';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { userCode, password } = req.body;

    if (!userCode || !password) {
      res.status(400).json({ error: 'يرجى إدخال كود المستخدم وكلمة المرور' });
      return;
    }

    const cleanCode = userCode.trim().toUpperCase();
    const user = db.select().from(users).where(eq(users.userCode, cleanCode)).get();

    if (!user) {
      res.status(401).json({ error: 'كود المستخدم أو كلمة المرور غير صحيحة' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ error: 'هذا الحساب موقوف إدارياً. يرجى مراجعة مسؤول النظام' });
      return;
    }

    let isValidPassword = false;
    let isUsingTempPassword = false;

    // Check permanent password if set
    if (user.passwordHash) {
      isValidPassword = bcrypt.compareSync(password, user.passwordHash);
    }

    // If permanent password didn't match or isn't set, check temporary password
    if (!isValidPassword && user.tempPasswordHash) {
      const isTempMatch = bcrypt.compareSync(password, user.tempPasswordHash);
      if (isTempMatch) {
        // Check expiration
        if (user.tempPasswordExpiresAt && new Date(user.tempPasswordExpiresAt) < new Date()) {
          res.status(401).json({ error: 'انتهت صلاحية كلمة المرور المؤقتة. يرجى مراجعة مسؤول النظام لإعادة إصدارها' });
          return;
        }
        isValidPassword = true;
        isUsingTempPassword = true;
      }
    }

    if (!isValidPassword) {
      res.status(401).json({ error: 'كود المستخدم أو كلمة المرور غير صحيحة' });
      return;
    }

    // Fetch custody details if linked
    let custodyInfo: { name: string; code: string } | null = null;
    if (user.custodyId) {
      const cust = db.select().from(custodies).where(eq(custodies.id, user.custodyId)).get();
      if (cust) {
        custodyInfo = { name: cust.name, code: cust.code };
      }
    }

    // Audit log
    db.insert(auditLogs).values({
      userId: user.id,
      userCode: user.userCode,
      action: 'USER_LOGIN',
      details: JSON.stringify({ isUsingTempPassword }),
      ipAddress: req.ip || '127.0.0.1',
      createdAt: new Date().toISOString(),
    }).run();

    res.json({
      success: true,
      user: {
        id: user.id,
        user_code: user.userCode,
        full_name: user.fullName,
        phone: user.phone,
        role: user.role,
        custody_id: user.custodyId,
        custody_name: custodyInfo?.name || null,
        custody_code: custodyInfo?.code || null,
        must_change_password: user.mustChangePassword || isUsingTempPassword,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'خطأ داخلي أثناء تسجيل الدخول' });
  }
});

// POST /api/auth/change-password (mandatory on first login or user initiated)
authRouter.post('/change-password', async (req: Request, res: Response) => {
  try {
    const { userId, newPassword, fullName, phone } = req.body;

    if (!userId || !newPassword) {
      res.status(400).json({ error: 'بيانات غير مكتملة' });
      return;
    }

    const pwdCheck = validatePasswordStrength(newPassword);
    if (!pwdCheck.valid) {
      res.status(400).json({ error: pwdCheck.message });
      return;
    }

    const user = db.select().from(users).where(eq(users.id, Number(userId))).get();
    if (!user) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }

    const newHash = bcrypt.hashSync(newPassword, 12);
    const updatedName = fullName && fullName.trim().length >= 3 ? fullName.trim() : user.fullName;
    const updatedPhone = phone !== undefined ? phone.trim() : user.phone;

    db.update(users)
      .set({
        passwordHash: newHash,
        tempPasswordHash: null,
        tempPasswordExpiresAt: null,
        mustChangePassword: false,
        status: 'active',
        fullName: updatedName,
        phone: updatedPhone,
      })
      .where(eq(users.id, user.id))
      .run();

    db.insert(auditLogs).values({
      userId: user.id,
      userCode: user.userCode,
      action: 'PASSWORD_CHANGED',
      details: JSON.stringify({ wasFirstLogin: user.mustChangePassword }),
      ipAddress: req.ip || '127.0.0.1',
      createdAt: new Date().toISOString(),
    }).run();

    res.json({
      success: true,
      message: 'تم تحديث كلمة المرور وتفعيل الحساب بنجاح',
      user: {
        id: user.id,
        user_code: user.userCode,
        full_name: updatedName,
        phone: updatedPhone,
        role: user.role,
        custody_id: user.custodyId,
        must_change_password: false,
        status: 'active',
      },
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'فشل تغيير كلمة المرور' });
  }
});

// POST /api/auth/verify-admin (verifies admin password for sensitive operations)
authRouter.post('/verify-admin', async (req: Request, res: Response) => {
  try {
    const { adminPassword, adminUserId } = req.body;
    if (!adminPassword) {
      res.status(400).json({ error: 'كلمة مرور الأدمن مطلوبة للتأكيد الأمني' });
      return;
    }

    const query = adminUserId
      ? eq(users.id, Number(adminUserId))
      : eq(users.role, 'admin');

    const admin = db.select().from(users).where(query).get();
    if (!admin || !admin.passwordHash) {
      res.status(403).json({ error: 'بيانات حساب الأدمن غير متوفرة' });
      return;
    }

    const isValid = bcrypt.compareSync(adminPassword, admin.passwordHash);
    if (!isValid) {
      res.status(403).json({ error: 'كلمة مرور الأدمن غير صحيحة' });
      return;
    }

    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('Admin verify error:', error);
    res.status(500).json({ error: 'فشل التحقق الأمني' });
  }
});

// POST /api/auth/verify-password (used to unlock idle screen lock)
authRouter.post('/verify-password', async (req: Request, res: Response) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password) {
      res.status(400).json({ error: 'بيانات التحقق غير مكتملة' });
      return;
    }

    const user = db.select().from(users).where(eq(users.id, Number(userId))).get();
    if (!user) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }

    let isValid = false;
    if (user.passwordHash) {
      isValid = bcrypt.compareSync(password, user.passwordHash);
    }
    if (!isValid && user.tempPasswordHash) {
      isValid = bcrypt.compareSync(password, user.tempPasswordHash);
    }

    if (!isValid) {
      res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      return;
    }

    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ error: 'فشل التحقق من كلمة المرور' });
  }
});

// GET /api/auth/me
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const userIdHeader = req.headers['x-user-id'] || req.query.userId;
    if (!userIdHeader) {
      res.status(401).json({ error: 'غير مسجل الدخول' });
      return;
    }

    const userId = Number(userIdHeader);
    const user = db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) {
      res.status(401).json({ error: 'المستخدم غير موجود' });
      return;
    }

    let custodyInfo = null;
    if (user.custodyId) {
      custodyInfo = db.select().from(custodies).where(eq(custodies.id, user.custodyId)).get();
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        user_code: user.userCode,
        full_name: user.fullName,
        phone: user.phone,
        role: user.role,
        custody_id: user.custodyId,
        custody_name: custodyInfo?.name || null,
        custody_code: custodyInfo?.code || null,
        must_change_password: user.mustChangePassword,
        status: user.status,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'فشل استرجاع بيانات المستخدم' });
  }
});


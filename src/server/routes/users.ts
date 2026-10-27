import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.ts';
import { users, custodies, auditLogs } from '../db/schema.ts';
import { eq, and, sql, not } from 'drizzle-orm';
import { generateTemporaryPassword } from '../../utils/rules.ts';

export const usersRouter = Router();

// GET /api/users - List users for management
usersRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const allUsers = db
      .select({
        id: users.id,
        user_code: users.userCode,
        full_name: users.fullName,
        phone: users.phone,
        role: users.role,
        custody_id: users.custodyId,
        must_change_password: users.mustChangePassword,
        status: users.status,
        created_at: users.createdAt,
        temp_password_expires_at: users.tempPasswordExpiresAt,
        custody_name: custodies.name,
      })
      .from(users)
      .leftJoin(custodies, eq(users.custodyId, custodies.id))
      .all();

    res.json({ users: allUsers });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'خطأ في جلب بيانات المستخدمين' });
  }
});

// POST /api/users - Create new employee / supervisor with secure temporary credentials
usersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { fullName, role, custodyId, adminPassword, adminUserId } = req.body;

    if (!fullName || !role) {
      res.status(400).json({ error: 'يرجى استكمال البيانات المطلوبة (الاسم والدور)' });
      return;
    }

    if (!['supervisor', 'storekeeper'].includes(role)) {
      res.status(400).json({ error: 'نوع الدور غير صالح' });
      return;
    }

    // Verify Admin Password before granting credential creation
    const adminQuery = adminUserId
      ? eq(users.id, Number(adminUserId))
      : eq(users.role, 'admin');

    const admin = db.select().from(users).where(adminQuery).get();
    if (!admin || !admin.passwordHash || !bcrypt.compareSync(adminPassword || '', admin.passwordHash)) {
      res.status(403).json({ error: 'تأكيد كلمة مرور مسؤول النظام غير صحيح أو مفقود' });
      return;
    }

    // Determine custody
    let assignedCustodyName = '';
    if (custodyId) {
      const cust = db.select().from(custodies).where(eq(custodies.id, Number(custodyId))).get();
      if (!cust) {
        res.status(400).json({ error: 'العهدة المحددة غير موجودة' });
        return;
      }
      assignedCustodyName = cust.name;
    }

    // Generate unique sequential user code: MGR-001 or EMP-001
    const prefix = role === 'supervisor' ? 'MGR' : 'EMP';
    const roleUsers = db.select().from(users).where(eq(users.role, role)).all();
    const nextSeq = roleUsers.length + 1;
    const userCode = `${prefix}-${String(nextSeq).padStart(3, '0')}`;

    // Generate transient random temporary password
    const plainTempPassword = generateTemporaryPassword();
    const tempPasswordHash = bcrypt.hashSync(plainTempPassword, 12);

    // Expiry: 48 hours from now
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const newUser = db.insert(users)
      .values({
        userCode,
        fullName: fullName.trim(),
        phone: null,
        role,
        custodyId: custodyId ? Number(custodyId) : null,
        passwordHash: null, // No permanent password until first login
        tempPasswordHash,   // Hashed strictly!
        tempPasswordExpiresAt: expiresAt,
        mustChangePassword: true,
        status: 'pending_first_login',
        createdAt: now,
      })
      .returning()
      .get();

    // Audit log
    db.insert(auditLogs).values({
      userId: admin.id,
      userCode: admin.userCode,
      action: 'USER_CREATED',
      details: JSON.stringify({
        createdUserCode: userCode,
        role,
        custodyId,
      }),
      ipAddress: req.ip || '127.0.0.1',
      createdAt: now,
    }).run();

    // Return the plain temporary password strictly for the 120-second modal
    res.json({
      success: true,
      user: {
        id: newUser.id,
        user_code: newUser.userCode,
        full_name: newUser.fullName,
        role: newUser.role,
        custody_id: newUser.custodyId,
        custody_name: assignedCustodyName,
        status: newUser.status,
      },
      credentials: {
        user_code: newUser.userCode,
        temp_password: plainTempPassword, // transient only!
        expires_at: expiresAt,
        employee_name: newUser.fullName,
        role: newUser.role,
        custody_name: assignedCustodyName,
      },
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message || 'فشل إنشاء حساب المستخدم' });
  }
});

// POST /api/users/:id/reissue-temp-password - Re-issue temporary credentials
usersRouter.post('/:id/reissue-temp-password', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const { adminPassword, adminUserId } = req.body;

    // Verify Admin Password
    const adminQuery = adminUserId
      ? eq(users.id, Number(adminUserId))
      : eq(users.role, 'admin');

    const admin = db.select().from(users).where(adminQuery).get();
    if (!admin || !admin.passwordHash || !bcrypt.compareSync(adminPassword || '', admin.passwordHash)) {
      res.status(403).json({ error: 'تأكيد كلمة مرور مسؤول النظام غير صحيح' });
      return;
    }

    const targetUser = db.select().from(users).where(eq(users.id, userId)).get();
    if (!targetUser) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }

    // Generate brand new temporary password
    const plainTempPassword = generateTemporaryPassword();
    const tempPasswordHash = bcrypt.hashSync(plainTempPassword, 12);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    db.update(users)
      .set({
        passwordHash: null,
        tempPasswordHash,
        tempPasswordExpiresAt: expiresAt,
        mustChangePassword: true,
        status: 'pending_first_login',
      })
      .where(eq(users.id, userId))
      .run();

    let custodyName = '';
    if (targetUser.custodyId) {
      const cust = db.select().from(custodies).where(eq(custodies.id, targetUser.custodyId)).get();
      if (cust) custodyName = cust.name;
    }

    db.insert(auditLogs).values({
      userId: admin.id,
      userCode: admin.userCode,
      action: 'USER_TEMP_PASSWORD_REISSUED',
      details: JSON.stringify({ targetUserCode: targetUser.userCode }),
      ipAddress: req.ip || '127.0.0.1',
      createdAt: new Date().toISOString(),
    }).run();

    res.json({
      success: true,
      credentials: {
        user_code: targetUser.userCode,
        temp_password: plainTempPassword,
        expires_at: expiresAt,
        employee_name: targetUser.fullName,
        role: targetUser.role,
        custody_name: custodyName,
      },
    });
  } catch (error) {
    console.error('Re-issue temp password error:', error);
    res.status(500).json({ error: 'فشلت عملية إعادة إصدار كلمة المرور المؤقتة' });
  }
});

// PUT /api/users/:id/profile - Update user profile (name, phone)
usersRouter.put('/:id/profile', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const { fullName, phone } = req.body;

    if (!fullName || !fullName.trim()) {
      res.status(400).json({ error: 'الاسم الثلاثي مطلوب' });
      return;
    }

    const targetUser = db.select().from(users).where(eq(users.id, userId)).get();
    if (!targetUser) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }

    db.update(users)
      .set({
        fullName: fullName.trim(),
        phone: phone ? phone.trim() : null,
      })
      .where(eq(users.id, userId))
      .run();

    res.json({
      success: true,
      message: 'تم تحديث البيانات الشخصية بنجاح',
      user: {
        id: targetUser.id,
        user_code: targetUser.userCode,
        full_name: fullName.trim(),
        phone: phone ? phone.trim() : null,
        role: targetUser.role,
        custody_id: targetUser.custodyId,
        status: targetUser.status,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'فشل تحديث بيانات الملف الشخصي' });
  }
});


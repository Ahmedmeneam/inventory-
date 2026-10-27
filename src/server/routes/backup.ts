import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db, sqlite } from '../db/index.ts';
import { users, custodies, warehouses, items, movements, auditLogs, inventorySessions, fiscalClosings } from '../db/schema.ts';
import { eq, desc, sql, count } from 'drizzle-orm';

export const backupRouter = Router();

const DB_DIR = path.resolve(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DB_DIR, 'backups');
const DB_PATH = path.join(DB_DIR, 'warehouse_v67.db');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Encryption helpers
const ENCRYPTION_MAGIC = 'WH_V67_ENC_V1';

function encryptBuffer(buffer: Buffer, secretKey: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  // Derive 256-bit key using scrypt
  const key = crypto.scryptSync(secretKey, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const payload = {
    magic: ENCRYPTION_MAGIC,
    version: '6.7',
    createdAt: new Date().toISOString(),
    sha256,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
    data: encrypted.toString('base64'),
  };

  return JSON.stringify(payload);
}

function decryptBuffer(encryptedJson: string, secretKey: string): Buffer {
  let parsed: any;
  try {
    parsed = JSON.parse(encryptedJson);
  } catch (e) {
    throw new Error('ملف النسخة الاحتياطية غير صالح أو تالف');
  }

  if (parsed.magic !== ENCRYPTION_MAGIC) {
    throw new Error('تنسيق ملف النسخة الاحتياطية غير معتمد لنظام الإصدار 6.7');
  }

  const salt = Buffer.from(parsed.salt, 'hex');
  const iv = Buffer.from(parsed.iv, 'hex');
  const tag = Buffer.from(parsed.tag, 'hex');
  const encryptedData = Buffer.from(parsed.data, 'base64');

  const key = crypto.scryptSync(secretKey, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted: Buffer;
  try {
    decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  } catch (err) {
    throw new Error('كلمة مرور فك التشفير الرئيسية غير صحيحة أو تم التلاعب بملف النسخة');
  }

  // Verify SHA-256 hash
  const computedHash = crypto.createHash('sha256').update(decrypted).digest('hex');
  if (computedHash !== parsed.sha256) {
    throw new Error('فشل فحص سلامة الملف (SHA-256 Checksum Mismatch) - تم رفض الاستعادة');
  }

  return decrypted;
}

// GET /api/backup/stats - System health and database metrics
backupRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    let dbSizeBytes = 0;
    let walSizeBytes = 0;

    if (fs.existsSync(DB_PATH)) {
      dbSizeBytes = fs.statSync(DB_PATH).size;
    }
    const walPath = `${DB_PATH}-wal`;
    if (fs.existsSync(walPath)) {
      walSizeBytes = fs.statSync(walPath).size;
    }

    // Counts
    const usersCount = db.select({ count: count() }).from(users).get()?.count || 0;
    const custodiesCount = db.select({ count: count() }).from(custodies).get()?.count || 0;
    const warehousesCount = db.select({ count: count() }).from(warehouses).get()?.count || 0;
    const itemsCount = db.select({ count: count() }).from(items).get()?.count || 0;
    const movementsCount = db.select({ count: count() }).from(movements).get()?.count || 0;
    const inventoryCount = db.select({ count: count() }).from(inventorySessions).get()?.count || 0;
    const closingsCount = db.select({ count: count() }).from(fiscalClosings).get()?.count || 0;

    // Check last backup file
    let lastBackup: { name: string; date: string; sizeBytes: number } | null = null;
    if (fs.existsSync(BACKUPS_DIR)) {
      const files = fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.endsWith('.db') || f.endsWith('.enc'))
        .sort((a, b) => fs.statSync(path.join(BACKUPS_DIR, b)).mtimeMs - fs.statSync(path.join(BACKUPS_DIR, a)).mtimeMs);

      if (files.length > 0) {
        const latestFile = path.join(BACKUPS_DIR, files[0]);
        const stat = fs.statSync(latestFile);
        lastBackup = {
          name: files[0],
          date: stat.mtime.toISOString(),
          sizeBytes: stat.size,
        };
      }
    }

    res.json({
      success: true,
      stats: {
        dbSizeBytes,
        walSizeBytes,
        totalSizeBytes: dbSizeBytes + walSizeBytes,
        records: {
          users: usersCount,
          custodies: custodiesCount,
          warehouses: warehousesCount,
          items: itemsCount,
          movements: movementsCount,
          inventorySessions: inventoryCount,
          fiscalClosings: closingsCount,
        },
        lastBackup,
      },
    });
  } catch (error: any) {
    console.error('Backup stats error:', error);
    res.status(500).json({ error: 'فشل استرجاع إحصائيات النظام' });
  }
});

// GET /api/backup/local-list - List existing local backups
backupRouter.get('/local-list', async (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      res.json({ backups: [] });
      return;
    }

    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.db') || f.endsWith('.enc'))
      .map(file => {
        const filePath = path.join(BACKUPS_DIR, file);
        const stat = fs.statSync(filePath);
        return {
          filename: file,
          isEncrypted: file.endsWith('.enc'),
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ backups: files });
  } catch (error) {
    console.error('Local backups list error:', error);
    res.status(500).json({ error: 'فشل قراءة النسخ الاحتياطية المحلية' });
  }
});

// POST /api/backup/local - Create atomic local snapshot
backupRouter.post('/local', async (req: Request, res: Response) => {
  try {
    const { adminPassword, adminUserId } = req.body;

    // Verify Admin Password
    const adminQuery = adminUserId ? eq(users.id, Number(adminUserId)) : eq(users.role, 'admin');
    const admin = db.select().from(users).where(adminQuery).get();

    if (!admin || !admin.passwordHash || !bcrypt.compareSync(adminPassword || '', admin.passwordHash)) {
      res.status(403).json({ error: 'تأكيد كلمة مرور مسؤول النظام غير صحيح' });
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `warehouse_backup_${timestamp}.db`;
    const backupFilePath = path.join(BACKUPS_DIR, backupFileName);

    // Use SQLite online backup API
    await sqlite.backup(backupFilePath);
    const stat = fs.statSync(backupFilePath);

    // Audit log
    db.insert(auditLogs).values({
      userId: admin.id,
      userCode: admin.userCode,
      action: 'BACKUP_LOCAL_CREATED',
      details: JSON.stringify({ filename: backupFileName, sizeBytes: stat.size }),
      ipAddress: req.ip || '127.0.0.1',
      createdAt: new Date().toISOString(),
    }).run();

    res.json({
      success: true,
      message: 'تم إنشاء النسخة الاحتياطية المحلية بنجاح',
      backup: {
        filename: backupFileName,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Create local backup error:', error);
    res.status(500).json({ error: error.message || 'فشل إنشاء النسخة الاحتياطية المحلية' });
  }
});

// POST /api/backup/export-encrypted - Export AES-256-GCM encrypted backup package
backupRouter.post('/export-encrypted', async (req: Request, res: Response) => {
  try {
    const { adminPassword, masterPassword, adminUserId } = req.body;

    if (!masterPassword || masterPassword.length < 8) {
      res.status(400).json({ error: 'كلمة المرور الرئيسية للتشفير يجب ألا تقل عن 8 خانات' });
      return;
    }

    // Verify Admin Password
    const adminQuery = adminUserId ? eq(users.id, Number(adminUserId)) : eq(users.role, 'admin');
    const admin = db.select().from(users).where(adminQuery).get();

    if (!admin || !admin.passwordHash || !bcrypt.compareSync(adminPassword || '', admin.passwordHash)) {
      res.status(403).json({ error: 'تأكيد كلمة مرور مسؤول النظام غير صحيح' });
      return;
    }

    // Create a temporary consistent snapshot first
    const tempSnapshotPath = path.join(BACKUPS_DIR, `temp_${Date.now()}.db`);
    await sqlite.backup(tempSnapshotPath);

    const dbBuffer = fs.readFileSync(tempSnapshotPath);
    // Remove temp file
    fs.unlinkSync(tempSnapshotPath);

    // Encrypt the database buffer with master password
    const encryptedJson = encryptBuffer(dbBuffer, masterPassword);

    // Save copy in backups folder as well
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const encFileName = `warehouse_encrypted_${timestamp}.enc`;
    fs.writeFileSync(path.join(BACKUPS_DIR, encFileName), encryptedJson, 'utf-8');

    // Audit log
    db.insert(auditLogs).values({
      userId: admin.id,
      userCode: admin.userCode,
      action: 'BACKUP_ENCRYPTED_EXPORTED',
      details: JSON.stringify({ filename: encFileName }),
      ipAddress: req.ip || '127.0.0.1',
      createdAt: new Date().toISOString(),
    }).run();

    res.json({
      success: true,
      filename: encFileName,
      content: encryptedJson,
      message: 'تم تشفير وتوليد ملف النسخة الاحتياطية بنجاح',
    });
  } catch (error: any) {
    console.error('Export encrypted backup error:', error);
    res.status(500).json({ error: error.message || 'فشل تصدير النسخة الاحتياطية المشفرة' });
  }
});

// POST /api/backup/restore - Conditional restore from encrypted package or local snapshot
backupRouter.post('/restore', async (req: Request, res: Response) => {
  try {
    const { adminPassword, masterPassword, encryptedContent, localFilename, adminUserId } = req.body;

    if (!adminPassword) {
      res.status(400).json({ error: 'كلمة مرور الأدمن مطلوبة للتأكيد الأمني الحازم' });
      return;
    }

    // 1. Strictly verify Admin credentials
    const adminQuery = adminUserId ? eq(users.id, Number(adminUserId)) : eq(users.role, 'admin');
    const admin = db.select().from(users).where(adminQuery).get();

    if (!admin || !admin.passwordHash || !bcrypt.compareSync(adminPassword, admin.passwordHash)) {
      res.status(403).json({ error: 'كلمة مرور مسؤول النظام غير صحيحة - تم إلغاء الاستعادة' });
      return;
    }

    let restoredBuffer: Buffer;

    if (encryptedContent) {
      if (!masterPassword) {
        res.status(400).json({ error: 'كلمة المرور الرئيسية لفك التشفير مطلوبة' });
        return;
      }
      // Decrypt and verify checksum
      restoredBuffer = decryptBuffer(encryptedContent, masterPassword);
    } else if (localFilename) {
      const targetLocal = path.join(BACKUPS_DIR, path.basename(localFilename));
      if (!fs.existsSync(targetLocal)) {
        res.status(404).json({ error: 'ملف النسخة المحلية المحدد غير موجود' });
        return;
      }

      if (targetLocal.endsWith('.enc')) {
        if (!masterPassword) {
          res.status(400).json({ error: 'كلمة المرور الرئيسية لفك التشفير مطلوبة للملفات المشفرة' });
          return;
        }
        const encData = fs.readFileSync(targetLocal, 'utf-8');
        restoredBuffer = decryptBuffer(encData, masterPassword);
      } else {
        restoredBuffer = fs.readFileSync(targetLocal);
      }
    } else {
      res.status(400).json({ error: 'يرجى تقديم محتوى ملف النسخة المشفر أو تحديد ملف محلي' });
      return;
    }

    // 2. Perform SQLite integrity test on the restored buffer in temporary file
    const testDbPath = path.join(BACKUPS_DIR, `test_integrity_${Date.now()}.db`);
    fs.writeFileSync(testDbPath, restoredBuffer);

    let isIntegrityOk = false;
    try {
      const Database = (await import('better-sqlite3')).default;
      const testDb = new Database(testDbPath);
      const integrityCheck = testDb.pragma('integrity_check') as any[];
      testDb.close();
      if (integrityCheck && integrityCheck[0]?.integrity_check === 'ok') {
        isIntegrityOk = true;
      }
    } catch (e: any) {
      console.error('Integrity check error:', e);
    } finally {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    }

    if (!isIntegrityOk) {
      res.status(400).json({ error: 'فشل فحص سلامة قاعدة البيانات (Corrupted SQLite Database) - تم رفض الاستعادة' });
      return;
    }

    // 3. Take emergency safety backup of current database before overwriting
    const emergencyBackupPath = path.join(BACKUPS_DIR, `emergency_pre_restore_${Date.now()}.db`);
    try {
      await sqlite.backup(emergencyBackupPath);
    } catch (e) {
      console.error('Emergency backup error:', e);
    }

    // 4. Overwrite main database atomically
    // Close current wal or checkpoint
    try {
      sqlite.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
      // ignore
    }

    fs.writeFileSync(DB_PATH, restoredBuffer);
    // Clear wal file if exists
    const walPath = `${DB_PATH}-wal`;
    if (fs.existsSync(walPath)) {
      try {
        fs.unlinkSync(walPath);
      } catch (e) {
        // ignore
      }
    }

    // 5. Audit log in the newly restored database
    try {
      db.insert(auditLogs).values({
        userId: admin.id,
        userCode: admin.userCode,
        action: 'DATABASE_RESTORED',
        details: JSON.stringify({
          source: localFilename ? `local: ${localFilename}` : 'encrypted_upload',
          timestamp: new Date().toISOString(),
        }),
        ipAddress: req.ip || '127.0.0.1',
        createdAt: new Date().toISOString(),
      }).run();
    } catch (e) {
      console.error('Audit log after restore error:', e);
    }

    res.json({
      success: true,
      message: 'تم استعادة قاعدة البيانات والتحقق من سلامتها بنجاح',
    });
  } catch (error: any) {
    console.error('Restore error:', error);
    res.status(500).json({ error: error.message || 'فشلت عملية استعادة النسخة الاحتياطية' });
  }
});

// GET /api/backup/audit-logs - Query audit trail
backupRouter.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const actionFilter = req.query.action ? String(req.query.action) : null;

    let query = db.select().from(auditLogs);
    if (actionFilter) {
      query = query.where(eq(auditLogs.action, actionFilter)) as any;
    }

    const logs = query.orderBy(desc(auditLogs.createdAt)).limit(limit).all();

    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    console.error('Audit logs query error:', error);
    res.status(500).json({ error: 'فشل جلب سجلات التدقيق والرقابة' });
  }
});

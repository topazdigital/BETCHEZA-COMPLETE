# Betcheza — Production Deployment Guide

## Quick summary

Your production server is a DirectAdmin VPS running PM2 + Nginx.
The app lives at `/home/admin/apps/betcheza/`.

---

## 1. Fix the git conflict and deploy new code

The last `git pull` failed because `package-lock.json` had local changes.
Run these commands via SSH (copy & paste the whole block):

```bash
cd /home/admin/apps/betcheza

# Discard the local package-lock.json change (safe — npm will regenerate it)
git checkout -- package-lock.json

# Pull the latest code from GitHub
git pull origin main

# Install any new/changed dependencies
npm install --legacy-peer-deps

# Build the Next.js app
npm run build

# Restart with the new build (PM2 keeps it live during restart)
pm2 restart betcheza --update-env

# Check it came back up
pm2 status
pm2 logs betcheza --lines 30
```

---

## 2. Create the missing MySQL tables

Run this on the server via the MySQL CLI (avoids phpMyAdmin timeouts):

```bash
mysql -u admin_betcheza -p'YOUR_DB_PASSWORD' admin_betcheza
```

Then paste **Statement 1** and press Enter:

```sql
CREATE TABLE IF NOT EXISTS `admin_settings` (
  `name`        VARCHAR(100) NOT NULL,
  `value`       LONGTEXT,
  `type`        VARCHAR(50)  NOT NULL DEFAULT 'string',
  `description` TEXT,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Then paste **Statement 2** and press Enter:

```sql
CREATE TABLE IF NOT EXISTS `daily_strategy` (
  `id`            INT(11)      NOT NULL AUTO_INCREMENT,
  `date`          DATE         NOT NULL,
  `week_id`       VARCHAR(10)  NOT NULL,
  `day_number`    TINYINT(4)   NOT NULL,
  `stake`         INT(11)      NOT NULL,
  `save_amount`   INT(11)      NOT NULL DEFAULT 0,
  `target_win`    INT(11)      NOT NULL,
  `combined_odds` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `status`        ENUM('upcoming','active','completed') NOT NULL DEFAULT 'upcoming',
  `result`        ENUM('win','loss') DEFAULT NULL,
  `actual_return` DECIMAL(12,2) DEFAULT NULL,
  `picks`         LONGTEXT     DEFAULT NULL,
  `generated_at`  TIMESTAMP    NULL DEFAULT NULL,
  `posted_at`     TIMESTAMP    NULL DEFAULT NULL,
  `settled_at`    TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_date` (`date`),
  KEY `idx_week_id` (`week_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Type `exit` to leave MySQL.

### Alternative: one-liner (no interactive prompt)

```bash
mysql -u admin_betcheza -p'YOUR_DB_PASSWORD' admin_betcheza \
  -e "CREATE TABLE IF NOT EXISTS \`admin_settings\` (\`name\` VARCHAR(100) NOT NULL, \`value\` LONGTEXT, \`type\` VARCHAR(50) NOT NULL DEFAULT 'string', \`description\` TEXT, \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (\`name\`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"

mysql -u admin_betcheza -p'YOUR_DB_PASSWORD' admin_betcheza \
  -e "CREATE TABLE IF NOT EXISTS \`daily_strategy\` (\`id\` INT(11) NOT NULL AUTO_INCREMENT, \`date\` DATE NOT NULL, \`week_id\` VARCHAR(10) NOT NULL, \`day_number\` TINYINT(4) NOT NULL, \`stake\` INT(11) NOT NULL, \`save_amount\` INT(11) NOT NULL DEFAULT 0, \`target_win\` INT(11) NOT NULL, \`combined_odds\` DECIMAL(8,2) NOT NULL DEFAULT 0.00, \`status\` ENUM('upcoming','active','completed') NOT NULL DEFAULT 'upcoming', \`result\` ENUM('win','loss') DEFAULT NULL, \`actual_return\` DECIMAL(12,2) DEFAULT NULL, \`picks\` LONGTEXT DEFAULT NULL, \`generated_at\` TIMESTAMP NULL DEFAULT NULL, \`posted_at\` TIMESTAMP NULL DEFAULT NULL, \`settled_at\` TIMESTAMP NULL DEFAULT NULL, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_date\` (\`date\`), KEY \`idx_week_id\` (\`week_id\`), KEY \`idx_status\` (\`status\`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
```

---

## 3. Seed PayHero credentials into the database

After creating `admin_settings`, run:

```sql
INSERT INTO admin_settings (name, value, type, description) VALUES
  ('payhero_token',      'Basic YOUR_PAYHERO_BASIC_TOKEN',  'string', 'PayHero Basic auth token'),
  ('payhero_account_id', 'YOUR_PAYHERO_ACCOUNT_ID',         'string', 'PayHero channel_id')
ON DUPLICATE KEY UPDATE value = VALUES(value);
```

Replace the placeholders with your real values from the `.env` file.

---

## 4. Environment variables (.env on server)

Make sure `/home/admin/apps/betcheza/.env` (or PM2 ecosystem file) has:

```
JWT_SECRET=your_jwt_secret
PAYHERO_BASIC_TOKEN=Basic xxxxxxxxxxxxxxxx
PAYHERO_ACCOUNT_ID=12345
FOOTBALL_DATA_API_KEY=your_key
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@betcheza.co.ke
```

After editing `.env`, always run `pm2 restart betcheza --update-env`.

---

## 5. Deploying future updates (routine)

```bash
cd /home/admin/apps/betcheza
git pull origin main
npm install --legacy-peer-deps
npm run build
pm2 restart betcheza --update-env
```

Or use the included `deploy.sh`:

```bash
bash /home/admin/apps/betcheza/deploy.sh
```

---

## 6. Useful PM2 commands

```bash
pm2 status                        # see all processes
pm2 logs betcheza --lines 50      # last 50 log lines
pm2 restart betcheza --update-env # restart + reload .env
pm2 stop betcheza                 # stop without removing
pm2 delete betcheza               # remove from PM2
pm2 start npm --name betcheza -- start  # re-add if deleted
```

---

## 7. GitHub → Server push workflow

1. Make changes locally / on Replit
2. Commit & push to GitHub (`git push origin main`)
3. SSH into the server and run the "routine update" block above (Step 5)

There is **no CI/CD pipeline** yet — it's a manual pull. If you want auto-deploy on push, add a GitHub Actions workflow that SSHes into the server and runs `deploy.sh`.

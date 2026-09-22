# AWS Setup Guide — ES Print Media Inc. Portal

This guide walks through setting up AWS for the portal. Do these steps
in order. When done, fill the values into `.env.local` and set
`AUTH_DEV_MODE=false`.

**Region:** Use `ap-southeast-1` (Singapore) — closest to the Philippines.

---

## 0. Create AWS Account
1. Go to https://aws.amazon.com and click **Create an AWS Account**.
2. Provide email, card (won't be charged during free tier), and phone verification.
3. Choose the **Basic Support - Free** plan.
4. Once in, set your region to **Asia Pacific (Singapore) ap-southeast-1** (top-right dropdown).

### FIRST THING — Set a Billing Alert
Prevents surprise charges.
1. Console → search **Billing and Cost Management** → **Budgets**.
2. **Create budget** → Template → **Monthly cost budget**.
3. Set amount to `$10`. Add your email for alerts.
4. Save. You'll get an email if usage approaches the limit.

---

## 1. RDS PostgreSQL (Database)

1. Console → **RDS** → **Create database**.
2. Choose:
   - Engine: **PostgreSQL** (version 16.x)
   - Template: **Free tier**
   - DB instance identifier: `esprint-portal-db`
   - Master username: `portal_admin`
   - Master password: (set a strong one — save it)
   - Instance: `db.t3.micro` (free tier) — upgrade to `db.t4g.small` later
   - Storage: 20 GB gp3
   - **Public access: Yes** (needed for local dev; lock down later)
3. Under **Additional configuration**:
   - Initial database name: `esprint_portal`
4. Create. Wait ~5-10 minutes for status = Available.
5. Click the DB → **Connectivity & security** → copy the **Endpoint**.
6. **Security group**: click the VPC security group → Inbound rules →
   Add rule → Type: PostgreSQL, Source: **My IP** (for dev).

### Fill into .env.local:
```
DATABASE_URL=postgresql://portal_admin:YOUR_PASSWORD@ENDPOINT:5432/esprint_portal
DB_SSL=true
```

### Load the schema
Once connected, run the SQL files in order (via psql, DBeaver, or pgAdmin):
1. `db/schema/00_portal_core.sql`
2. `db/schema/01_check_monitoring.sql`

---

## 2. Cognito (Login / Authentication)

1. Console → **Cognito** → **Create user pool**.
2. Sign-in options: **Email**.
3. Password policy: Cognito defaults are fine.
4. MFA: **No MFA** for now (can enable later).
5. Self-service sign-up: **Disable** (admins create users).
6. Email: **Send email with Cognito** (for dev; use SES later).
7. App client:
   - App type: **Public client**
   - Name: `esprint-portal-web`
   - **Enable USER_PASSWORD_AUTH** auth flow (Authentication flows section)
8. Create.
9. Note the **User Pool ID** and **App client ID**.

### Add custom attributes (for roles)
User pool → **Sign-up experience** → **Custom attributes** → Add:
- `portal_role` (String) — values: `super_admin` or `user`
- `access` (String, max 2048) — JSON of module access array

### Fill into .env.local:
```
COGNITO_REGION=ap-southeast-1
COGNITO_USER_POOL_ID=ap-southeast-1_XXXXXXXXX
COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
AUTH_DEV_MODE=false
```

### Create your first admin user
User pool → **Users** → **Create user**:
- Email: your admin email
- Set `custom:portal_role` = `super_admin`
- Set a temporary password

---

## 3. S3 (File Storage)

1. Console → **S3** → **Create bucket**.
2. Bucket name: `esprint-portal-files` (must be globally unique — add a suffix if taken).
3. Region: **ap-southeast-1**.
4. **Block all public access: KEEP ON** (files served via presigned URLs).
5. Create.

### Fill into .env.local:
```
S3_REGION=ap-southeast-1
S3_BUCKET=esprint-portal-files
```

For local dev, create an IAM user with S3 access and put its keys in
`.env.local`. In production (Amplify), attach an IAM role instead.

---

## 4. Amplify (Hosting) — do this LAST, after the app works locally

1. Push the `esprint-portal` code to a GitHub repo.
2. Console → **Amplify** → **Create new app** → **Host web app**.
3. Connect your GitHub repo + branch.
4. Amplify auto-detects Next.js. Accept defaults.
5. Add environment variables (same as `.env.local`, but `AUTH_DEV_MODE=false`).
6. Deploy. You'll get a `xxx.amplifyapp.com` URL.
7. (Optional) Add your custom domain under **Domain management**.

---

## Checklist — What to send back once done

Fill these and we plug them in:

```
[ ] RDS endpoint: ______________________________________
[ ] RDS master password saved securely
[ ] Schema loaded (00_portal_core.sql + 01_check_monitoring.sql)
[ ] Cognito User Pool ID: _______________________________
[ ] Cognito App Client ID: ______________________________
[ ] Custom attributes added (portal_role, access)
[ ] First super_admin user created
[ ] S3 bucket name: _____________________________________
[ ] Billing alert set at $10
```

Once RDS + Cognito are ready, we flip `AUTH_DEV_MODE=false`, plug in the
values, and the portal runs on real AWS — no code changes needed.

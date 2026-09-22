# On-Premise / Hybrid Deployment Plan — ES Print Media Inc. Portal

> **Status:** Reference plan. Hindi pa ginagawa. Ito ang gabay kung
> sakaling magdesisyon kayong mag-on-prem (buo o hybrid) sa hinaharap.
>
> **Default plan pa rin ngayon:** Pure AWS (tingnan ang `AWS_SETUP_GUIDE.md`).
> Basahin lang ito kung lilipat sa on-prem para bumaba ang monthly cost.

---

## 1. Bakit Mag-On-Prem?

| Dahilan | Paliwanag |
|---|---|
| Mas mababang monthly cost | ~$9/month vs ~$44-52/month sa pure AWS |
| Data privacy | Ang sensitive data (HR, checks) ay nananatili sa opisina |
| Mabilis para sa office users | Local network — walang internet round-trip |
| Libre ang AI | Ollama tumatakbo sa sariling server, walang per-token bayad |

**Kailan HINDI dapat mag-on-prem:**
- Walang dedicated IT na mag-mamaintain ng server
- Madalas ang brownout at walang UPS
- Karamihan ng users ay remote (bahay/field)

---

## 2. Hybrid Architecture (Recommended kung mag-on-prem)

Ang pinaka-praktikal — hindi 100% on-prem, hindi 100% cloud:

```
ON-PREMISE (Main Office Server/PC):        AWS CLOUD:
├── PostgreSQL 16 (database)                ├── Amplify (portal hosting)
├── Ollama + Llama 3.1 8B (AI chatbot)      ├── Cognito (login/auth)
├── MinIO (file storage — S3-compatible)    └── (off-site backup copy — optional)
└── Local daily backup

CONNECTION:
Office users  → LAN → on-prem portal + database + files (mabilis)
Remote users  → Cloudflare Tunnel → on-prem portal (browser lang, walang app)
```

**Remote access = Cloudflare Tunnel (recommended).** Ang portal + database
+ files ay nasa parehong on-prem server. Ang users ay nag-a-access lang ng
portal (website) — hindi direkta ng database. Kaya Cloudflare Tunnel ang
tamang solusyon: browser-based, walang VPN app na i-install sa 620 users.

**Ang mananatili sa AWS:** hosting + auth (mura ang mga ito).
**Ang ililipat sa on-prem:** database + AI + file storage (mahal sa AWS).

> **Full on-prem option:** Puwede ring buong on-prem — kasama ang hosting
> (Nginx + Node) at auth (Keycloak/Authentik). Pero mas simple kung
> hosting + auth ay AWS pa rin, storage/DB/AI lang ang on-prem.

---

## 3. Hardware Requirements

### Option A — Mini PC (minimum, ~$400-600)
- Intel NUC / Beelink / Minisforum
- 32GB RAM
- 1TB NVMe SSD
- Kaya: PostgreSQL + Llama 3.1 8B (small model)

### Option B — Small Tower PC (recommended, ~$700-1,000)
- Ryzen 5 / Intel i5
- 32GB RAM
- 2TB NVMe SSD (database + MinIO files) + external HDD for backups
- **UPS (~$150)** — para hindi mag-down kapag brownout
- Kaya: PostgreSQL + Ollama + MinIO file storage

> **Storage sizing:** Ang 2TB SSD ay hahatiin — database (maliit lang,
> ~20-50GB kahit years of data) + MinIO files (documents, check images,
> machine photos). Kung malaki ang files, dagdagan ng 4TB+ HDD para sa
> MinIO. Mas mura kaysa AWS S3 na per-GB monthly bayad.

### Option C — Refurbished Server (best long-term, ~$800-1,200)
- Dell PowerEdge R430 / HP ProLiant (used)
- 64GB RAM, 2TB SSD, RAID para sa redundancy
- Kaya: lahat, may room to grow

---

## 4. Software Setup Steps

### Step 1 — Operating System
```
Ubuntu Server 24.04 LTS (recommended — libre, stable)
o Windows Server kung mas pamilyar ang IT team
```

### Step 2 — Install PostgreSQL 16
```bash
sudo apt update
sudo apt install postgresql-16
sudo -u postgres createdb esprint_portal
sudo -u postgres createuser portal_admin --pwprompt
```
Then load the schema:
```bash
psql -U portal_admin -d esprint_portal -f db/schema/00_portal_core.sql
psql -U portal_admin -d esprint_portal -f db/schema/01_check_monitoring.sql
```

### Step 3 — Install Ollama (AI chatbot)
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b          # main chat model
ollama pull qwen2.5:7b           # better for translations
ollama serve                     # runs on localhost:11434
```

### Step 4 — Install MinIO (on-prem file storage, S3-compatible)
MinIO ay libre at open-source na storage na **S3-compatible** — ibig
sabihin, ang parehong code na gumagana sa AWS S3 ay gagana sa MinIO
nang walang babaguhin (endpoint lang).

```bash
# Install MinIO server
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# Create storage folder (dito mapupunta ang mga files)
sudo mkdir -p /data/minio

# Set admin credentials
export MINIO_ROOT_USER=esprint_admin
export MINIO_ROOT_PASSWORD=your-strong-password

# Run MinIO (console sa :9001, API sa :9000)
minio server /data/minio --console-address ":9001"
```

Then create the bucket via the MinIO console (http://server-ip:9001):
- Bucket name: `esprint-portal-files` (same name as the S3 plan)
- Access policy: private (files served via presigned URLs, same as S3)

**Storage capacity:** limited lang sa laki ng SSD/HDD ng server.
- 2TB SSD = 2TB storage (vs AWS S3 na per-GB bayad)
- Puwedeng dagdagan ng external HDD/RAID kung kulang

**Run MinIO as a service (auto-start on boot):**
```bash
sudo tee /etc/systemd/system/minio.service > /dev/null <<'EOF'
[Unit]
Description=MinIO
After=network.target
[Service]
User=minio
Environment="MINIO_ROOT_USER=esprint_admin"
Environment="MINIO_ROOT_PASSWORD=your-strong-password"
ExecStart=/usr/local/bin/minio server /data/minio --console-address ":9001"
Restart=always
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now minio
```

### Step 5 — Remote Access via Cloudflare Tunnel (RECOMMENDED)

Ang Cloudflare Tunnel ang pinaka-magandang paraan para ma-access ng remote
users (trainees, field technicians, work-from-home) ang portal — **walang
VPN app na kailangan i-install sa bawat user**. Browser lang.

**Bakit Cloudflare Tunnel (hindi VPN client):**
- Walang app sa 620 users — website access lang via `https://portal.yourdomain.com`
- Walang open firewall ports — ang server ay HINDI naka-expose sa internet
  (ang `cloudflared` agent ang lumalabas papuntang Cloudflare)
- Libreng automatic HTTPS/SSL
- Kasamang DDoS protection

**PRESYO — LIBRE para sa setup natin (walang user limit):**

| Component | Presyo | Limit |
|---|---|---|
| Cloudflare Tunnel (`cloudflared`) | **LIBRE** | Walang user/bandwidth limit |
| HTTPS/SSL + DDoS protection | **LIBRE** | Kasama na |
| Domain name (kung wala pa) | ~$10-15/year | — |

> **IMPORTANTE — bakit walang 50-user limit sa atin:**
>
> Ang Cloudflare Tunnel mismo ay LIBRE at WALANG user limit. Ang tunnel ay
> "daan" lang papasok sa portal — ang PORTAL MISMO (via Cognito/sariling
> login) ang nag-a-authenticate ng users, hindi ang Cloudflare.
>
> Ang may 50-user free limit ay ang **Cloudflare Access** (isang optional
> na login gate na inilalagay SA HARAP ng portal). **HINDI natin ito
> kailangan** dahil may sariling login system na ang portal. Kaya:
>
> ```
> Setup natin:
> User → Cloudflare Tunnel (daan lang, LIBRE, walang limit)
>      → Portal (dito nag-lo-login via Cognito)
>      → On-prem server
>
> Result: LIBRE para sa lahat ng 620 users.
> ```
>
> Gamitin lang ang Cloudflare Access (na may 50-user free cap, then
> $7/user/month) kung gusto mo ng EXTRA login gate bago pa mabuksan ang
> portal — pero redundant na ito dahil may login na ang portal.

**Setup:**
```bash
# 1. Sa on-prem server, install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/

# 2. Login sa Cloudflare account (kailangan may domain sa Cloudflare)
cloudflared tunnel login

# 3. Gumawa ng tunnel
cloudflared tunnel create esprint-portal

# 4. I-point ang domain sa tunnel
cloudflared tunnel route dns esprint-portal portal.esprint.com

# 5. Ituro ang tunnel sa local portal (nakatakbo sa localhost:3000)
cloudflared tunnel run --url http://localhost:3000 esprint-portal

# 6. (Optional) Run as service para auto-start on boot
sudo cloudflared service install
```

**Result:** `https://portal.esprint.com` → accessible kahit saan, secure,
walang VPN app. Ang office users ay puwede ring gamitin ito, o direct LAN
para mas mabilis.

**Flow:**
```
Remote user → https://portal.esprint.com
            → Cloudflare network
            → cloudflared tunnel (encrypted)
            → on-prem portal (localhost:3000)
            → on-prem database (local, sa parehong server)
```

---

### Step 5b — Alternatibo: Tailscale VPN (kung ayaw ng Cloudflare)

Gamitin lang ito kung kailangan ng **direktang database access** mula remote
(hal. IT admin na gumagamit ng pgAdmin/DBeaver mula bahay), o kung ayaw
gumamit ng Cloudflare. Kailangan ng app install per device.

```bash
# Sa on-prem server:
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# I-install din sa device ng IT admin na kailangan ng direct DB access.
# Regular users — HINDI kailangan; gamitin ang Cloudflare Tunnel sa taas.
```

### Step 6 — Automated daily backup
```bash
# Cron job — araw-araw mag-backup ng database + files
# 1. Database dump
0 2 * * * pg_dump esprint_portal | gzip > /backup/db_$(date +\%F).sql.gz
# 2. Sync MinIO files to a backup drive (or off-site)
0 3 * * * rsync -a /data/minio/ /backup/minio/
# 3. (Optional) off-site copy to AWS S3 for disaster recovery
0 4 * * * aws s3 sync /backup/ s3://esprint-offsite-backup/ 
```

> **Importante:** Mag-backup sa HIWALAY na drive (o off-site) — hindi sa
> parehong SSD ng MinIO. Kung masira ang main drive, safe pa ang backup.

---

## 5. Ano ang Babaguhin sa Portal Code

Ang portal ay **AWS-ready pero madaling i-repoint sa on-prem** dahil
naka-env var lahat ng connection. Ito lang ang babaguhin sa `.env.local`:

```bash
# ── DATABASE: ituro sa on-prem PostgreSQL ──
# Local (office): direct connection
DATABASE_URL=postgresql://portal_admin:PASSWORD@192.168.1.x:5432/esprint_portal
DB_SSL=false                  # local network, no SSL needed

# O kung via Tailscale VPN:
DATABASE_URL=postgresql://portal_admin:PASSWORD@100.x.x.x:5432/esprint_portal

# ── AI: ituro sa on-prem Ollama ──
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://192.168.1.x:11434/v1
OLLAMA_MODEL=llama3.1:8b

# ── FILE STORAGE: ituro sa on-prem MinIO (S3-compatible) ──
# Same code as AWS S3 — endpoint lang ang dagdag.
S3_ENDPOINT=http://192.168.1.x:9000     # MinIO API endpoint
S3_REGION=us-east-1                      # MinIO ignores this, any value OK
S3_BUCKET=esprint-portal-files
S3_FORCE_PATH_STYLE=true                 # required for MinIO
AWS_ACCESS_KEY_ID=esprint_admin          # MinIO root user
AWS_SECRET_ACCESS_KEY=your-strong-password

# ── Auth: puwedeng manatili sa Cognito, o palitan ──
# Kung gusto full on-prem auth, palitan ng self-hosted
# (Keycloak/Authentik) — pero mas simple kung Cognito pa rin.
```

**Walang code rewrite** — env config lang. Ang `lib/db.ts` ay gumagana na
sa kahit anong PostgreSQL (RDS o on-prem). Ang S3 client ay gagana sa
MinIO kapag na-set ang `S3_ENDPOINT` + `S3_FORCE_PATH_STYLE=true`. Ang
chatbot ay may Ollama support na.

> **Note para sa storage layer:** Kapag binuo na ang S3 file-upload code
> (`lib/storage.ts`), gawing configurable ang endpoint:
> ```ts
> new S3Client({
>   region: process.env.S3_REGION,
>   endpoint: process.env.S3_ENDPOINT || undefined,  // MinIO or AWS
>   forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
> })
> ```
> Ganito — parehong code gagana sa AWS S3 (walang endpoint) at MinIO
> (may endpoint). Walang if-else na hardcoded.

---

## 6. Cost Comparison

| Setup | Monthly | Hardware (one-time) | Break-even |
|---|---|---|---|
| Pure AWS | ~$44-52 | $0 | — |
| Hybrid (on-prem DB+AI+storage) | ~$9 | $500-1,000 | 12-21 months |

**Ano ang kasama sa ~$9/month ng hybrid:**
| Item | Cost |
|---|---|
| Electricity (server 24/7) | ~$5-8/month |
| Cloudflare Tunnel (remote access) | **LIBRE** |
| MinIO (file storage) | **LIBRE** (SSD ng server lang) |
| Ollama (AI) | **LIBRE** (server lang) |
| PostgreSQL (database) | **LIBRE** (open-source) |
| Domain name | ~$1/month ($10-15/year) |
| AWS (Amplify hosting + Cognito auth, kung hybrid) | ~$0-3/month |

**3-year total:**
- Pure AWS: ~$1,600-1,900
- Hybrid: ~$800-1,300 (kasama ang hardware)
- **Savings: ~$600-900 over 3 years**

> Ang malaking tipid sa hybrid — LIBRE na ang remote access (Cloudflare
> Tunnel), file storage (MinIO), at AI (Ollama). Electricity + domain lang
> ang recurring cost. Ang AWS charges (RDS, S3, data transfer) ay tinatanggal.

---

## 7. Risks at Mitigations

| Risk | Solusyon |
|---|---|
| Brownout → server down | UPS (~$150) + auto-restart on power |
| Server hardware fails | Daily S3 backup — restore agad sa bagong PC |
| Walang IT sa opisina | Managed by isang tao + remote support (Tailscale sa IT device) |
| Remote users can't connect | Cloudflare Tunnel — browser access, walang app install |
| VM na 1TB mafull | HINDI gagamitin ang lumang VM — bagong dedicated PC |

---

## 8. Migration Path (kung magdesisyon mag-hybrid later)

```
Phase 1: Portal live muna sa Pure AWS (kasalukuyang plano)
         └── Gumagana, may users na, stable

Phase 2: Bumili ng on-prem PC + i-setup
         ├── Install PostgreSQL + load schema
         ├── I-migrate ang data: pg_dump mula RDS → restore sa on-prem
         ├── Install Ollama + MinIO
         └── Setup Cloudflare Tunnel (remote access)

Phase 3: I-repoint ang portal (env var lang)
         ├── DATABASE_URL → on-prem
         ├── AI_PROVIDER → ollama
         └── I-test ng maigi bago i-cutover

Phase 4: Panatilihin ang AWS para sa:
         ├── Amplify (hosting — accessible kahit saan)
         ├── Cognito (auth)
         └── S3 (off-site DB/file backup — optional, disaster recovery)

Note: File storage ay MinIO na (on-prem). Ang AWS S3 ay
      backup destination na lang, hindi na primary storage.
```

---

## 9. Decision Checklist — Bago Mag-On-Prem

```
[ ] May dedicated IT staff ba na mag-mamaintain?
[ ] May stable na kuryente + UPS ba?
[ ] Handa ba bumili ng $500-1,000 hardware?
[ ] Ilan ang remote users? (kung marami → Cloudflare Tunnel — walang app needed)
[ ] May domain ba sa Cloudflare? (kailangan para sa Cloudflare Tunnel)
[ ] Worth ba ang ~$600-900 savings over 3 years
    kumpara sa dagdag na maintenance effort?

Kung "Oo" sa karamihan → mag-hybrid.
Kung "Hindi" → manatili sa Pure AWS.
```

---

**Summary:** Ang portal ay disenyo na **portable** — env config lang ang
kailangan baguhin para lumipat sa on-prem. Walang code rewrite. Kaya
puwede kayong magsimula sa Pure AWS ngayon, at kung magbago ang isip
niyo later, madali lang ang paglipat sa hybrid.

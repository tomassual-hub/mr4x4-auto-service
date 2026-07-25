# Multi-Device Backend Setup (Supabase)

Follow these steps, then send me the two values from Step 5. I'll wire the app up to them from there.

## 1. Create a Supabase account
Go to [supabase.com](https://supabase.com) and sign up (GitHub login is fastest, or use email).

## 2. Create a new project
- Click **New Project**.
- **Name**: `mr4x4-auto-service` (or anything you like).
- **Database Password**: generate/save one — you likely won't need it day-to-day (the app won't use it directly), but keep it somewhere safe in case you ever need direct database access.
- **Region**: pick the one closest to you (e.g. Singapore, for Malaysia).
- Click **Create new project** and wait ~2 minutes for it to provision.

## 3. Run the schema
- In the left sidebar, open **SQL Editor**.
- Click **New query**.
- Open `backend/schema.sql` (in this same folder), copy all of it, paste into the SQL editor.
- Click **Run**. You should see "Success. No rows returned."

This creates all the tables (customers, jobs, invoices, inventory, etc.), turns on Row Level Security, and enables realtime sync.

## 4. Add staff logins
- In the left sidebar, open **Authentication → Users**.
- Click **Add user** → **Create new user**.
- Enter an email and password for each staff member who needs to log in (e.g. Encik Razak, Amirul). Untick "Auto Confirm User" only if you want them to verify by email first — for a small workshop, ticking **Auto Confirm** is simplest.
- Do this once per staff member. You can add more later the same way.

(I'll help you link each of these to a staff name/role in the app once the code side is connected.)

## 5. Get your API credentials
- In the left sidebar, open **Project Settings → API**.
- Copy these two values and send them to me:
  - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
  - **anon public** key (a long string under "Project API keys")

**Do not send me the `service_role` / `secret` key** — that one bypasses all security rules and should never leave Supabase's dashboard. The `anon public` key is the one meant to be used in the app itself; Row Level Security (already set up by the schema) is what keeps it safe.

---

Once I have the URL and anon key, I'll update the app to read/write through Supabase instead of local storage, add live sync between devices, and add a one-time "push my existing local data to the cloud" button so nothing you've already entered gets lost.

# DigiDecide Real Estate

Land verification and marketplace for Andhra Pradesh, served at realestate.digidecide.in.
This is phases 1–3 of the roadmap: accounts with roles, buyer, seller, admin and reviewer
dashboards, property listing and search, and photo, video and document uploads.

The earlier Estate Enquiries broker workspace now lives at `/enquiries/`.
Its saved records are unchanged because they are stored in the browser for this same site.

## Folders

- `app/` — the React source (Vite + TypeScript)
- `supabase/schema.sql` — database tables, security rules and storage buckets
- `index.html`, `404.html`, `assets/` — the built site that GitHub Pages serves (generated, do not edit)
- `enquiries/` — the old Estate Enquiries app

## Connect Supabase (one time)

1. Create a new project at supabase.com. Pick the Mumbai region.
2. Open **SQL Editor > New query**, paste all of `supabase/schema.sql`, and select **Run**.
3. Open **Authentication > URL Configuration**. Set **Site URL** to `https://realestate.digidecide.in`
   and add `https://realestate.digidecide.in/**` under **Redirect URLs**.
4. Open **Project Settings > API**. Copy the **Project URL** and the **anon public** key into
   `app/src/config.ts` (`URL_FROM_PROJECT` and `ANON_KEY_FROM_PROJECT`).
5. Rebuild and publish (below).
6. Sign up on the site, then make yourself admin in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

Until step 4 is done, the site runs in preview mode with clearly marked sample listings.

## Build and publish

```sh
cd app
npm install
npm run build
npm run deploy   # copies the build to the repository root
cd ..
git add -A && git commit -m "Publish site" && git push
```

## Roles

- **Buyer** and **seller** choose their role at sign-up.
- **Admin**, **lawyer** and **land surveyor** are given by an admin in the Users tab.
- Sellers cannot approve, feature or set the verification result of their own listings; the
  database enforces this. Editing a live listing sends it back for review.
- Land documents are private: only the seller, admins and the lawyer or surveyor assigned to that
  property can open them.

## Not built yet

AI document extraction, the automated twelve-point workflow, PDF reports, payments (Razorpay),
WhatsApp and email notifications, and government record integrations are later roadmap phases.
Maps use OpenStreetMap for now; switching to Google Maps needs a Google Maps API key.

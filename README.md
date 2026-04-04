# Community AI

Teacher-first community MVP built as a monorepo with:

- `apps/web`: Next.js responsive frontend
- `apps/api`: NestJS modular monolith API
- `PostgreSQL`, `Redis`, and `MinIO` via Docker Compose

## Prerequisites

- Node.js `24+`
- npm `11+`
- Docker Desktop running

If Docker Desktop is not running, `docker compose up -d` will fail before the app can be tested.

## Local Setup

1. Copy the environment file:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Start local infrastructure:
   ```powershell
   docker compose up -d
   ```
3. Install workspace dependencies:
   ```powershell
   npm install
   ```
4. Generate the Prisma client:
   ```powershell
   npm run db:generate
   ```
5. Run the database migration:
   ```powershell
   npm run db:migrate
   ```
6. Seed demo data:
   ```powershell
   npm run db:seed
   ```
7. Start the API:
   ```powershell
   npm run dev:api
   ```
8. In a second terminal, start the web app:
   ```powershell
   npm run dev:web
   ```
9. Open `http://localhost:3000`.

## Development Accounts

Use any of these preconfigured users on the sign-in page:

- `rhea@northlight.edu`: Northlight organization admin
- `anika@northlight.edu`: Northlight teacher
- `meera@horizon.edu`: Horizon organization admin
- `aarav@horizon.edu`: Horizon teacher
- `platform@communityai.app`: platform admin

The local sign-in screen shows the OTP code directly after you request it, so you do not need a real email provider in development.

Community data is not preloaded. After seeding, groups, posts, comments, notifications, and invites all start empty until you create them in the UI.

## Step-By-Step Test Flow

### 1. Sign in

1. Open `http://localhost:3000`.
2. Enter `rhea@northlight.edu`.
3. Click `Send OTP`.
4. Copy the `Dev helper` OTP shown in the UI.
5. Enter the OTP and click `Verify and enter`.
6. Confirm that you land on `/community`.

### 2. Check the empty organization experience

1. On the left rail, confirm you can see joined groups.
2. In the center feed, confirm the local organization feed starts empty.
3. In the right rail, confirm notifications start empty.
4. As `rhea`, confirm you can see:
   - the invite panel
   - the moderation panel

### 3. Create a new local group

1. Click `Create a group`.
2. Enter a name and description.
3. Leave `Open to all teachers` turned off.
4. Create the group.
5. Confirm it appears in the organization group list with `Local` visibility.

### 4. Create a public group with the toggle

1. Click `Create a group`.
2. Enter a name and description.
3. Turn on `Open to all teachers`.
4. Read the visibility warning in the dialog.
5. Create the group.
6. Confirm it appears in the organization view as `Public`.
7. Open the group and confirm you can post immediately as the creator.

### 5. Test cross-school public group access

1. Open an incognito window or a second browser profile.
2. Sign in as `aarav@horizon.edu`.
3. Go to `Public Groups`.
4. Find the public group you created from the first browser.
5. Click `Join`.
6. Open the group and confirm you can now:
   - view posts
   - add comments
   - react to posts
   - create a new post after joining

### 6. Verify public posts stay out of the local campus feed

1. While signed in as `aarav@horizon.edu`, go to `Campus Feed`.
2. Confirm Horizon’s local feed does not become flooded with public-group posts from another school.
3. Go back to `Public Groups` and confirm public content is still accessible there.

### 7. Test the visibility change rule

1. Sign back in as the group creator or that organization’s org admin.
2. Open a public group that already has cross-school activity from another institution.
3. Try to return it to local-only access.
4. Confirm the API blocks the change once external participation exists.

### 8. Test comments, mentions, bookmarks, and reactions

1. Open any group with posts.
2. Add a new comment.
3. Reply to a top-level comment to verify one-level threading.
4. Mention another teacher with `@handle`, for example `@anika`.
5. Add reactions to the post and to a comment.
6. Save the post with `Save`.
7. Confirm the mentioned teacher receives a notification after refresh.

### 9. Test moderation

1. Sign in as an org admin such as `rhea@northlight.edu`.
2. In another session, report a post or comment with the `Report` button.
3. Refresh the admin session.
4. Confirm the report appears in the moderation panel.
5. Use `Hide content`, `Lock group`, or `Dismiss`.
6. Confirm the moderated content or group updates accordingly.

### 10. Test the invite flow

1. Sign in as `rhea@northlight.edu`.
2. Use the invite panel to create an invite for `newteacher@northlight.edu`.
3. Copy the returned invite link.
4. Open the link in a new browser tab.
5. Enter a teacher name and accept the invite.
6. Return to the sign-in page.
7. Request an OTP for `newteacher@northlight.edu`.
8. Use the dev OTP shown on screen and sign in.
9. Confirm the new teacher can access Northlight’s community.

### 11. Test attachments

1. Open any group you can post in.
2. Attach a PDF, image, DOCX, or PPTX under 10 MB.
3. Publish the post.
4. Open the attachment chip from the post card.
5. Confirm the file downloads.

## Useful Commands

- Lint everything:
  ```powershell
  npm run lint
  ```
- Build everything:
  ```powershell
  npm run build
  ```
- Run tests:
  ```powershell
  npm run test
  ```

## Ports

- Web app: `3000`
- API: `4000`
- PostgreSQL: `5433`
- Redis: `6379`
- MinIO API: `9000`
- MinIO console: `9001`

## Production Deployment

This repo now includes a VPS-friendly deployment path:

- CI: `.github/workflows/ci.yml`
- CD: `.github/workflows/deploy.yml`
- Production compose: `docker-compose.prod.yml`
- Example production env: `.env.prod.example`

### What this deploy setup does

- Builds the web and API into Docker images.
- Runs `PostgreSQL`, `Redis`, `MinIO`, the Nest API, and the Next.js web app on one VPS.
- Exposes the web app publicly on `WEB_PORT`, which is `80` by default in production.
- Deploys on every push to `main`, or manually through GitHub Actions.

### One-time VPS setup

1. Create a Linux VPS with Docker and Docker Compose installed.
2. Point your domain or subdomain to the VPS IP.
3. Copy `.env.prod.example` to `.env.prod` on the server and fill in real secrets.
4. Make sure the server user can run `docker compose`.

### GitHub Secrets needed for CD

- `DEPLOY_SSH_HOST`: your VPS IP or hostname
- `DEPLOY_SSH_PORT`: usually `22`
- `DEPLOY_SSH_USER`: the Linux user that owns the app directory
- `DEPLOY_SSH_KEY`: the private SSH key for that server user
- `DEPLOY_APP_DIR`: for example `/srv/community-ai`
- `PROD_ENV_FILE`: the full contents of your production `.env.prod`

### First production deploy

1. Push the repo to GitHub.
2. Add the secrets above in `Settings > Secrets and variables > Actions`.
3. Push to `main` or run the `Deploy` workflow manually.
4. After deployment, open your server URL on mobile and test there instead of using local Wi-Fi access.

### Mobile testing after deploy

Once deployed, test from your phone using your public URL:

1. Open the deployed site in mobile Chrome or Safari.
2. Sign in with your seeded or invited teacher account.
3. Test OTP, group creation, the public toggle, posting, attachments, notifications, and theme switching.

That removes local firewall and router issues from the loop, which is exactly what we want for reliable UI testing.

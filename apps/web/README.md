## Community AI Web

Responsive Next.js client for the teacher community MVP.

### Screens included

- invite-only login with email OTP
- organization feed dashboard
- public group discovery
- group detail view with post composer and attachments
- notifications, invite management, and moderation side panels

### Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

The app expects the API to be running at `NEXT_PUBLIC_API_URL`, which defaults to `http://localhost:4000/api/v1`.

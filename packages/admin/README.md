# DXDY Admin

Next.js admin console for the CloudBase-backed DXDY management workflows.

## Local Development

```bash
npm run dev -w packages/admin
```

The dev server usually starts on `http://localhost:3000`; if that port is occupied, Next.js will pick the next available port.

## Static Hosting Deployment

The admin console is deployed to CloudBase static hosting under `/cloud-admin`.

```bash
npm run build -w packages/admin
tcb hosting deploy packages/admin/out cloud-admin -e cloud1-d7g7ctn4m86bada89
```

Use the npm build script, not a bare `next build`, because it runs `scripts/patch-next-export-rsc.mjs` after static export. That patch creates compatibility aliases for Next.js 16 App Router RSC `.txt` payloads and prevents `__next.!...txt?_rsc=` 404s on CloudBase static hosting.

More detail and verification commands: `docs/ADMIN_STATIC_HOSTING.md`.

## Required Production Environment

- `ADMIN_SESSION_SECRET`: strong random secret used to sign the `admin_session` httpOnly cookie. Production startup/login flows must not rely on the development fallback.

## Development-Only Defaults

- `ADMIN_ALLOW_ANY_PASSWORD=true` may be used locally to allow the seeded admin accounts to log in with any password.
- In production, arbitrary admin passwords are rejected. Accounts must have a real password value stored in CloudBase `users.password`.

## Default Admin Roles

- `service`
- `product_manager`
- `system_admin`

The login API can seed missing default admin accounts for development and bootstrap use.

# Admin Next.js Static Hosting Notes

Last updated: 2026-05-21

This project deploys the admin console to CloudBase static hosting under:

```text
https://cloud1-d7g7ctn4m86bada89-1433980811.tcloudbaseapp.com/cloud-admin
```

The admin package is a Next.js 16 App Router app, but it is deployed as static files to avoid CloudBase Run / cloud hosting compute charges.

## Current Deployment Command

Always build through the package script before uploading:

```bash
npm run build -w packages/admin
tcb hosting deploy packages/admin/out cloud-admin -e cloud1-d7g7ctn4m86bada89
```

Do not deploy a raw `next build` output. The `packages/admin` build script runs a post-build compatibility patch:

```json
"build": "next build && node scripts/patch-next-export-rsc.mjs"
```

## Why The Patch Exists

Next.js 16 static export can generate App Router RSC payload files in directory form, for example:

```text
out/dashboard/__next.!KGFkbWluKQ/dashboard.txt
out/dashboard/__next.!KGFkbWluKQ/dashboard/__PAGE__.txt
```

In CloudBase static hosting, the browser may request equivalent dotted paths during client navigation:

```text
/cloud-admin/dashboard/__next.!KGFkbWluKQ.dashboard.txt
/cloud-admin/dashboard/__next.!KGFkbWluKQ.dashboard.__PAGE__.txt
```

If the dotted aliases are missing, the console shows many 404s like:

```text
GET /cloud-admin/dashboard/__next.!KGFkbWluKQ.dashboard.txt?_rsc=... 404
GET /cloud-admin/products/__next.!KGFkbWluKQ.products.__PAGE__.txt?_rsc=... 404
GET /cloud-admin/orders/__next.!KGFkbWluKQ.orders.txt?_rsc=... 404
```

These 404s usually do not mean the admin pages are missing. They indicate a mismatch between Next.js static export RSC file layout and the paths requested from static hosting.

`packages/admin/scripts/patch-next-export-rsc.mjs` copies the generated directory-form RSC files to dotted aliases after `next build`. It also mirrors route files such as `dashboard.html` and `dashboard.txt` to `dashboard/index.html` and `dashboard/index.txt` because `tcb hosting deploy` uploads and overwrites files but does not delete stale files from previous deployments. Keeping both forms covered makes `/cloud-admin/dashboard` and `/cloud-admin/dashboard/` serve the same current build.

## Current Next Config

The static-hosting setup expects:

```ts
output: 'export',
basePath: '/cloud-admin',
trailingSlash: false,
images: {
  unoptimized: true,
},
```

Do not switch to `output: 'standalone'` unless intentionally moving to CloudBase Run / SSR deployment and accepting its separate compute billing model.

## Verification

After deployment, check both page routes and RSC aliases:

```powershell
$base = 'https://cloud1-d7g7ctn4m86bada89-1433980811.tcloudbaseapp.com/cloud-admin'
Invoke-WebRequest "$base/dashboard/" -Method Head -Headers @{ 'Cache-Control'='no-cache' }
Invoke-WebRequest "$base/dashboard/__next.!KGFkbWluKQ.dashboard.txt" -Method Head -Headers @{ 'Cache-Control'='no-cache' }
Invoke-WebRequest "$base/dashboard/__next.!KGFkbWluKQ.dashboard.__PAGE__.txt" -Method Head -Headers @{ 'Cache-Control'='no-cache' }
Invoke-WebRequest "$base/products/__next.!KGFkbWluKQ.products.txt" -Method Head -Headers @{ 'Cache-Control'='no-cache' }
Invoke-WebRequest "$base/orders/__next.!KGFkbWluKQ.orders.__PAGE__.txt" -Method Head -Headers @{ 'Cache-Control'='no-cache' }
```

Expected status is `200`.

CloudBase CDN may serve older files briefly. Use `Cache-Control: no-cache`, an incognito window, or wait a few minutes before treating a browser cache result as a deployment failure.

## CLI Notes

- Confirm CLI access with `tcb env list`; the target environment must be `cloud1-d7g7ctn4m86bada89`.
- Upload static hosting files with `tcb hosting deploy packages/admin/out cloud-admin -e cloud1-d7g7ctn4m86bada89`.
- `tcb hosting deploy` does not remove old remote files. If switching output layouts again, either keep compatibility aliases or intentionally clean stale paths with `tcb hosting delete`.

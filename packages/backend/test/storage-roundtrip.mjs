// Upload → list → download → delete one document through a running API, the way the web app does it.
// Proves the storage driver end to end on a real deployment (leaves nothing behind):
//   API=https://<site>/api EMAIL=<login> PASSWORD=<password> node --env-file=.env test/storage-roundtrip.mjs
// Needs SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to sign in. The login must belong to an employee.
import { signIn } from './support/supabase-auth.mjs';

const API = process.env.API || 'http://localhost:3010';
let passes = 0, failures = 0;
const ok = (name, cond, extra) => { if (cond) { passes++; console.log(`  ✓ ${name}`); } else { failures++; console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); } };

const session = await signIn(process.env.EMAIL, process.env.PASSWORD);
if (!session.accessToken) { console.error('Could not sign in:', session.error); process.exit(1); }
const auth = { authorization: `Bearer ${session.accessToken}` };
const json = async (method, path, body) => { const r = await fetch(API + path, { method, headers: { ...auth, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => null) }; };

const runtime = await json('GET', '/meta/runtime');
const me = await json('GET', '/auth/me');
const employeeId = me.data?.employee?.id;
ok('signed in as an employee', !!employeeId, me.data);
const direct = !!runtime.data?.directUploads;
console.log(`  · upload mode: ${direct ? 'direct to storage (signed URL)' : 'through the API (multipart)'}`);

// a small but real PDF header, padded so a truncated upload would be noticed
const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n% JantaHR storage check\n'), Buffer.alloc(64 * 1024, 0x20), Buffer.from('\n%%EOF\n')]);
const name = `storage-check-${Date.now()}.pdf`;
let created;
if (direct) {
  const sign = await json('POST', '/uploads/sign', { fileName: name, mime: 'application/pdf', size: pdf.length });
  ok('API signs an upload', sign.status === 201 && !!sign.data?.url, sign.data);
  const put = await fetch(sign.data.url, { method: sign.data.method, headers: sign.data.headers, body: pdf });
  ok('file goes straight to storage', put.ok, { status: put.status, body: (await put.text()).slice(0, 120) });
  created = await json('POST', `/employees/${employeeId}/documents`, { documentType: 'OTHER', documentName: name, upload: sign.data.upload });
} else {
  const form = new FormData();
  form.set('documentType', 'OTHER'); form.set('documentName', name); form.set('file', new Blob([pdf], { type: 'application/pdf' }), name);
  const r = await fetch(`${API}/employees/${employeeId}/documents`, { method: 'POST', headers: auth, body: form });
  created = { status: r.status, data: await r.json().catch(() => null) };
}
ok('document attached to the employee', created.status === 201 && !!created.data?.id, created.data);
const docId = created.data?.id;

try {
  const list = await json('GET', `/employees/${employeeId}/documents`);
  ok('document is listed', list.data?.some?.((d) => d.id === docId), list.status);

  const first = await fetch(`${API}/employees/documents/${docId}/download`, { headers: { ...auth, 'x-download-link': '1' } });
  let bytes;
  if ((first.headers.get('content-type') || '').startsWith('application/vnd.jantahr.download-link+json')) {
    const link = await first.json();
    const file = await fetch(link.url);
    ok('API hands out a short-lived download link', file.ok, file.status);
    bytes = Buffer.from(await file.arrayBuffer());
  } else {
    bytes = Buffer.from(await first.arrayBuffer());
  }
  ok('downloaded file is byte-for-byte what was uploaded', bytes.equals(pdf), { got: bytes.length, expected: pdf.length });

  // a new function instance must still find the file: this is what local disk on a serverless host cannot do
  await new Promise((r) => setTimeout(r, 1500));
  const again = await fetch(`${API}/employees/documents/${docId}/download`, { headers: auth });
  ok('file is still there on a second request', again.ok && Buffer.from(await again.arrayBuffer()).equals(pdf), again.status);
} finally {
  if (docId) {
    const del = await json('DELETE', `/employees/documents/${docId}`);
    ok('document removed again', del.data?.ok === true, del.data);
    const gone = await fetch(`${API}/employees/documents/${docId}/download`, { headers: auth });
    ok('removed document can no longer be downloaded', gone.status === 404, gone.status);
  }
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);

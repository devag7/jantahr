/**
 * Digital Asset Links: proves to Android that the JantaHR app (a Trusted Web Activity) belongs to this site, so it
 * opens full screen without a browser bar. ANDROID_PACKAGE_NAME is the app id; ANDROID_CERT_SHA256 lists the signing
 * certificate fingerprints, comma-separated (Play's app signing key, plus the upload key for builds installed directly).
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim();
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || '').split(',').map((f) => f.trim().toUpperCase()).filter(Boolean);
  const statements = packageName && fingerprints.length
    ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints } }]
    : [];
  return Response.json(statements, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}

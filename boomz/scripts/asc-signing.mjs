// Prépare la signature App Store sans Mac ni compte Xcode, par l'API App Store
// Connect : certificat de distribution (à partir de la demande CSR fournie)
// et profil App Store de l'application.
// Variables : ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_FILE, BUNDLE_ID, CSR_FILE, OUT_DIR.
// Écrit OUT_DIR/distribution.cer et OUT_DIR/profile.mobileprovision, et affiche
// le nom du profil sur la dernière ligne.
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_FILE, BUNDLE_ID, CSR_FILE, OUT_DIR } = process.env;
const PROFILE_NAME = 'Boomz App Store (GitHub)';

const key = createPrivateKey(readFileSync(ASC_KEY_FILE, 'utf8'));
function token() {
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' })}.${b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`;
  return `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

async function api(method, path, body) {
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`${method} ${path} → ${response.status} : ${text.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }
  return json;
}

// Application enregistrée (étape « Identifiers » faite par l'éditeur).
const bundles = await api('GET', `/bundleIds?filter[identifier]=${BUNDLE_ID}&limit=5`);
const bundle = bundles.data.find((item) => item.attributes.identifier === BUNDLE_ID);
if (!bundle) throw new Error(`Identifiant ${BUNDLE_ID} introuvable dans Certificates, IDs & Profiles.`);

// Certificat de distribution. Sa clé privée n'existe que le temps de cette
// fabrication : un nouveau certificat est donc créé à chaque fois, et le plus
// ancien est révoqué si Apple refuse d'en créer un de plus. Les versions déjà
// envoyées sur TestFlight ou l'App Store ne sont pas touchées.
const csrContent = readFileSync(CSR_FILE, 'utf8');
async function createCertificate() {
  return api('POST', '/certificates', {
    data: { type: 'certificates', attributes: { certificateType: 'DISTRIBUTION', csrContent } },
  });
}
let certificate;
try {
  certificate = await createCertificate();
} catch (error) {
  if (error.status !== 409) throw error;
  const existing = await api('GET', '/certificates?filter[certificateType]=DISTRIBUTION&limit=50');
  const oldest = existing.data.sort((a, b) => a.attributes.expirationDate.localeCompare(b.attributes.expirationDate))[0];
  if (!oldest) throw error;
  console.log(`Limite de certificats atteinte : révocation du plus ancien (${oldest.attributes.name}, expire le ${oldest.attributes.expirationDate}).`);
  await api('DELETE', `/certificates/${oldest.id}`);
  certificate = await createCertificate();
}
writeFileSync(`${OUT_DIR}/distribution.cer`, Buffer.from(certificate.data.attributes.certificateContent, 'base64'));
console.log(`Certificat créé : ${certificate.data.attributes.name}`);

// Profil App Store : l'ancien (lié à un certificat précédent) est remplacé.
const profiles = await api('GET', `/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}&limit=20`);
for (const profile of profiles.data) await api('DELETE', `/profiles/${profile.id}`);
const profile = await api('POST', '/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: PROFILE_NAME, profileType: 'IOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bundle.id } },
      certificates: { data: [{ type: 'certificates', id: certificate.data.id }] },
    },
  },
});
writeFileSync(`${OUT_DIR}/profile.mobileprovision`, Buffer.from(profile.data.attributes.profileContent, 'base64'));
console.log(`Profil créé : ${PROFILE_NAME}`);
console.log(PROFILE_NAME);

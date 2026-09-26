// Vérifie la clé d'API App Store Connect avant de fabriquer l'application :
// un message clair ici vaut mieux qu'un « No Accounts » de Xcode dix minutes plus tard.
// Variables : ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_FILE (chemin du .p8), BUNDLE_ID.
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_FILE, BUNDLE_ID } = process.env;
const fail = (message) => {
  console.log(`::error::${message}`);
  process.exit(1);
};

let key;
try {
  key = createPrivateKey(readFileSync(ASC_KEY_FILE, 'utf8'));
} catch {
  fail('ASC_KEY_P8 illisible : collez tout le contenu du fichier .p8, lignes BEGIN et END comprises.');
}
if (!/^[A-Z0-9]{10}$/.test(ASC_KEY_ID)) fail(`ASC_KEY_ID doit faire 10 caractères (lettres majuscules et chiffres), reçu ${ASC_KEY_ID.length} caractères.`);
if (!/^[0-9a-f-]{36}$/i.test(ASC_ISSUER_ID)) fail('ASC_ISSUER_ID doit ressembler à xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.');

const b64 = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' })}.${b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`;
const token = `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;

const response = await fetch(`https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=${BUNDLE_ID}`, {
  headers: { authorization: `Bearer ${token}` },
});
if (response.status === 401) fail('Clé refusée par Apple (401) : vérifiez que ASC_KEY_ID, ASC_ISSUER_ID et ASC_KEY_P8 viennent de la même clé.');
if (response.status === 403) {
  fail(`Accès refusé (403) : la clé doit avoir l’accès Admin. Réponse d’Apple : ${(await response.text()).slice(0, 300)}`);
}
if (!response.ok) fail(`App Store Connect a répondu ${response.status} : ${await response.text()}`);
const { data } = await response.json();
if (data.length === 0) fail(`Aucune app ${BUNDLE_ID} dans App Store Connect : créez-la (Apps › + › Nouvelle app).`);
console.log(`Clé d'API valide ; app trouvée : ${data[0].attributes.name} (${BUNDLE_ID}).`);

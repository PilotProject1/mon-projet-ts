/*
 * Génère une paire de clés VAPID pour les notifications push.
 *
 *   npm run vapid
 *
 * À faire une seule fois : changer de clés invalide tous les abonnements
 * existants, et les appareils déjà autorisés cesseraient d'être notifiés.
 * La clé privée est un secret — elle ne va que dans les variables
 * d'environnement de l'hébergeur, jamais dans le dépôt.
 */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('\nÀ déclarer côté hébergeur (Render) :\n');
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:syneco.pro@outlook.fr');
console.log(
  '\nLa clé publique est transmise aux navigateurs ; la clé privée reste secrète.\n',
);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Adresse publique de l'application, base des liens envoyés par e-mail. */
function appUrl(): string {
  return (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')[0]
    .trim()
    .replace(/\/+$/, '');
}

/**
 * Avis de reconduction d'un abonnement annuel.
 *
 * Le ton reste factuel : ce message est dû, pas vendu. Il annonce la date, le
 * montant et le geste pour ne pas reconduire — c'est exactement ce que
 * l'article L. 215-1 demande de porter à la connaissance de l'abonné, et rien
 * de plus n'a sa place ici.
 */
export function renewalNoticeEmail(params: {
  nom: string;
  offre: string;
  jour: string;
  montant: string | null;
}): { subject: string; text: string; html: string } {
  const { nom, offre, jour, montant } = params;
  const url = appUrl();

  const subject = `Votre abonnement SYNeco sera reconduit le ${jour}`;
  const tarif = montant ? `, au tarif de ${montant}` : '';

  const text = [
    `Bonjour ${nom},`,
    '',
    `Votre abonnement ${offre} sera reconduit pour un an le ${jour}${tarif}.`,
    '',
    "Vous n'avez rien à faire pour le conserver. Si vous préférez ne pas le",
    'reconduire, vous pouvez y mettre fin dès maintenant depuis la page',
    `Abonnement : ${url}/abonnement`,
    `Votre accès sera conservé jusqu'au ${jour}, sans nouveau prélèvement.`,
    '',
    "Ce message vous est adressé conformément à l'article L. 215-1 du Code",
    'de la consommation.',
    '',
    '— SYNeco',
  ].join('\n');

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f5f8f7;font-family:Arial,Helvetica,sans-serif;color:#132420;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e9e6;border-radius:12px;">
      <tr>
        <td style="padding:20px 24px;background:#0b2e2f;border-radius:12px 12px 0 0;">
          <span style="font-size:18px;font-weight:bold;color:#ffffff;">SYN</span><span style="font-size:18px;font-weight:bold;color:#5fdb92;">eco</span>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 8px;font-size:13px;color:#5b6b65;">Reconduction de votre abonnement</p>
          <p style="margin:0 0 16px;font-size:17px;line-height:1.5;">Bonjour ${escapeHtml(nom)},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
            Votre abonnement <strong>${escapeHtml(offre)}</strong> sera reconduit pour un an
            le <strong>${escapeHtml(jour)}</strong>${montant ? `, au tarif de <strong>${escapeHtml(montant)}</strong>` : ''}.
          </p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
            Vous n'avez rien à faire pour le conserver. Si vous préférez ne pas le reconduire,
            vous pouvez y mettre fin dès maintenant : votre accès sera conservé jusqu'au
            ${escapeHtml(jour)}, sans nouveau prélèvement.
          </p>
          <a href="${url}/abonnement" style="display:inline-block;padding:11px 18px;background:#2f8f6f;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;">Gérer mon abonnement</a>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#5b6b65;border-top:1px solid #e3e9e6;padding-top:16px;">
            Ce message vous est adressé conformément à l'article L. 215-1 du Code de la
            consommation. Il ne dépend pas de vos préférences de rappel.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

import type { PointBriefing } from './briefing.util';

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

/** Au-delà, les messageries coupent l'objet : autant choisir où. */
const MAX_OBJET = 78;

/**
 * Objet tiré du point le plus urgent.
 *
 * « Votre point hebdomadaire » n'apprend rien et ne se distingue pas dans une
 * boîte de réception. « SYNeco : « Taxe foncière » est dépassée » dit tout,
 * et se lit sans ouvrir le message — ce qui est déjà un service rendu.
 */
export function digestSubject(points: PointBriefing[]): string {
  const premier = points[0]?.message ?? '';
  const reste = points.length - 1;
  const suffixe = reste > 0 ? ` (+ ${reste} autre${reste > 1 ? 's' : ''})` : '';
  const objet = `SYNeco : ${premier}${suffixe}`;
  return objet.length <= MAX_OBJET
    ? objet
    : `${objet.slice(0, MAX_OBJET - 1).trimEnd()}…`;
}

const COULEURS: Record<PointBriefing['urgence'], string> = {
  urgent: '#b4483f',
  attention: '#c98a3e',
  information: '#5b6b65',
};

export function weeklyDigestEmail(points: PointBriefing[]): {
  subject: string;
  text: string;
  html: string;
} {
  const url = appUrl();

  const text = [
    'Voici ce qui demande une décision cette semaine :',
    '',
    ...points.map((p) => `- ${p.message}\n  ${url}${p.actionTo}`),
    '',
    `Votre espace : ${url}`,
    '',
    'Vous recevez ce point parce qu’il est activé sur votre compte SYNeco.',
    `Pour ne plus le recevoir : ${url}/echeances`,
  ].join('\n');

  // Mise en forme volontairement sobre : tableaux et styles en ligne, seule
  // syntaxe rendue de la même façon par la plupart des messageries.
  const lignes = points
    .map(
      (p) => `
          <tr>
            <td style="padding:0 0 14px;">
              <p style="margin:0 0 4px;font-size:15px;line-height:1.5;color:#132420;">
                <span style="color:${COULEURS[p.urgence]};font-weight:bold;">•</span>
                ${escapeHtml(p.message)}
              </p>
              <a href="${url}${p.actionTo}" style="font-size:13px;color:#2f8f6f;text-decoration:none;font-weight:bold;">${escapeHtml(p.actionLabel)} →</a>
            </td>
          </tr>`,
    )
    .join('');

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
          <p style="margin:0 0 18px;font-size:13px;color:#5b6b65;">Ce qui demande une décision cette semaine</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${lignes}</table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#5b6b65;border-top:1px solid #e3e9e6;padding-top:16px;">
            Ce point est une aide à l'organisation : il ne garantit pas qu'une échéance sera respectée.
            Vous le recevez parce qu'il est activé sur votre compte.
            <a href="${url}/echeances" style="color:#2f8f6f;">Ne plus le recevoir</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: digestSubject(points), text, html };
}

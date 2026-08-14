import { formatDueDate } from './deadline-reminder.util';

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

export function reminderEmail(params: {
  title: string;
  dueDate: Date;
  message: string;
}): { subject: string; text: string; html: string } {
  const { title, dueDate, message } = params;
  const url = appUrl();
  const date = formatDueDate(dueDate);

  const subject = `Rappel : ${title} — échéance le ${date}`;

  const text = [
    message,
    '',
    `Consulter l'échéance : ${url}/echeances`,
    '',
    'Vous recevez cet e-mail parce que les rappels sont activés sur votre',
    `compte SYNeco. Vous pouvez les désactiver à tout moment : ${url}/echeances`,
  ].join('\n');

  // Mise en forme volontairement sobre : tableaux et styles en ligne, seule
  // syntaxe rendue de la même façon par la plupart des messageries.
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
          <p style="margin:0 0 8px;font-size:13px;color:#5b6b65;">Rappel d'échéance</p>
          <p style="margin:0 0 20px;font-size:17px;line-height:1.5;">${escapeHtml(message)}</p>
          <a href="${url}/echeances" style="display:inline-block;padding:11px 18px;background:#2f8f6f;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;">Voir mes échéances</a>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#5b6b65;border-top:1px solid #e3e9e6;padding-top:16px;">
            Ce rappel est une aide à l'organisation : il ne garantit pas qu'une échéance sera respectée.
            Vous pouvez désactiver les rappels par e-mail depuis la page
            <a href="${url}/echeances" style="color:#2f8f6f;">Échéances</a>.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

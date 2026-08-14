import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  /** Version texte, seule version lue par certains clients. */
  text: string;
  html: string;
}

/**
 * Envoi d'e-mails par SMTP.
 *
 * Le service est facultatif, comme Stripe ou l'assistant IA : sans
 * configuration, l'application fonctionne normalement et les rappels restent
 * consultables dans l'application. Passer par SMTP plutôt que par l'API d'un
 * prestataire particulier laisse le choix du fournisseur (Brevo, Outlook,
 * Mailjet…) sans toucher au code.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private warned = false;

  get available(): boolean {
    return Boolean(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD,
    );
  }

  /** Adresse affichée comme expéditeur. */
  private get from(): string {
    return process.env.MAIL_FROM ?? `SYNeco <${process.env.SMTP_USER}>`;
  }

  private get transport(): Transporter {
    if (!this.transporter) {
      const port = Number(process.env.SMTP_PORT ?? 587);
      this.transporter = createTransport({
        host: process.env.SMTP_HOST,
        port,
        // Le port 465 ouvre une connexion chiffrée d'emblée ; le 587 chiffre
        // après négociation (STARTTLS).
        secure: port === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    }
    return this.transporter;
  }

  /**
   * Tente l'envoi et rend compte du résultat sans jamais lever d'exception :
   * un e-mail perdu ne doit pas interrompre la tournée des rappels ni faire
   * échouer la requête d'un utilisateur.
   */
  async send(message: MailMessage): Promise<boolean> {
    if (!this.available) {
      if (!this.warned) {
        this.logger.warn(
          "Aucun serveur SMTP configuré : les rappels restent visibles dans l'application, mais aucun e-mail ne part.",
        );
        this.warned = true;
      }
      return false;
    }

    try {
      await this.transport.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Envoi impossible à ${message.to} : ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

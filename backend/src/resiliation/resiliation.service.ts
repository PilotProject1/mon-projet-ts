import { Injectable, Logger } from '@nestjs/common';
import { OcrService } from '../analysis/ocr.service';
import {
  ExtractionService,
  type ExtractedFields,
} from '../analysis/extraction.service';
import { AiService } from '../ai/ai.service';
import { AiExtractionService } from '../ai/ai-extraction.service';
import { AiLetterService } from '../ai/ai-letter.service';
import { BudgetIaService } from './budget-ia.service';

export interface ResultatResiliation {
  /** Émetteur reconnu, null si le document ne le nomme pas. */
  prestataire: string | null;
  /** Référence du contrat, reprise telle qu'écrite. */
  reference: string | null;
  /** Échéance repérée, au format AAAA-MM-JJ. Null si aucune. */
  echeance: string | null;
  /**
   * Formule du document qui annonce cette date, citée telle quelle.
   *
   * On cite le document plutôt que d'énoncer un délai légal : les règles de
   * résiliation dépendent du type de contrat et de sa date de souscription,
   * et annoncer une date limite fausse serait pire que ne rien annoncer.
   */
  echeanceLibelle: string | null;
  lettre: { objet: string; corps: string };
  /** true quand la lettre vient du modèle, false quand c'est le gabarit. */
  redigeeParIA: boolean;
  /** Renseigné quand la lecture n'a rien trouvé d'exploitable. */
  avertissement: string | null;
}

/** Au-delà, la lecture est abandonnée : le visiteur attend une réponse. */
const DELAI_LECTURE_MS = 45_000;

@Injectable()
export class ResiliationService {
  private readonly logger = new Logger(ResiliationService.name);

  constructor(
    private readonly ocr: OcrService,
    private readonly extraction: ExtractionService,
    private readonly ai: AiService,
    private readonly aiExtraction: AiExtractionService,
    private readonly aiLetter: AiLetterService,
    private readonly budget: BudgetIaService,
  ) {}

  private withTimeout<T>(promesse: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promesse,
      new Promise<never>((_, rejeter) =>
        setTimeout(() => rejeter(new Error('délai dépassé')), ms).unref(),
      ),
    ]);
  }

  /**
   * Lit un contrat déposé sans compte et en tire une lettre de résiliation.
   *
   * Le fichier n'est jamais écrit : il est lu en mémoire puis oublié à la fin
   * de la requête. C'est ce qui permet d'ouvrir l'outil sans inscription sans
   * constituer un stock de documents personnels appartenant à des visiteurs
   * qu'on ne pourrait ni identifier ni prévenir.
   */
  async analyser(fichier: Express.Multer.File): Promise<ResultatResiliation> {
    const { text } = await this.withTimeout(
      this.ocr.extractText(fichier.buffer, fichier.mimetype),
      DELAI_LECTURE_MS,
    );

    if (!text.trim()) {
      return this.resultatVide(
        'Aucun texte n’a pu être lu dans ce document. Une photo nette et bien ' +
          'éclairée, ou le PDF d’origine, donnent un bien meilleur résultat.',
      );
    }

    const champs = await this.lire(text);
    const prestataire = champs.suggestedProvider?.trim() || null;
    const reference = champs.suggestedReference?.trim() || null;
    const documentDate = this.enDate(champs.suggestedDocumentDate);

    if (!prestataire) {
      return this.resultatVide(
        'Le nom de l’organisme n’a pas été reconnu dans ce document. La lettre ' +
          'ci-dessous reste utilisable en complétant le destinataire vous-même.',
        { reference, champs },
      );
    }

    const lettre = await this.rediger({
      prestataire,
      reference,
      documentDate,
    });

    return {
      prestataire,
      reference,
      echeance: champs.suggestedDueDate ?? null,
      echeanceLibelle: champs.suggestedDueLabel ?? null,
      lettre: lettre.contenu,
      redigeeParIA: lettre.parIA,
      avertissement: null,
    };
  }

  /**
   * Lecture des champs : le modèle quand le budget du jour le permet, le
   * moteur heuristique sinon. Les deux renvoient la même forme.
   */
  private async lire(texte: string): Promise<ExtractedFields> {
    if (this.ai.available && this.budget.reserver()) {
      try {
        return await this.withTimeout(
          this.aiExtraction.extract(texte),
          DELAI_LECTURE_MS,
        );
      } catch (erreur) {
        this.logger.warn(
          `Lecture IA indisponible, repli heuristique : ${
            erreur instanceof Error ? erreur.message : String(erreur)
          }`,
        );
      }
    }
    return this.extraction.extract(texte);
  }

  private async rediger(faits: {
    prestataire: string;
    reference: string | null;
    documentDate: Date | null;
  }): Promise<{ contenu: { objet: string; corps: string }; parIA: boolean }> {
    if (this.ai.available && this.budget.reserver()) {
      try {
        const brouillon = await this.withTimeout(
          this.aiLetter.draft({
            kind: 'resiliation',
            provider: faits.prestataire,
            reference: faits.reference,
            documentDate: faits.documentDate,
            amount: null,
          }),
          DELAI_LECTURE_MS,
        );
        return {
          contenu: { objet: brouillon.subject, corps: brouillon.body },
          parIA: true,
        };
      } catch (erreur) {
        this.logger.warn(
          `Rédaction IA indisponible, repli sur le gabarit : ${
            erreur instanceof Error ? erreur.message : String(erreur)
          }`,
        );
      }
    }
    return { contenu: this.gabarit(faits), parIA: false };
  }

  /**
   * Lettre de repli, sans modèle. Volontairement neutre et complète : c'est
   * elle qui part quand l'IA est indisponible ou le plafond atteint, et le
   * visiteur ne doit pas s'en apercevoir autrement que par le ton.
   */
  private gabarit(faits: {
    prestataire: string;
    reference: string | null;
    documentDate: Date | null;
  }): { objet: string; corps: string } {
    const reference = faits.reference ? ` — réf. ${faits.reference}` : '';
    const lignes = [
      'Madame, Monsieur,',
      '',
      'Je vous informe par la présente de ma décision de résilier le contrat ' +
        `me liant à ${faits.prestataire}.`,
      '',
      faits.reference ? `Référence du contrat : ${faits.reference}` : null,
      faits.documentDate
        ? `Document daté du ${faits.documentDate.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}`
        : null,
      '',
      'Je vous remercie de bien vouloir m’en confirmer la prise en compte ainsi ' +
        'que la date d’effet de cette résiliation.',
      '',
      'Veuillez agréer, Madame, Monsieur, l’expression de mes salutations ' +
        'distinguées.',
      '',
      '[Votre nom]',
    ].filter((ligne) => ligne !== null);

    return {
      objet: `Résiliation de contrat${reference}`,
      corps: lignes.join('\n'),
    };
  }

  private resultatVide(
    avertissement: string,
    extra?: { reference: string | null; champs: ExtractedFields },
  ): ResultatResiliation {
    return {
      prestataire: null,
      reference: extra?.reference ?? null,
      echeance: extra?.champs.suggestedDueDate ?? null,
      echeanceLibelle: extra?.champs.suggestedDueLabel ?? null,
      lettre: this.gabarit({
        prestataire: '[Nom de l’organisme]',
        reference: extra?.reference ?? null,
        documentDate: null,
      }),
      redigeeParIA: false,
      avertissement,
    };
  }

  private enDate(iso: string | null | undefined): Date | null {
    if (!iso) return null;
    const date = new Date(`${iso}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}

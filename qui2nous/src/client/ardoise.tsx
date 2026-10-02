import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { IMAGE_TAILLE_MAX } from '../shared/protocol.ts';
import { Bouton } from './ui.tsx';

// Mini outil de dessin de Qui2Dessine (étape 6 de la feuille de route).

const COTE = 600; // résolution interne, quelle que soit la taille d'affichage
const COULEURS = ['#111827', '#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#92400e'];
const EPAISSEURS = [4, 10, 22];
const HISTORIQUE_MAX = 20;

/** Exporte le dessin : PNG, ou JPEG si un dessin très chargé dépasse la limite. */
export function exporterDessin(canvas: HTMLCanvasElement) {
  const png = canvas.toDataURL('image/png');
  return png.length <= IMAGE_TAILLE_MAX ? png : canvas.toDataURL('image/jpeg', 0.85);
}

export function Ardoise({
  envoyer,
  enCours,
  secondes,
}: {
  envoyer: (dessin: string) => Promise<{ ok: boolean }>;
  enCours: boolean;
  secondes: number | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const trait = useRef<{ x: number; y: number } | null>(null);
  const historique = useRef<ImageData[]>([]);
  const [couleur, setCouleur] = useState(COULEURS[0]);
  const [epaisseur, setEpaisseur] = useState(EPAISSEURS[1]);
  const [gomme, setGomme] = useState(false);
  const [aDessine, setADessine] = useState(false);
  const [nbEtapes, setNbEtapes] = useState(0);
  const envoye = useRef(false);

  const ctx = () => canvas.current!.getContext('2d')!;

  function effacerTout() {
    const c = ctx();
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, COTE, COTE);
  }

  useEffect(effacerTout, []);

  function envoyerUneFois() {
    if (envoye.current || !canvas.current) return;
    envoye.current = true;
    envoyer(exporterDessin(canvas.current)).then((r) => {
      if (!r.ok) envoye.current = false; // refusé (réseau…) : on peut réessayer
    });
  }

  // Le temps est presque écoulé : on envoie le dessin tel qu'il est plutôt que de le perdre.
  useEffect(() => {
    if (secondes !== null && secondes <= 1 && aDessine) envoyerUneFois();
  });

  function point(e: PointerEvent<HTMLCanvasElement>) {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * COTE) / r.width, y: ((e.clientY - r.top) * COTE) / r.height };
  }

  function memoriser() {
    historique.current.push(ctx().getImageData(0, 0, COTE, COTE));
    if (historique.current.length > HISTORIQUE_MAX) historique.current.shift();
    setNbEtapes(historique.current.length);
  }

  function tracer(de: { x: number; y: number }, a: { x: number; y: number }) {
    const c = ctx();
    c.strokeStyle = gomme ? '#ffffff' : couleur;
    c.lineWidth = gomme ? epaisseur * 2 : epaisseur;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(de.x, de.y);
    c.lineTo(a.x, a.y);
    c.stroke();
  }

  function debut(e: PointerEvent<HTMLCanvasElement>) {
    if (envoye.current) return;
    canvas.current!.setPointerCapture(e.pointerId);
    memoriser();
    const p = point(e);
    trait.current = p;
    tracer(p, p); // un simple toucher dessine un point
    setADessine(true);
  }

  function deplacement(e: PointerEvent<HTMLCanvasElement>) {
    if (!trait.current) return;
    const p = point(e);
    tracer(trait.current, p);
    trait.current = p;
  }

  function fin() {
    trait.current = null;
  }

  function annuler() {
    const precedent = historique.current.pop();
    if (precedent) ctx().putImageData(precedent, 0, 0);
    setNbEtapes(historique.current.length);
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvas}
        width={COTE}
        height={COTE}
        onPointerDown={debut}
        onPointerMove={deplacement}
        onPointerUp={fin}
        onPointerCancel={fin}
        aria-label="Zone de dessin"
        className="aspect-square w-full touch-none rounded-2xl bg-white shadow-inner ring-1 ring-white/20"
      />

      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Couleurs">
        {COULEURS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setCouleur(c);
              setGomme(false);
            }}
            aria-label={`Couleur ${c}`}
            aria-pressed={!gomme && couleur === c}
            style={{ backgroundColor: c }}
            className={`size-9 rounded-full ring-2 transition ${!gomme && couleur === c ? 'scale-110 ring-white' : 'ring-white/20'}`}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {EPAISSEURS.map((t) => (
          <button
            key={t}
            onClick={() => setEpaisseur(t)}
            aria-label={`Épaisseur ${t}`}
            aria-pressed={epaisseur === t}
            className={`flex size-10 items-center justify-center rounded-xl ${epaisseur === t ? 'bg-amber-400' : 'bg-white/10'}`}
          >
            <span className="rounded-full bg-white" style={{ width: t / 1.5 + 2, height: t / 1.5 + 2 }} />
          </button>
        ))}
        <button
          onClick={() => setGomme((g) => !g)}
          aria-pressed={gomme}
          className={`min-h-10 rounded-xl px-3 text-sm font-semibold ${gomme ? 'bg-amber-400 text-indigo-950' : 'bg-white/10'}`}
        >
          🧽 Gomme
        </button>
        <button
          onClick={annuler}
          disabled={nbEtapes === 0}
          className="min-h-10 rounded-xl bg-white/10 px-3 text-sm font-semibold disabled:opacity-40"
        >
          ↩️ Annuler
        </button>
        <button
          onClick={() => {
            memoriser();
            effacerTout();
          }}
          className="min-h-10 rounded-xl bg-white/10 px-3 text-sm font-semibold"
        >
          🗑️ Effacer
        </button>
      </div>

      <Bouton disabled={enCours || !aDessine} onClick={envoyerUneFois}>
        Envoyer mon dessin
      </Bouton>
      <p className="text-center text-xs text-white/50">Pas de lettres ! Ton dessin est envoyé tout seul à la fin du temps.</p>
    </div>
  );
}

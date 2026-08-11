# Charte SYNeco — à donner à Claude Code

## Contexte
Le projet PILOT est rebaptisé **SYNeco**. Applique ce thème à l'ensemble de l'app (toutes les pages, pas seulement la connexion), en remplaçant les couleurs violettes actuelles.

## Couleurs (variables CSS à ajouter/remplacer dans le thème global)
```css
:root{
  --petrol-deep:#0B3D3A;   /* couleur principale, remplace le violet foncé */
  --petrol-mid:#155E52;
  --green:#2E9E63;         /* accent principal, remplace le violet clair */
  --green-light:#5FDB92;
  --mint-bg:#EAF6EF;       /* fond clair */
  --card:#FFFFFF;
  --ink:#12211E;           /* texte principal */
  --muted:#5C7A72;         /* texte secondaire */
  --border:#DCEDE4;
}
```
- Boutons principaux : dégradé `linear-gradient(120deg, var(--petrol-deep), var(--green))`
- Liens et accents : `var(--green)`
- Fonds de page : `var(--mint-bg)`
- Cartes/formulaires : `var(--card)` avec bordure `var(--border)`

## Typographie
- Police : **Poppins** (Google Fonts), poids 400/500/600/700
- Titres : 600–700, couleur `--petrol-deep`
- Texte courant : 400, couleur `--ink`

## Logo
Le logo SYNeco (icône feuille-sync + wordmark "SYN" + "eco") est disponible en SVG. Voici le code de l'icône seule, à réutiliser partout (header, favicon, page de connexion) :

```svg
<svg viewBox="0 0 200 200" width="46" height="46">
  <defs>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B3D3A"/>
      <stop offset="100%" stop-color="#155E52"/>
    </linearGradient>
    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EAF6EF"/>
      <stop offset="100%" stop-color="#8FD9B3"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="46" fill="url(#badgeGrad)"/>
  <g transform="translate(100,100)" fill="none" stroke="url(#leafGrad)" stroke-width="11" stroke-linecap="round">
    <path d="M -54 10 A 62 62 0 0 1 46 -46"/>
    <polygon points="46,-46 60,-30 30,-24" fill="#EAF6EF" stroke="none"/>
    <path d="M 54 -10 A 62 62 0 0 1 -46 46"/>
    <polygon points="-46,46 -60,30 -30,24" fill="#EAF6EF" stroke="none"/>
    <line x1="-30" y1="30" x2="30" y2="-30" stroke-width="7" opacity="0.85"/>
  </g>
</svg>
```

Wordmark à côté de l'icône : `SYN` en `--petrol-deep` (poids 700) + `eco` en `--green` (poids 600).

## Ambiance de fond (optionnelle, pour pages d'accueil/connexion)
Halos radiaux doux animés en vert/pétrole/menthe, en remplacement du fond violet actuel — voir la maquette `syneco-login-mockup.html` déjà livrée comme référence exacte de rendu.

## Ce qu'il faut faire
1. Remplacer toutes les couleurs violettes par les tokens ci-dessus.
2. Remplacer le texte "PILOT" par le logo + wordmark SYNeco partout où il apparaît (header, titre d'onglet, favicon).
3. Appliquer Poppins comme police globale.
4. Garder la même structure/logique fonctionnelle de l'app — seule l'identité visuelle change.

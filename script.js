const tableauEcheances = [];

const champ = document.getElementById("champEcheance");
const bouton = document.getElementById("boutonAjouter");
const liste = document.getElementById("listeEcheances");

bouton.addEventListener("click", function() {
    const texte = champ.value;

    if (texte !== "") {
        tableauEcheances.push(texte);
        afficherListe();
        champ.value = "";
    }
});

function afficherListe() {
    liste.innerHTML = "";

    for (let i = 0; i < tableauEcheances.length; i++) {
        const item = document.createElement("li");
        item.textContent = tableauEcheances[i];

        const boutonSupprimer = document.createElement("button");
        boutonSupprimer.textContent = "Supprimer";
        boutonSupprimer.addEventListener("click", function() {
            tableauEcheances.splice(i, 1);
            afficherListe();
        });

        item.appendChild(boutonSupprimer);
        liste.appendChild(item);
    }
}
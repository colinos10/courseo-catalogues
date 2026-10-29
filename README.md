# Courseo — catalogues réels

Remplacement du scraper initial par un collecteur Node.js sans dépendance externe. Il publie des liens et métadonnées de catalogues, jamais des produits ou prix de démonstration.

## Sources et limites

Les pages publiques des enseignes et de Bonial sont lues comme HTML/JSON. Aucun JavaScript téléchargé n’est exécuté. Les refus HTTP 403/429 ne sont pas contournés. Seuls les liens HTTPS des sources autorisées sont conservés.

Le schéma réel Bonial `pageInformation.brochures` et les pages catalogue Auchan/Lidl sont pris en charge. Une entrée Bonial a `linkType: sourcePage` et ouvre la page où le catalogue se consulte ; ce n’est pas présenté comme un PDF direct. Les dates explicites sont normalisées pour la France. Les catalogues futurs ou expirés ne sont pas proposés comme offres en cours. Les dates manquantes restent nulles.

L’essai du 29 octobre 2026 a donné 29 catalogues pour Carrefour, E.Leclerc, Intermarché, Auchan, Lidl et Magasins U. Les autres enseignes restent marquées indisponibles avec leur page officielle. Le nombre varie à chaque collecte.

## Exécution

Node.js 22 ou supérieur, sans installation de paquets :

```text
npm test
npm run update
```

`catalogues.json` est écrit atomiquement. Sur échec d’une source, les derniers liens vérifiés depuis moins de quatorze jours sont conservés avec `stale: true`, sans réinitialiser leur date de récupération. Aucune donnée fictive n’est ajoutée.

Le workflow `.github/workflows/update_catalogues.yml` effectue les tests puis l’actualisation quotidienne à 04:00 UTC, et permet un lancement manuel. Aucun secret n’est requis. Il remplace le workflow Python initial, qui ne doit plus exécuter l’ancien `scraper.py`.

Variables facultatives du dépôt : CITY, POSTAL_CODE, LATITUDE, LONGITUDE. Le défaut est Paris 75003 ; cette localisation figure dans le flux, sans prétendre couvrir chaque magasin local. Les pages nationales Bonial peuvent appliquer leur propre contexte géographique.

Le flux ne contient aucune liste de courses ni information de compte Courseo. La liste du couple est stockée séparément dans un foyer Supabase privé.

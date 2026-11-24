# Cozytouched (web / iPhone)

Client simple et rapide pour les splits et chauffages **Atlantic Cozytouch** (appareils Wi-Fi / Bridge V2, API Magellan),
en version web installable sur iPhone. C'est le portage de l'app Android Cozytouched (interface « Épure »).

## Installer sur iPhone

1. Ouvrir l'adresse de l'app dans **Safari**.
2. Bouton **Partager**, puis **Sur l'écran d'accueil**.
3. Ouvrir Cozytouched depuis son icône et se connecter avec le compte Cozytouch habituel.

## Fonctionnement

* Application statique (HTML, CSS, JavaScript sans dépendance) : elle parle directement aux serveurs Atlantic
  (`apis.groupe-atlantic.com`), aucun serveur intermédiaire.
* Identifiants : jeton de session et mot de passe chiffré (AES-GCM, clé non exportable) gardés sur l'appareil, envoyés
  uniquement aux serveurs Atlantic.
* Mode démo sans compte. Thème clair / sombre selon le téléphone.
* Non géré dans la version web : appareils « Cozytouch bridge » historiques (API Overkiz) et widget d'écran d'accueil.

## Avertissement

Projet personnel non officiel, sans lien avec Groupe Atlantic. Il utilise les mêmes services cloud que l'application
officielle, avec votre propre compte ; ces API ne sont pas documentées publiquement et peuvent changer sans préavis.

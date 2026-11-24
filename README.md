# Cozytouched (web : iPhone et Android)

Client simple et rapide pour les splits et chauffages **Atlantic Cozytouch** (appareils Wi-Fi / Bridge V2, API Magellan),
en version web installable sur **iPhone et Android**. C'est le portage de l'app Android Cozytouched (interface « Épure »).

Adresse : https://arthur-fr.github.io/cozytouched/

## Installer sur l'écran d'accueil

Ouvrir l'adresse dans le navigateur du téléphone et se connecter avec le compte Cozytouch habituel. L'app affiche
ensuite, sur son accueil, la marche à suivre adaptée au téléphone et au navigateur :

| Téléphone | Navigateur | Marche à suivre |
|---|---|---|
| iPhone / iPad | Safari | Bouton **Partager**, puis **Sur l'écran d'accueil** |
| iPhone / iPad | Chrome | Bouton **Partager** de la barre d'adresse, puis **Sur l'écran d'accueil** |
| Android | Chrome, Edge | Bouton **Installer** proposé par l'app, ou menu ⋮ › **Ajouter à l'écran d'accueil** |
| Android | Samsung Internet | Menu ≡ › **Ajouter la page à** › **Écran d'accueil** |
| Android | Firefox | Menu ⋮ › **Ajouter à l'écran d'accueil** |

Une fois installée, Cozytouched s'ouvre en plein écran depuis son icône, comme une app classique.

## Fonctionnement

* Application statique (HTML, CSS, JavaScript sans dépendance) : elle parle directement aux serveurs Atlantic
  (`apis.groupe-atlantic.com`), aucun serveur intermédiaire.
* Identifiants : jeton de session et mot de passe chiffré (AES-GCM, clé non exportable) gardés sur l'appareil, envoyés
  uniquement aux serveurs Atlantic.
* Mode démo sans compte. Thème clair / sombre selon le téléphone.
* Non géré dans la version web : appareils « Cozytouch bridge » historiques (API Overkiz) et widget d'écran d'accueil
  (sur Android, l'app native Cozytouched propose un widget).

## Avertissement

Projet personnel non officiel, sans lien avec Groupe Atlantic. Il utilise les mêmes services cloud que l'application
officielle, avec votre propre compte ; ces API ne sont pas documentées publiquement et peuvent changer sans préavis.

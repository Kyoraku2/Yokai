Réalisé par :
Marie-Almina GINDRE (TP2B - CMI)
Tayeb HAKKAR (TP2B - CMI)

Résumé : 
Ce projet correspond à notre implémentation du projet Yokai de l'UE de web avancé. Le sujet a été traité dans son intégralité (dont les diversifiers énumérés dans la suite de ce document) et le jeu est entièrement jouable. En plus de cela, le jeu est aussi agréable à l'oeil de part les dessins, animations et couleurs qui constituent sont interfaces.
(Spoiler à la fin, mais chercher tout seul c'est mieux ;))


Diversifiers réalisés :
- Ça va être tout noir" ★★☆☆  (CTRL+D)
- Boogie-woogie ★★☆☆ (cartes-familles et fond du menu)
- Qui me parle ? ★★☆☆
- Dieu du CSS ★★★☆  (Toutes les cartes (familles, dos et indices))


Pour mettre en place les packages :
npm install
(express@4.17.1 et socket.io@4.3.1)

Messages serveur/client : 

:: Reçus par le serveur ::
• create : création de la partie
• join : rejoindre une partie
• show_card : permet de dévoiler une carte (limite de deux pas tour)
• hide_card : permet de cacher une carte
• move_card_from : permet de sélectionner une carte à bouger
• move_card_to : permet de déplacer la carte précédemment sélectionnée à l'endroit voulu
• draw_hint : permet de piocher un indice
• select_hint : permet de sélectionner un indice à jouer
• play_hint : permet de jouer l'indice précédemment sélectionné
• stop_game : reçu quand l'un des joueur pense que les yokais sont apaisés (uniquement début de son tour)
• disconnect : déconnexion d'un des joueurs => fin de partie

:: Envoyés par le serveur ::
• your_turn : indique au joueur que c'est à son tour de jouer
• not_your_turn : indique au joueur que ce n'est pas à son tour de jouer
• start_screen : envoi d'une liste de partie en cours ou en attente
• error : détection d'un erreur (paramètres, validité, ...)
• waiting : indique que la partie est en attente d'autre joueurs
• send_grid : envoi de la grille de départ (généré coté serveur, envoi des positions uniquement)
• next_step : indique que le joueur passe à la prochaine étape de son tour
• family : indique la famille de la carte retournée
• card_hidden : indique que la carte a bien été caché (vérification de positions)
• previous_step : indique que le joueur retourne à l'étape précédente de son tour (mauvais placement d'indice ou de carte)
• card_moved : permet d'indiquer à tous les joueurs qu'une carte a changé de position (et donc de la déplacer chez tous les participants)
• get_hint : 
• end_turn : indique la fin d'un tour, changement de joueur courant
• played_hint : indique à tous les participants qu'un indice a été joué (donc de le jouer chez tous le monde)
• end_game : fin de partie (affichage des cartes + score + mention)
• deconnexion : indique la déconnexion d'un joueur à tous les joueurs










Spoiler :
- Cliquer sur la marre, le canard vous répondra.
- Cliquer sur le Kitsune (renard) pour entendre son cri !
- Attendez trop longtemps avant de joueur un tour, et vous serez comparé à une certaine personne.
- Cliquer sur le panneau il a des choses à vous dire.
- Trompez-vous avec la synthèse vocale, le texte change légèrement de celui affiché dans le panneau...

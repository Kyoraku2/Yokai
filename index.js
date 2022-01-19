"use strict";

// Chargement des modules
var express = require('express');
const { access } = require('fs');
const { posix } = require('path');
var app = express();

// cf. https://www.npmjs.com/package/socket.io#in-conjunction-with-express
const server = require('http').createServer(app);
const io = require('socket.io')(server);

server.listen(8080, function() {
    console.log("C'est parti ! En attente de connexion sur le port 8080...");
});

// Configuration d'express pour utiliser le répertoire "public"
app.use(express.static('public'));
// set up to
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/yokai.html');
});

// Parties en cours
let games = {};
// Compteur de parties
let counter = 0;

/**
 * Permet de joindre les positions de toutes les cartes dans un seul tableau
 * @param {*} grid Grille de jeu contenant les 4 familles
 * @returns L'ensemble des positions des cartes de chaque famille concaténées dans un tableau
 */
function computeFamiliesPositions(grid){
    var positions = [];
    for(var i=0, keys=Object.keys(grid); i<4; ++i){
      for(var j=0; j<4; ++j){
        positions.push(grid[keys[i]][j]);
      }
    }
    return positions;
  }

  /**
   * Permet de générer les cartes (random)
   * @param {*} grid Grille de la partie contenant les cartes des 4 familles
   */
function generateInitialCards(grid){
    var possible_pos = [];
    /*// Check yokai happy
    grid['A'] = [
        {x:0,y:0},
        {x:1,y:0},
        {x:2,y:0},
        {x:3,y:0}
    ];
    grid['B'] = [
        {x:0,y:1},
        {x:1,y:1},
        {x:2,y:1},
        {x:3,y:1}
    ];
    grid['C'] = [
        {x:0,y:2},
        {x:1,y:2},
        {x:2,y:2},
        {x:3,y:2}
    ];
    grid['D'] = [
        {x:0,y:3},
        {x:1,y:3},
        {x:2,y:3},
        {x:3,y:3}
    ];*/
    // Génération de positions possible
    var nb_cards = 16;
    var nb_cards_family = 4;
    for(var i = 0 ; i<nb_cards_family ; ++i){
        for(var j = 0 ; j<nb_cards_family ; ++j){
            possible_pos.push({
                x:i,
                y:j
            });
        }
    }

    // Tirage aléatoire dans les positions possibles restantes
    for(var i=0 ; i<nb_cards ; ++i){
        var random = Math.floor(Math.random() * possible_pos.length);
        if(grid.A.length < nb_cards_family){
            grid.A.push(possible_pos[random]);
        }else{
            if(grid.B.length < nb_cards_family){
                grid.B.push(possible_pos[random]);
            }else{
                if(grid.C.length < nb_cards_family){
                    grid.C.push(possible_pos[random]);
                }else{
                    grid.D.push(possible_pos[random]);
                }
            }
        }
        // Position occupée
        possible_pos.splice(random,1);
    }
}

/**
 * Permet de supprimer une partie finie ou interrompue
 * @param {*} game Partie à supprimer
 */
function deleteGame(game) {
    console.log("Suppression de la partie " + game);
    delete games[game];
}

/**
 * Permet de générer les indices (random parmit les 14 possibilités)
 * @param {*} game Partie à laquelle les indices sont ajoutés
 */
function generateHints(game){
    // 2 : 2 de 1, 3 de 2, 2 de 3
    // 3 : 2 de 1, 4 de 2, 3 de 3
    // 4 : 3 de 1, 4 de 2, 3 de 3
    var combos1 = [
        "A","B","C","D"
    ];
    var combos2 = [
        "AB","AC","AD","BC","BD","CD"
    ];
    var combos3 = [
        "ABC","ABD","ACD","CDB"
    ];
    // Définition du nombre de cartes hint selon le nombre de joueurs
    var nb1,nb2,nb3;
    switch(game.nb_players){
        case 2:
            nb1=2;
            nb2=3;
            nb3=2;
            break;
        case 3:
            nb1=2;
            nb2=4;
            nb3=3;
            break;
        case 4:
            nb1=3;
            nb2=4;
            nb3=3;
            break;
    }

    // Combos 1
    for(var i=0 ; i<nb1 ; ++i){
        var index = Math.floor(Math.random() * combos1.length);
        game.hints.push({
            families: [combos1[index]],
            x : undefined,
            y : undefined
        });
        combos1.splice(index,1);
    }
    // Combos 2
    for(var i=0 ; i<nb2 ; ++i){
        var index = Math.floor(Math.random() * combos2.length);
        var families = [];
        for(var j=0 ; j<combos2[index].length ; ++j){
            families.push(combos2[index].charAt(j));
        }
        combos2.splice(index,1);
        game.hints.push({
            families: families,
            x : undefined,
            y : undefined
        });
    }

    // Combos 3
    for(var i=0 ; i<nb3 ; ++i){
        var index = Math.floor(Math.random() * combos3.length);
        var families = [];
        for(var j=0 ; j<combos3[index].length ; ++j){
            families.push(combos3[index].charAt(j));
        }
        combos3.splice(index,1);
        game.hints.push({
            families: families,
            x : undefined,
            y : undefined
        });
    }
}

/**
 * Permet de trouver un objet {x:,y:} dans un tableau
 * @param {*} array Tableau dans lequel la recherche est faite
 * @param {*} pos Position de l'objet recherché
 * @returns L'objet si trouvé, undefined sinon
 */
function findCard(array,pos){
    return array.find(function(element){
        return element.x === pos.x && element.y === pos.y;
    },pos);
}

/**
 * Permet de commencer une partie (une fois le nombre de joueurs nécessaires atteint)
 * @param {*} games Ensemble des parties du serveur
 * @param {*} game Partie courante
 */
function startGame(games,game){
    console.log("Début de la partie " + game);
    games[game].courant = Math.floor(Math.random() * games[game].nb_players);
    games[game].players[games[game].courant].socket.emit("your_turn","Démarrage de la partie, tu as le plus peur des fantômes.");
    for(var i=0, l=games[game].players.length ; i<l ; ++i){
        if(i!=games[game].courant){
            games[game].players[i].socket.emit("not_your_turn","Démarrage de la partie, ce n'est pas ton tour.");
        }else{
            games[game].players[i].status++;
        }
    }
    games[game].started=true;
}

/**
 * Permet de vérifier si la grille de jeu contient une carte (en fonction de ses coordonnées)
 * @param {*} grid Grille de la partie contenant les cartes des 4 familles
 * @param {*} coo Objet de la forme {x:,y:} correspondant aux coordonnées de la carte recherchée
 * @returns L'objet associé à la carte si trouvé, undefined sinon.
 */
function hasCard(grid,coo){
    var tmp;
    if((tmp = findCard(grid.A,coo)) !== undefined){
        return tmp;
    }
    if((tmp = findCard(grid.B,coo)) !== undefined){
        return tmp;
    }
    if((tmp = findCard(grid.C,coo)) !== undefined){
        return tmp;
    }
    if((tmp = findCard(grid.D,coo)) !== undefined){
        return tmp;
    }
    return undefined;
}

/**
 * Permet de construire une matrice d'adjacence pour les cartes d'une même famille (utilisée pour vérifier si les yokais sont calmés)
 * @param {*} family Famille contenant 4 cartes
 * @returns Matrice d'adjacence des cartes de la famille donnée en paramètre
 */
function familyAdj(family){
    var accessibles = [];
    for(var i=0 , l=family.length ; i<l ; ++i){
        var access = [];
        var up = findCard(family,{x:family[i].x,y:family[i].y-1});
        var left = findCard(family,{x:family[i].x-1,y:family[i].y});
        var right = findCard(family,{x:family[i].x+1,y:family[i].y});
        var down = findCard(family,{x:family[i].x,y:family[i].y+1});
        if(up!==undefined){
            access.push(family.indexOf(up));
        }
        if(left!==undefined){
            access.push(family.indexOf(left));
        }
        if(right!==undefined){
            access.push(family.indexOf(right));
        }
        if(down!==undefined){
            access.push(family.indexOf(down));
        }
        accessibles[i]=access;
    }
    return accessibles;
}

/**
 * Permet de déterminer si les yokais sont calmés (Deep First Search utilisée)
 * @param {*} game Partie courante
 * @returns true si les yokais si calmés (victoire), false sinon (défaite)
 */
function yokaiHappy(game){
    // Verification famille A
    var adj=familyAdj(game.grid['A']);
    var visited={};
    var access = DFS(adj,visited,0);
    if(Object.keys(access).length!==game.grid['A'].length){
        return false;
    }
    // Verification famille B
    adj=familyAdj(game.grid['B']);
    visited={};
    access = DFS(adj,visited,0);
    if(Object.keys(access).length!==game.grid['B'].length){
        return false;
    }
    // Verification famille C
    adj=familyAdj(game.grid['C']);
    visited={};
    access = DFS(adj,visited,0);
    if(Object.keys(access).length!==game.grid['C'].length){
        return false;
    }
    // Verification famille D
    adj=familyAdj(game.grid['D']);
    visited={};
    access = DFS(adj,visited,0);
    return Object.keys(access).length===game.grid['D'].length;
}

/**
 * Permet de créer une matrice d'adjacence pour une carte du plateau de jeu (utilisée pour valider le déplacement des cartes)
 * @param {*} grid Grille de jeu de la partie courante
 * @param {*} from Position de départ
 * @returns L'ensemble des cartes accessibles depuis une carte donnée
 */
function accessibleFrom(grid,from){
    var accessibles = [];
    var up = hasCard(grid,{x:from.x,y:from.y-1});
    var left = hasCard(grid,{x:from.x-1,y:from.y});
    var right = hasCard(grid,{x:from.x+1,y:from.y});
    var down = hasCard(grid,{x:from.x,y:from.y+1});
    if(right!==undefined){
        accessibles.push(right);
    }
    if(left!==undefined){
        accessibles.push(left);
    }
    if(up!==undefined){
        accessibles.push(up);
    }
    if(down!==undefined){
        accessibles.push(down);
    }
    return accessibles;
}

/**
 * Permet de créer une matrice d'adjacence pour toutes les cartes du plateau de jeu (utilisée pour valider le déplacement des cartes)
 * @param {*} grid Grille de jeu de la partie courante
 * @returns Matrice d'adjacence représentant le plateau de jeu
 */
function allAccessible(grid){
    var adj = [];
    var allPos = computeFamiliesPositions(grid);
    for(var i = 0, l=allPos.length ; i<l ; ++i){
        var tmp = accessibleFrom(grid,allPos[i]);
        adj.push([]);
        for(var j = 0, l2=tmp.length ; j<l2 ; ++j){
            adj[adj.length-1].push(allPos.indexOf(findCard(allPos,tmp[j])));
        }
    }
    return adj;
}

/**
 * Permet de récupérer la famille d'une carte (pour la retourner)
 * @param {*} grid Grille de jeu de la partie courante
 * @param {*} coo Coordonnées de la carte recherchée
 * @returns La famille si la carte existe, undefined sinon
 */
function look4Family(grid,coo){
    var tmp;
    if((tmp = findCard(grid.A,coo)) !== undefined){
        return "A";
    }
    if((tmp = findCard(grid.B,coo)) !== undefined){
        return "B";
    }
    if((tmp = findCard(grid.C,coo)) !== undefined){
        return "C";
    }
    if((tmp = findCard(grid.D,coo)) !== undefined){
        return "D";
    }
    return undefined;
}

/**
 * Algo DFS (Deep First Search)
 * @param {*} adj Matrice d'adjacence à parcourir
 * @param {*} visited Sommets déjà visités
 * @param {*} s Sommet de départ
 * @returns Ensemble des sommets qui ont été visité
 */
function DFS(adj,visited,s){
    visited[s]=true;
    for(var i = 0, l = adj[s].length ; i < l ; ++i){
        if(!visited[adj[s][i]]){
            DFS(adj,visited,adj[s][i]);
        }
    }
    return visited;
}

/**
 * Permet de retourner les informations de fin de partie dans un seul objet
 * @param {*} game Partie courante (fin)
 * @returns Objet permettant de savoir si la partie est gagnée, le score et l'ensemble de cartes/familles (affichage de fin)
 */
function endGame(game){
    return {
        victory: yokaiHappy(game), //true ou false
        score: get_score(game), // score et mention
        grid: game.grid // grille finale, positions des yokai
    };
}

/**
 * Permet de calculer le score en fin de partie
 * @param {*} game Partie courante (fin)
 * @returns Objet contenant le score et la mention
 */
function get_score(game){
    var score = 0;
    var result = {score:0,mention:""};

    // Si pas tiré : 5pts
    score+= game.hints.length*5;
    for(var i=0,l=game.drown_hints.length;i<l;i++){
        // Si tiré mais pas utilisé 2pts
        if(game.drown_hints[i].x==undefined && game.drown_hints[i].y==undefined){
            score += 2;
            continue;
        }
        var card_family = look4Family(game.grid,{x:game.drown_hints[i].x,y:game.drown_hints[i].y});
        // Si bien placé 1pt
        if(game.drown_hints[i].families.includes(card_family)){
            score++;
        }else{ // Si mal placé -1pt
            score--;
        }
    }
    result.score = score;

    // Définition de la mention
    if(game.nb_players == 2){
        if(score < 8){
        result.mention = "Honorable";
        return result;
        }
        if(score < 12){
        result.mention = "Glorieuse";
        return result;
        }
        result.mention = "Totale";
        return result;
    }

    if(game.nb_players == 3){
        if(score < 10){
        result.mention = "Honorable";
        return result;
        }
        if(score < 14){
        result.mention = "Glorieuse";
        return result;
        }
        result.mention = "Totale";
        return result;
    }

    if(game.nb_players == 4){
        if(score < 11){
        result.mention = "Honorable";
        return result;
        }
        if(score < 15){
        result.mention = "Glorieuse";
        return result;
        }
        result.mention = "Totale";
        return result;
    }
    return result;
}

/**
 * Permet de générer la liste de parties qui sera affichée sur l'écran de démarrage
 * @param {*} games Liste de parties
 * @returns 
 */
function generateGamesList(games){
    var game_list=[];
    for(var i=0, keys=Object.keys(games) ,l=keys.length; i<l; ++i){
        if(games[keys[i]].nb_players>games[keys[i]].players.length){
            game_list.push({
                index : keys[i],
                max_players:games[keys[i]].nb_players,
                players:games[keys[i]].players.length
            });
        }
    }
    return game_list;
}


// Réception d'une connexion
io.on('connection', function (socket) {
    // message de debug
    console.log("Un client s'est connecté");
    var index = -1;     // -1 : en attente de partie, 0/1/2/3 position dans le tableau de joueurs.
    var game=null;      // id game
    var returned_cards = []; // utilisé pour show_card et hide_card
    var move_from_to = {from:undefined,to:undefined}; // utilisé pour move_card_from et move_card_to
    

    
    // Récupèration de la liste pour le menu de départ
    socket.emit("start_screen",generateGamesList(games));

    /**
    *  Gestion des connexions
    */

    // Création de la partie
    socket.on("create",function(nb_players){
        console.log("Il a rejoint la game");
        // Si le joueur est déjà en train de jouer à une partie
        if (index != -1) {
            socket.emit("error", "Joueur déjà connecté.");
            return;
        }
        // Création
        counter++;
        game=counter;
        games[game] = {
            nb_players : parseInt(nb_players),
            players : [],
            courant : -1,
            grid : {
                A : [],
                B : [],
                C : [],
                D : []
            },
            hints : [],
            drown_hints : [],
            started:false
        }
        // Génération des cartes hint et yokai
        generateInitialCards(games[game].grid);
        generateHints(games[game]);
        index=0;

        games[game].players[index] = {
            socket: socket,
            status: 0
        }
        // games[game].players[index].status :
        // 0 : rien
        // 1 : show card
        // 2 : hide carte
        // 3 : deplacement from
        // 4 : deplacement to
        // 5 : indice, si clique sur la pioche 
        // 6 : indice, si clique sur un indice à placer

        // Messages debug et attente
        console.log("  -> joueur ajouté à la partie " + game + ", à l'indice " + index);
        socket.emit("waiting","Partie rejoint. En attente de"+(games[game].nb_players-games[game].players.length)+"autre(s) joueur(s) ou lancement de la partie par le joueur 1.");
        // Envoie des positions des cartes
        socket.emit("send_grid",computeFamiliesPositions(games[game].grid));
    });

    socket.on("join", function(id) {
        id = parseInt(id);
        console.log("Il a rejoint la game");
        // Déja en train de jouer
        if (index != -1) {
            socket.emit("error", "Joueur déjà connecté.");
            return;
        }
        // Partie inconnues
        if(games[id]==undefined){
            socket.emit("error", "Partie inexistante.");
            return;
        }

        // Ajout du joueur à la partie associée à l'id
        if(games[id].players.length<games[id].nb_players){
            game = id;
            index = games[game].players.length;
            games[game].players[index] = {
                socket: socket,
                status: 0
            }
            console.log("  -> joueur ajouté à la partie " + game + ", à l'indice " + index);
            socket.emit("send_grid",computeFamiliesPositions(games[game].grid));
            // Lancement de la partie
            if(games[game].players.length == games[game].nb_players){
                startGame(games,game);
            }else{
                socket.emit("waiting","Partie rejoint. En attente de"+(games[game].nb_players-games[game].players.length)+"autre(s) joueur(s) ou lancement de la partie par le joueur 1.");
            }
        }else{
            socket.emit("error", "Partie complète.");
        }
    });

    /**
    * Gestion des tours
    */

    // Voir une carte
    socket.on("show_card", function(pos){
        // Vérifications
        if (game == null || ! games[game]){
            socket.emit("error", "Pas de partie en cours.");
            return;
        }
        pos.x = parseInt(pos.x);
        pos.y = parseInt(pos.y);
        if(games[game].courant!=index){
            socket.emit("error", "Ce n'est pas à ton tour de jouer.");
            return;
        }
        if(games[game].players[games[game].courant].status!=1){
            socket.emit("error", "Il faut jouer un tour dans le bon ordre.");
            return;
        }

        // Position de la carte à montrer
        var card_pos = hasCard(games[game].grid,pos);
        if(card_pos === undefined){
            socket.emit("error", "Vous ne pouvez pas retourner ici il n'y a pas de carte.");
            return;
        }
        if(findCard(games[game].drown_hints,card_pos)!==undefined){
            socket.emit("error","Carte bloquée par un indice.");
            return;
        }
        if(returned_cards.length >= 2){
            socket.emit("error", "Deux cartes on déjà été retourné.");
            return;
        }
        for(var i=0,l=returned_cards.length; i<l; ++i){
            if(returned_cards[i].x==pos.x && returned_cards[i].y==pos.y){
            socket.emit("error", "Vous avez déja retourné cette carte.");
            return;
            }
        }

        // Message debug
        console.log("("+game+","+index+") - Retourne carte en ("+pos.x+","+pos.y+")");
        returned_cards.push(card_pos);
        if(returned_cards.length==2){
            // Passage à l'étape suivante du tour
            socket.emit('next_step');
            games[game].players[games[game].courant].status++;
        }

        games[game].players[games[game].courant].socket.emit("family",{
            family : look4Family(games[game].grid,pos),
            coo : {
                x: card_pos.x,
                y: card_pos.y
            }
        });
    });

    // Cacher une carte
    socket.on("hide_card", function(pos){
        // Vérifications
        if (game == null || ! games[game]){
            socket.emit("error", "Pas de partie en cours.");
            return;
        }
        pos.x = parseInt(pos.x);
        pos.y = parseInt(pos.y);
        if(games[game].courant!=index){
            socket.emit("error", "Ce n'est pas à ton tour de jouer.");
            return;
        }
        if(games[game].players[games[game].courant].status!=2){
            socket.emit("error", "Il faut jouer un tour dans le bon ordre.");
            return;
        }
        // Position de la carte à chacher
        var card_pos = hasCard(games[game].grid,pos);
        if(card_pos === undefined){
            socket.emit('error',"Vous ne pouvez pas retourner ici il n'y a pas de carte.");
            return;
        }
        if(findCard(games[game].drown_hints,card_pos)!==undefined){
            socket.emit("error","Carte bloquée par un indice.");
            return;
        }
        var hidden = false;

        // Cacher la carte
        for(var i=0,l=returned_cards.length;i<l;++i){
            if(returned_cards[i].x==card_pos.x && returned_cards[i].y==card_pos.y){
                console.log("("+game+","+index+") - Cache carte en ("+card_pos.x+","+card_pos.y+")");
                returned_cards.splice(i,1);
                // Passage à l'étape suivante du tour
                if(returned_cards.length==0){
                    socket.emit('next_step');
                    games[game].players[games[game].courant].status++;
                }
                hidden=true;
                socket.emit('card_hidden',card_pos);
                break;
            }
        }


        if(!hidden){
            socket.emit('error',"Cette carte est déja cachée.");
        }
    });

    // Sélection carte à déplacer
    socket.on('move_card_from',function(from){
        // Vérifications
        if (game == null || ! games[game]){
            socket.emit("error", "Pas de partie en cours.");
            return;
        }
        from.x = parseInt(from.x);
        from.y = parseInt(from.y);
        if(games[game].courant!=index){
            socket.emit("error", "Ce n'est pas à ton tour de jouer.");
            return;
        }
        if(games[game].players[games[game].courant].status!=3){
            socket.emit("error", "Il faut jouer un tour dans le bon ordre.");
            return;
        }
        // Position de la carte sélectionnée
        var card_pos = hasCard(games[game].grid,from);
        if(card_pos===undefined){
            socket.emit('error',"Il n'y a pas de carte à déplacer.");
            return;
        }
        if(findCard(games[game].drown_hints,card_pos)!==undefined){
            socket.emit("error","Carte bloquée par un indice.");
            return;
        }

        // Passage à l'étape suivante du tour
        move_from_to.from = card_pos;
        socket.emit('next_step');
        games[game].players[games[game].courant].status++;
    });

    // Sélection position de destination
    socket.on('move_card_to',function(to){
        // Vérifications
        if (game == null || ! games[game]){
            socket.emit("error", "Pas de partie en cours.");
            return;
        }
        to.x = parseInt(to.x);
        to.y = parseInt(to.y);
        if(games[game].courant!=index){
            socket.emit("error", "Ce n'est pas à ton tour de jouer.");
            return;
        }
        if(games[game].players[games[game].courant].status!=4){
            socket.emit("error", "Il faut jouer un tour dans le bon ordre.");
            return;
        }
        to.x=parseInt(to.x);
        to.y=parseInt(to.y);
        if(move_from_to.from===undefined){
            socket.emit('error','Aucune carte sélectionnée.')
            return;
        }
        var card_exits = hasCard(games[game].grid,to);
        if(card_exits!==undefined){
            socket.emit('error',"Il y a déjà une carte là où vous souhaitez.");
            // Retour à l'étape précédente du tour
            games[game].players[games[game].courant].status--;
            socket.emit("previous_step");
            return;
        }
        move_from_to.to = to;

        // Adjecence entre les cartes
            // Mouvement
        var from_family = look4Family(games[game].grid,move_from_to.from);
        var from_index = games[game].grid[from_family].indexOf(findCard(games[game].grid[from_family],move_from_to.from));
        games[game].grid[from_family][from_index]=move_from_to.to;
            //Vérification adjacence
        var moves = allAccessible(games[game].grid);
        var visited={};
        var access = DFS(moves,visited,0);
            // Annulation du mouvement si pas adjacence
        if(Object.keys(access).length != 16){
            games[game].grid[from_family][from_index]=move_from_to.from;
            games[game].players[index].socket.emit("error","Impossible de réaliser ce mouvement, les cartes ne seraient plus toutes accessibles entre elles.");
            // Retour à l'étape précédente du tour
            games[game].players[games[game].courant].status--;
            socket.emit("previous_step");
            return;
        }

        // Passage à l'étape suivante du tour
        socket.emit('next_step');
        games[game].players[games[game].courant].status++;

        // Mouvement de la carte chez tous les joueurs
        for(var i=0, l=games[game].players.length ; i<l ; ++i){
            games[game].players[i].socket.emit("card_moved",move_from_to);
        }
    });

    // Piocher un indice
    socket.on('draw_hint',function(){
        // Vérifications
        if (game == null || ! games[game]){
            socket.emit("error", "Pas de partie en cours.");
            return;
        }
        if(games[game].courant!=index){
            socket.emit("error", "Ce n'est pas à ton tour de jouer.");
            return;
        }
        if(games[game].players[games[game].courant].status!=5){
            socket.emit("error", "Il faut jouer un tour dans le bon ordre.");
            return;
        }

        if(games[game].hints.length==0){
            socket.emit("error", "Il n'y a plus d'indice à retourner.");
            return;
        }

        // Pioche
        var hint_index = Math.floor(Math.random() * games[game].hints.length);
        games[game].drown_hints.push(games[game].hints[hint_index]);
        // Envoi à tous les joueurs
        for(var i = 0, l=games[game].nb_players ; i<l ; ++i){
            games[game].players[i].socket.emit("get_hint", {
                index:games[game].drown_hints.length-1,
                families:games[game].hints[hint_index].families
            });   
        }
        games[game].players[games[game].courant].status++;
        games[game].hints.splice(hint_index,1);

        // Changement de joueur (fin dne tour)
        games[game].players[games[game].courant].status=0;
        games[game].courant=(games[game].courant+1)%games[game].nb_players;
        games[game].players[games[game].courant].status=1;
        games[game].players[games[game].courant].socket.emit("your_turn","A toi de jouer !");
        // Fin de tour
        socket.emit('end_turn');
    });

    // Sélection d'un indice à jouer
    socket.on("select_hint",function(hint_index){
        // Vérifications
        if (game == null || ! games[game]){
            socket.emit("error", "Pas de partie en cours.");
            return;
        }
        // id de l'indice sélectionné
        hint_index = parseInt(hint_index);
        if(games[game].courant!=index){
            socket.emit("error", "Ce n'est pas à ton tour de jouer.");
            return;
        }
        if(hint_index < 0 && hint_index < games[game].drown_hints.length){
            socket.emit("error", "L'indice joué n'a jamais été pioché.");
            return;
        }
        if(games[game].drown_hints[hint_index]===undefined){
            socket.emit("error", "L'indice joué n'a jamais été pioché.");
            return;
        }
        if(games[game].drown_hints[hint_index].x!==undefined && games[game].drown_hints[hint_index].y!==undefined){
            socket.emit("error", "L'indice a déjà été joué.");
            return;
        }
        // Passage à l'étape suivante du tour
        socket.emit('next_step');
        games[game].players[games[game].courant].status++;
    });

    // Placement de l'indice
    socket.on('play_hint',function(hint){
        // Vérifications
        if (game == null || ! games[game]){
            socket.emit("error", "Pas de partie en cours.");
            return;
        }
        // coordonnées et id de l'indice
        hint.coo.x = parseInt(hint.coo.x);
        hint.coo.y = parseInt(hint.coo.y);
        hint.index = parseInt(hint.index);

        if(games[game].courant!=index){
            socket.emit("error", "Ce n'est pas à ton tour de jouer.");
            return;
        }
        if(games[game].players[games[game].courant].status!=6){
            socket.emit("error", "Il faut jouer un tour dans le bon ordre.");
            return;
        }
        // Position de destination
        var tmp = hasCard(games[game].grid,hint.coo);
        if(tmp===undefined){
            socket.emit("error", "Il n'y a pas de carte là où vous voulez jouer l'indice.");
            // Retour à l'étape précédente du tour
            games[game].players[games[game].courant].status--;
            socket.emit("previous_step");
            return;
        }
        if(findCard(games[game].drown_hints,tmp)!==undefined){
            socket.emit("error","Carte bloquée par un indice.");
            return;
        }

        // Placement de l'indice
        games[game].drown_hints[hint.index].x = hint.coo.x;
        games[game].drown_hints[hint.index].y = hint.coo.y;
        // Changement de joueur (fin de tour)
        socket.emit('end_turn');
        games[game].players[games[game].courant].status=0;
        games[game].courant=(games[game].courant+1)%games[game].nb_players;
        games[game].players[games[game].courant].status=1;
        games[game].players[games[game].courant].socket.emit("your_turn","A toi de jouer !");
        // Envoi à tous les joueurs
        for(var i=0, l=games[game].players.length ; i<l ; ++i){
            games[game].players[i].socket.emit("played_hint",{index:hint.index,to:hint.coo});
        }
        // Fin de partie (plus d'indices à piocher ou jouable)
        if(games[game].hints.length == 0){
            var end = true;
            for(var i=0, l=games[game].drown_hints.length ; i<l ; ++i){
                if(games[game].drown_hints[i].x==undefined && games[game].drown_hints[i].y==undefined){
                    end=false;
                }
            }
            if(end){
                var res = endGame(games[game]);
                for(var i=0, l=games[game].players.length ; i<l ; ++i){
                    games[game].players[i].socket.emit("end_game",res);
                }
                deleteGame(game);
            }
        }
    });

    // Fin de partie
    socket.on("stop_game",function(){
        // Vérifications
        if(games[game]) {
            if(games[game].courant!=index){
                socket.emit("error", "Ce n'est pas à ton tour de jouer.");
                return;
            }
            // Fin
            if(games[game].players[games[game].courant].status==1 && returned_cards.length==0){
                var res = endGame(games[game]);
                // Envoi à tous les joueurs
                for(var i=0, l=games[game].players.length ; i<l ; ++i){
                    games[game].players[i].socket.emit("end_game",res);
                }
                // Suppression de la partie
                deleteGame(game);
            }else{
                socket.emit("error", "Il faut être au début du tour pour mettre fin à la partie.");
            }
        }
    });

    /**
    *  Gestion des déconnexions
    */
    socket.on("disconnect", function() {
        console.log("Déconnexion d'un client");
        if(games[game]) {
            console.log("Fin de partie, un des joueurs a quitté la partie.");
            for(var i=0,l=games[game].players.length; i<l; ++i){
                if(i!=index){
                    games[game].players[i].socket.emit("deconnexion", "Fin de la partie un joueur à abandonné.");
                }
            }
            deleteGame(game);
        }
    });
});

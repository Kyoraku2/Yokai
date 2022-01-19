// GINDRE Marie-Almina TP2B - CMI
// HAKKAR Tayeb TP2B - CMI

document.addEventListener("DOMContentLoaded", function() {

  // socket ouverte vers le serveur
  let sock = io.connect();

  var WIDTH_MIN = 0;
  var WIDTH_MAX = 3;
  var HEIGHT_MIN = 0;
  var HEIGHT_MAX = 3;

  var returned_cards = [];
  var status = 0;
  var grid;
  var hint_index = -1;
  var mute=false;
  var timer;


  // 0 rien
  // 1 show card
  // 2 hide carte
  // 3 deplacement from
  // 4 deplacement to
  // 5 indice (si clique sur pioche pioche sinon on choisi un indice a bouger )
  // 6 QUE SI 5 -> CHOISI POS2 : pose un indice sur la grille

  var table = document.createElement('table');
  table.setAttribute('id','grille');


  /**
   * Permet de générer, dans l'écran d'accueil, le select contenant les parties en cours qu'il est possible de rejoindre
   *
   * @param games Array Tableau des parties en cours
   * @param game.max_players Number Le nombre de joueurs maximum pour la partie (défini lors de sa création)
   * @param game.players Number Nombre de joueurs actuellement dans la partie
   * @param game.index L'index de la partie
   */
  sock.on("start_screen",function(games){
    // récupération dans games de la liste des parties existantes pour laisser le choix au joueur d'en rejoindre une
    var select = document.getElementById('selectJoin');
    for(var i=0, l=games.length; i<l; ++i){
      var option = document.createElement('option');
      option.innerHTML=games[i].players+" / "+games[i].max_players;
      option.value=games[i].index;
      option.dataset.nbj=games[i].max_players;
      select.appendChild(option);
    }

  });

  /**
   * Permet de dire à l'utilisateur que c'est à son tour de jouer
   *
   * @param msg String Message à afficher
   */
  sock.on("your_turn",function(msg){
    status = 1;
    document.getElementById("message").innerHTML=msg+"<br>Clique sur deux cartes pour les retourner.";
    speakIndications(msg+" Clique sur deux cartes pour les retourner.");
    clearTimeout(timer);
    timer = setTimeout(function(){
      speakIndications("Encore plus long que jube quand il corrige ses copies");
    }, 30000);
  });

  /**
   * Permet de dire à l'utilisateur que c'est le tour d'un autre joueur
   *
   * @param msg String Message à afficher
   */
  sock.on("not_your_turn",function(msg){
    document.getElementById("message").innerHTML=msg;
    speakIndications(msg);
  });

  /**
   * Permet de dire à l'utilisateur que la partie est terminé car un joueur a abandonné
   *
   * @param msg String Message à afficher
   */
  sock.on("deconnexion",function(msg){
    document.getElementById("message").innerHTML=msg;
    speakIndications(msg);
  });

  /**
   * Permet de recevoir la grille de jeu (sans les familles)
   *
   * @param game_grid Array Contient la position de chaque carte
   */
  sock.on("send_grid", function(game_grid){
    grid = game_grid;
    addCardsToTable();
  });

  /**
   * Affiche un message d'erreur
   *
   * @param msg String Contient le message de l'erreur
   */
  sock.on("error", function(msg){
    alert(msg);
    speakIndications(msg+generateRandomInsult());
  });

  /**
   * Indique la fin d'un tour d'un joueur, permet de changer son statut en conséquence et de prévenir le joueur
   *
   */
  sock.on("end_turn",function(){
    if(status==6){
      hint_index=-1;
    }
    var msg = document.getElementById("message");
    status=0;
    msg.innerHTML="Ce n'est plus ton tour de jouer.";
    speakIndications("Ce n'est plus ton tour de jouer.");
    clearTimeout(timer);
  });


  /**
   * Permet de passer à l'étape de jeu suivante, on le reçoit lorsque le joueur à correctement effectué l'étape courante
   *
   */
  sock.on("next_step",function(){
    status++;
    updatePanneau();
    clearTimeout(timer);
    timer = setTimeout(function(){
      speakIndications("Encore plus long que jube quand il corrige ses copies");
    }, 30000);

  });

  /**
   * Permet de revenir à l'étape précédente lors d'une erreur (pour ne pas se retrouver bloqué à une étape)
   *
   */
  sock.on("previous_step",function(){
    status--;
    updatePanneau();
  });

  /**
   * Permet d'afficher un indice sur la grille (de le déplacer de la grille des indices au plateau de jeu)
   *
   * @param res Object Contient la future position de l'indice et son index
   */
  sock.on("played_hint",function(res){
    moveHint(res.index,res.to);
  });


  /**
   * Permet de mettre à jour le plateau lorsqu'un autre joueur déplace une carte
   *
   * @param coo Object Contient la position de départ et d'arrivée de la carte
   */
  sock.on("card_moved",function(coo){
    moveCard(coo.from,coo.to);
  });

  /**
   * Permet de cacher une carte qui avait été retournée par le joueur
   *
   * @param coo Object Contient la position de la carte à cacher
   */
  sock.on("card_hidden",function(coo){
    var card =document.querySelector('[data-x="'+coo.x+'"][data-y="'+coo.y+'"]');
    card.innerHTML='<div class="cartesDos"><div class="darkCenter"><div class="corners corner-LU"> </div><div class="cornersBis corner-LU-A"> </div><div class="cornersBis corner-LU-B"> </div><div class="corners corner-RU"> </div><div class="cornersBis corner-RU-A"> </div><div class="cornersBis corner-RU-B"> </div><div class="lightCenter"><div class="tinyCenter"><div class="tinyCenter tinyCenter-A"><div class="tinyCenter tinyCenter-B"> </div></div>  </div></div><div class="corners corner-LD"> </div><div class="cornersBis corner-LD-A"> </div><div class="cornersBis corner-LD-B"> </div><div class="corners corner-RD"> </div><div class="cornersBis corner-RD-A"> </div><div class="cornersBis corner-RD-B"> </div></div></div>'
    ;
    var tmp = findCard(returned_cards,coo);
    returned_cards.splice(returned_cards.indexOf(tmp),1);
  });

  /**
   * Permet d'afficher la famille d'une carte lorsqu'on la retourne
   *
   * @param card Object Contient la position de la carte et sa famille
   */
  sock.on("family",function(card){
    returnCard(card.family,card.coo);
    returned_cards.push(card.coo);
  });

  /**
   * Permet d'afficher un hint tiré sur le côté de l'écran
   *
   * @param hint Object contient le hint a positionner
   */
  sock.on("get_hint",function(hint){
    var carte = document.querySelector('[data-index="'+hint.index+'"]');
    var classes = "family hint";
    for(var i=0, l=hint.families.length ; i<l ; ++i){
      classes+=" family"+hint.families[i];
    }
    switch(hint.families.length){
      case 1:
        switch(hint.families[0]){
          case 'A':
            carte.innerHTML='<div class="cartesDos"><div class="'+classes+'"><div class="corners corner-LU"> </div><div class="cornersBis corner-LU-A"> </div><div class="cornersBis corner-LU-B"> </div><div class="corners corner-RU"> </div><div class="cornersBis corner-RU-A"> </div><div class="cornersBis corner-RU-B"> </div><div class="tinyCenter tinyCenter-A"><div class="tinyCenter tinyCenter-B"> </div></div><div class="corners corner-LD"> </div><div class="cornersBis corner-LD-A"> </div><div class="cornersBis corner-LD-B"> </div><div class="corners corner-RD"> </div><div class="cornersBis corner-RD-A"> </div><div class="cornersBis corner-RD-B"> </div></div></div>';
          break;
          case 'B':
            carte.innerHTML='<div class="cartesDos"><div class="'+classes+'"><div class="corners corner-LU"> </div><div class="cornersBis corner-LU-A"> </div><div class="cornersBis corner-LU-B"> </div><div class="corners corner-RU"> </div><div class="cornersBis corner-RU-A"> </div><div class="cornersBis corner-RU-B"> </div><div class="tinyCenter tinyCenter-A"><div class="tinyCenter tinyCenter-B"> </div></div><div class="corners corner-LD"> </div><div class="cornersBis corner-LD-A"> </div><div class="cornersBis corner-LD-B"> </div><div class="corners corner-RD"> </div><div class="cornersBis corner-RD-A"> </div><div class="cornersBis corner-RD-B"> </div></div>';
          break;
          case 'C':
            carte.innerHTML='<div class="cartesDos"><div class="'+classes+'"><div class="corners corner-LU"> </div><div class="cornersBis corner-LU-A"> </div><div class="cornersBis corner-LU-B"> </div><div class="corners corner-RU"> </div><div class="cornersBis corner-RU-A"> </div><div class="cornersBis corner-RU-B"> </div><div class="tinyCenter tinyCenter-A"><div class="tinyCenter tinyCenter-B"> </div></div><div class="corners corner-LD"> </div><div class="cornersBis corner-LD-A"> </div><div class="cornersBis corner-LD-B"> </div><div class="corners corner-RD"> </div><div class="cornersBis corner-RD-A"> </div><div class="cornersBis corner-RD-B"> </div></div></div>';
          break;
          case 'D':
            carte.innerHTML='<div class="cartesDos"><div class="'+classes+'"><div class="corners corner-LU"> </div><div class="cornersBis corner-LU-A"> </div><div class="cornersBis corner-LU-B"> </div><div class="corners corner-RU"> </div><div class="cornersBis corner-RU-A"> </div><div class="cornersBis corner-RU-B"> </div><div class="tinyCenter tinyCenter-A"><div class="tinyCenter tinyCenter-B"> </div></div><div class="corners corner-LD"> </div><div class="cornersBis corner-LD-A"> </div><div class="cornersBis corner-LD-B"> </div><div class="corners corner-RD"> </div><div class="cornersBis corner-RD-A"> </div><div class="cornersBis corner-RD-B"> </div></div></div>';
          break;
        }
      break;
      case 2:
        carte.innerHTML='<div class="cartesDos"><div class="'+classes+'"><div class="diagonal1"></div><div class="corners corner-LU"> </div><div class="cornersBis corner-LU-A"> </div><div class="cornersBis corner-LU-B"> </div><div class="corners corner-RU"> </div><div class="cornersBis corner-RU-A"> </div><div class="cornersBis corner-RU-B"> </div><div class="tinyCenter tinyCenter-B"> </div><div class="corners corner-LD"> </div><div class="cornersBis corner-LD-A"> </div><div class="cornersBis corner-LD-B"> </div><div class="corners corner-RD"> </div><div class="cornersBis corner-RD-A"> </div><div class="cornersBis corner-RD-B"> </div></div></div>';
      break;
      case 3:
        carte.innerHTML='<div class="cartesDos"><div class="'+classes+'"><div class="triangleDown"></div><div class="triangleLeft"></div><div class="line1"></div><div class="line2"></div><div class="line3"></div><div class="corners corner-LU"> </div><div class="cornersBis corner-LU-A"> </div><div class="cornersBis corner-LU-B"> </div><div class="corners corner-RU"> </div><div class="cornersBis corner-RU-A"> </div><div class="cornersBis corner-RU-B"> </div><div class="tinyCenter tinyCenter-B"> </div><div class="corners corner-LD"> </div><div class="cornersBis corner-LD-A"> </div><div class="cornersBis corner-LD-B"> </div><div class="corners corner-RD"> </div><div class="cornersBis corner-RD-A"> </div><div class="cornersBis corner-RD-B"> </div></div></div>';
      break;
    }
  });

  /**
   * Permet d'afficher les cartes du plateau et le score (si victoire) lors de la fin d'une partie
   * Crée un bouton pour rejouer
   *
   * @param res Object Contient le score et la mention de la victoire ainsi que la grille des familles à afficher
   */
  sock.on("end_game",function(res){

    var msg = "";

    if(res.victory){
      msg+="Bravo ! Vous avez apaisé les Yokais !";
      msg+="<br>Votre score : ";
      msg+=res.score.score;
      msg+="<br>Votre victoire est ";
      msg+=res.score.mention;
      msg+=" !";

    }else{
      msg+="Perdu !<br>Les Yokais ne sont pas apaisés attention à vous !"
    }

    for(var i=0, keys=Object.keys(res.grid); i<4; ++i){
      for(var j=0; j<res.grid[keys[i]].length; ++j){
        returnCard(keys[i],res.grid[keys[i]][j]);
      }
    }

    document.getElementById("message").innerHTML=msg;
    document.getElementById('happy_yokai').remove();

    var btn = document.createElement('button');
    btn.setAttribute('id','replay');
    btn.innerHTML="Rejouer !";

    btn.addEventListener('click', function(e){
      location.reload();
    });

    document.getElementById('rules').appendChild(btn);

    speakIndications(msg);

  });

  /**
   * Permet de créer une partie et d'afficher le plateau de jeu
   *
   */
  document.getElementById('btnCreate').addEventListener("click",function(e){
    //var select = document.getElementById('selectCreate');
    var nbJ = document.querySelector(':checked').value;
    sock.emit("create",nbJ);
    initTable();
    initHint(nbJ);
    initAsideRight();
  });

  /**
   * Permet de rejoindre une partie après l'avoir sélectionnée
   *
   */
  document.getElementById('btnJoin').addEventListener("click",function(e){
    var select = document.getElementById('selectJoin');
    var nbP = select.options[select.selectedIndex].value;
    sock.emit("join",nbP);
    initTable();
    initHint(select.options[select.selectedIndex].dataset.nbj);
    initAsideRight();
  });

  /**
   * C'est la dance des canards...
   *
   */
  document.getElementById('canard').addEventListener("click",function(e){
    speakIndications("coin coin");
  });

  /**
   * But there's one sound
   * That no one knows
   * What does the fox say?
   *
   */
  document.getElementById('kitsune').addEventListener("click",function(e){
    speakIndications("Ring-ding-ding-ding-dingeringeding");
  });

  /**
   * C'est la dance des canards...
   *
   */
  table.addEventListener("click",function(e){
    var cell = e.target.closest(':not(div)');
    // si la case est une case avec une carte
    if(cell.nodeName==='TD' && cell.dataset.x  && cell.dataset.y){
      // quel etape de jeu :
      var coo = {x:cell.dataset.x,y:cell.dataset.y};
      switch (status) {
        case 1: // show card
          if(returned_cards.length<2){
            sock.emit("show_card",coo);
          }
        break;
        case 2: //hide card
          if(returned_cards.length!=0 ){
            sock.emit("hide_card",coo);
          }
        break;
        case 3: // 3 deplacement from
          sock.emit("move_card_from",coo);
        break;
        case 4: // 4 deplacement to
          sock.emit("move_card_to",coo);
        break;
        case 6: // poser un indice (etape 5 pas sur la grille)
          var hint = {
            index : hint_index,
            coo : undefined
          };
          hint.coo = {
            x:cell.dataset.x,
            y:cell.dataset.y
          };
          sock.emit("play_hint",hint);
        break;
      }

    }



  });

  /**
   * Raccourcis claviers
   *
   */
  document.addEventListener('keydown', function(e) {

    /**
     * Pour passer sur le mode sombre
     *
     */
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        var body = document.querySelector('body');
        if(body.className=='dark'){
            body.className='';
        }else{
            body.className='dark';
        }
    }

    /**
     * Pour faire taire ou réactiver la synthèse vocale
     *
     */
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        mute=!mute;
    }

  });

  /**
   * Affichage des règles
   */
  document.getElementById('rulesBtn').addEventListener('click',function(e){
    var rulesDiv = document.getElementById('gameRules');
    var menu = document.getElementById('menu');
    var yokais = document.getElementById('yokais');
    if(rulesDiv.className == "hidden"){
      rulesDiv.className = "";
      e.target.innerHTML = "X";
      menu.className = "hidden";
      yokais.className="";
    }else{
      rulesDiv.className = "hidden";
      e.target.innerHTML = "?";
      menu.className = "";
      yokais = "hidden";
    }
  });

  /**
   * Fonction permettant d'initialiser le tableau de cartes
   *
   */
  function initTable(){
    document.getElementById("tableJeu").className="";
    document.getElementById("container").className="";
    document.getElementById("startSection").className="hidden";
    // Construction de la grille

    for(var i=WIDTH_MIN-1;i<WIDTH_MAX+1;++i){
        var line = document.createElement('tr');
        table.appendChild(line);
        for(var j=HEIGHT_MIN-1;j<HEIGHT_MAX+1;++j){
            var cell = document.createElement('td');
            cell.dataset.x=j;
            cell.dataset.y=i;
            line.appendChild(cell);
        }
    }
    document.getElementById("board-container").appendChild(table);
  }

  /**
   * Permet d'ajouter des cartes au plateau de jeu
   *
   */
  function addCardsToTable(){
    for(var i=0, l=grid.length; i<l; ++i){
      addCardToTable(grid[i]);
    }
  }

  /**
   * Permet de déplacer une carte
   *
   * @param from Object La position de départ (from.x from.y)
   * @param to Object La position d'arrivé de la carte
   */
  function moveCard(from, to){
    grid.splice(grid.indexOf(findCard(grid,from)),1);
    grid.push(to);
    removeCardFromTable(from);
    addCardToTable(to);
  }

  /**
   * Permet d'ajouter une carte au tableau
   *
   * @param pos Object La position ou ajouter la carte
   */
  function addCardToTable(pos){
    if(pos.x>WIDTH_MAX){
      WIDTH_MAX=pos.x;
    }
    if(pos.x<WIDTH_MIN){
      WIDTH_MIN=pos.x;
    }
    if(pos.y>HEIGHT_MAX){
      HEIGHT_MAX=pos.y;
    }
    if(pos.y<HEIGHT_MIN){
      HEIGHT_MIN=pos.y;
    }
    updateTable();
    var inner = '<div class="cartesDos"><div class="darkCenter"><div class="corners corner-LU"> </div><div class="cornersBis corner-LU-A"> </div><div class="cornersBis corner-LU-B"> </div><div class="corners corner-RU"> </div><div class="cornersBis corner-RU-A"> </div><div class="cornersBis corner-RU-B"> </div><div class="lightCenter"><div class="tinyCenter"><div class="tinyCenter tinyCenter-A"><div class="tinyCenter tinyCenter-B"> </div></div>  </div></div><div class="corners corner-LD"> </div><div class="cornersBis corner-LD-A"> </div><div class="cornersBis corner-LD-B"> </div><div class="corners corner-RD"> </div><div class="cornersBis corner-RD-A"> </div><div class="cornersBis corner-RD-B"> </div></div></div>';
    document.querySelector('[data-x="'+pos.x+'"][data-y="'+pos.y+'"]').innerHTML = inner;
  }

  /**
   * Permet de retirer une carte du tableau
   *
   * @param pos Object La position de la carte
   */
  function removeCardFromTable(pos){
    document.querySelector('[data-x="'+pos.x+'"][data-y="'+pos.y+'"]').innerHTML = "";
  }

  /**
   * Permet de retourner une carte afin de montrer sa famille
   *
   * @param family String La famille de la carte
   * @param pos Object La position de la carte
   */
  function returnCard(family,pos){
    var carte = document.querySelector('[data-x="'+pos.x+'"][data-y="'+pos.y+'"]');
    switch (family) {
      case "A":
        carte.innerHTML='<div class="cartesDos"><div class="family familyA"><div class="corners corner-LU"></div><div class="cornersBis corner-LU-A"> </div><div class="cornersBis corner-LU-B"> </div><div class="fire fire-corner fire-corner-L fire1"></div><div class="fire fire-corner fire-corner-L fire2"></div><div class="fire fire-corner fire-corner-L fire3"></div><div class="fire fire-corner fire-corner-L fire4"></div><div class="fire fire-corner fire-corner-L fire5"></div><div class="corners corner-RU"> </div><div class="cornersBis corner-RU-A"> </div><div class="cornersBis corner-RU-B"> </div><div class="fire fire-corner fire-corner-R fire1"></div><div class="fire fire-corner fire-corner-R fire2"></div><div class="fire fire-corner fire-corner-R fire3"></div><div class="fire fire-corner fire-corner-R fire4"></div><div class="fire fire-corner fire-corner-R fire5"></div><div class="fire fire1"></div><div class="fire fire2"></div><div class="fire fire3"></div><div class="fire fire-medium fire1"></div><div class="fire fire-medium fire2"></div><div class="fire fire-medium fire3"></div><div class="fire fire-medium fire4"></div><div class="fire fire-medium fire5"></div><div class="fire fire-small fire1"></div><div class="fire fire-small fire2"></div><div class="fire fire-small fire3"></div><div class="fire fire-small fire4"></div><div class="fire fire-small fire5"></div></div></div>';
      break;
      case "C":
        carte.innerHTML='<div class="cartesDos"><div class="family familyC"><div class="corners corner-LU"></div><div class="cornersBis corner-LU-A"> </div><div class="cornersBis corner-LU-B"> </div><div class="corners corner-RU"> </div><div class="cornersBis corner-RU-A"> </div><div class="cornersBis corner-RU-B"> </div><div class="fleur fleur1"></div><div class="fleur fleur2"></div><div class="fleur fleur3"></div><div class="fleur fleur1 smol"></div><div class="fleur fleur2 smol" ></div><div class="fleur fleur3 smol"></div><div class="fleur fleur1 smoler"></div><div class="fleur fleur2 smoler" ></div><div class="fleur fleur3 smoler"></div></div></div>';
      break;
      case "B":
        carte.innerHTML = '<div class="cartesDos"> <div class="family familyB"> <div class="corners corner-LU"></div> <div class="cornersBis corner-LU-A"> </div> <div class="cornersBis corner-LU-B"> </div> <div class="corners corner-RU"> </div> <div class="cornersBis corner-RU-A"> </div> <div class="cornersBis corner-RU-B"> </div> <div class="drop"> <div class="drop drop-highlight"> </div> <div class="drop drop-highlight-2"> </div> </div> </div> </div>';
      break;
      case "D":
        carte.innerHTML = '<div class="cartesDos"> <div class="family familyD"> <div class="corners corner-LU"></div> <div class="cornersBis corner-LU-A"> </div> <div class="cornersBis corner-LU-B"> </div> <div class="corners corner-RU"> </div> <div class="cornersBis corner-RU-A"> </div> <div class="cornersBis corner-RU-B"> </div> <div class="eclair"></div> <div class="eclair eclair_1"></div> <div class="eclair eclair_2"></div> <div class="eclair eclair_3"></div> <div class="eclair eclair_4"></div> <div class="eclair eclair_5"></div> </div> </div>';
      break;
      default:

    }
  }

  /**
   * Permet trouver une carte dans un tableau de carte
   *
   * @param array array Le tableau de cartes
   * @param pos Object La position de la carte à trouver
   */
  function findCard(array,pos){
    return array.find(function(element){
        return element.x == pos.x && element.y == pos.y;
    },pos);
  }

  /**
   * Permet de modifier la taille du tableau lorsque on déplace une carte
   * Si on la déplace en bord de tableau, on crée une ligne en plus pour montrer les nouvelles cases accéssibles
   *
   */
  function updateTable(){

    var yMin = HEIGHT_MIN-1;
    var yMax = HEIGHT_MAX+1;
    var xMin = WIDTH_MIN-1;
    var xMax = WIDTH_MAX+1;

    //tr min existe?
    if(document.querySelector('[data-y="'+yMin+'"]') == null){
      var trMin = document.createElement('tr');
      for(var i=xMin;i<xMax;++i){
        var td = document.createElement('td');
        td.dataset.x=i;
        td.dataset.y=yMin;
        trMin.appendChild(td);
      }
      table.insertBefore(trMin, table.firstChild);
    }

    // tr max existe ?
    if(document.querySelector('[data-y="'+yMax+'"]') == null){
      var trMax = document.createElement('tr');
      for(var i=xMin;i<xMax;++i){
        var td = document.createElement('td');
        td.dataset.x=i;
        td.dataset.y=yMax;
        trMax.appendChild(td);

      }
      table.appendChild(trMax);
    }

    var count = 0;
    for(var i=yMin;i<=yMax;++i){
      if(document.querySelector('[data-x="'+xMin+'"][data-y="'+i+'"]') == null){
        var tdMin = document.createElement('td');
        tdMin.dataset.x=xMin;
        tdMin.dataset.y=i;
        table.children[count].insertBefore(tdMin, table.children[count].firstChild);
      }
      if(document.querySelector('[data-x="'+xMax+'"][data-y="'+i+'"]') == null){
        var tdMax = document.createElement('td');
        tdMax.dataset.x=xMax;
        tdMax.dataset.y=i;
        table.children[count].appendChild(tdMax);
      }
      count++;
    }
  }

  /**
   * Permet d'initialiser le tableau d'indices et la pioche
   *
   * @param nbJ int Le nombre de joueurs (influence le nb d'indices)
   */
  function initHint(nbJ){
    var aside = document.createElement('aside');
    aside.setAttribute('id','indices');

    var hint_to_draw=document.createElement('div');
    hint_to_draw.setAttribute('id','draw_hint');
    //hint_to_draw.innerHTML='<div class="cartesDos"><div class="darkCenter"><div class="corners corner-LU"> </div><div class="cornersBis corner-LU-A"> </div><div class="cornersBis corner-LU-B"> </div><div class="corners corner-RU"> </div><div class="cornersBis corner-RU-A"> </div><div class="cornersBis corner-RU-B"> </div><div class="lightCenter"><div class="tinyCenter"><div class="tinyCenter tinyCenter-A"><div class="tinyCenter tinyCenter-B"> </div></div>  </div></div><div class="corners corner-LD"> </div><div class="cornersBis corner-LD-A"> </div><div class="cornersBis corner-LD-B"> </div><div class="corners corner-RD"> </div><div class="cornersBis corner-RD-A"> </div><div class="cornersBis corner-RD-B"> </div></div></div>';

    hint_to_draw.innerHTML='<div class="cartesDos"><div class="family hint familyA familyB familyC familyD"><div class="diagonal1"></div><div class="diagonal2"></div><div class="diagonal1"></div><div class="corners corner-LU"> </div><div class="cornersBis corner-LU-A"> </div><div class="cornersBis corner-LU-B"> </div><div class="corners corner-RU"> </div><div class="cornersBis corner-RU-A"> </div><div class="cornersBis corner-RU-B"> </div><div class="tinyCenter tinyCenter-B"> </div><div class="corners corner-LD"> </div><div class="cornersBis corner-LD-A"> </div><div class="cornersBis corner-LD-B"> </div><div class="corners corner-RD"> </div><div class="cornersBis corner-RD-A"> </div><div class="cornersBis corner-RD-B"> </div></div></div>';

    hint_to_draw.addEventListener('click', function(e) {
      if(status!=5){
        return;
      }
      sock.emit("draw_hint");
    });

    var hints_drawn = document.createElement('table');
    hints_drawn.setAttribute('id','table_hint');

    hints_drawn.addEventListener('click', function(e) {
      var cell = e.target.closest(':not(div)');
      if(cell.nodeName==='TD'){
        if(status==5 && cell.dataset.index){
          hint_index=cell.dataset.index;
          sock.emit("select_hint",hint_index);
          return;
        }
      }
    });

    var nb_hint = 7;
    if(nbJ==3){
      nb_hint = 9;
    }
    if(nbJ==4){

      nb_hint = 10;
    }

    for(var i=0,count=0;i<=nb_hint/2;++i){
      var tr = document.createElement('tr');
      hints_drawn.appendChild(tr);
      for(var j=0;j<2 && count<nb_hint;++j){
        var td = document.createElement('td');
        td.dataset.index = count;
        tr.appendChild(td);
        count++;
      }
    }

    aside.appendChild(hint_to_draw);
    aside.appendChild(hints_drawn);
    document.getElementById('tableJeu').insertBefore(aside, document.getElementById('tableJeu').firstChild);
  }

  /**
   * Permet de déplacer un indice pour le poser sur le plateau
   *
   * @param indes int L'index permetant d'identifier l'indice
   * @param to Object La position ou on veut poser l'indice
   */
  function moveHint(index,to){
    var hint = document.querySelector('[data-index="'+index+'"]').firstChild;
    document.querySelector('[data-x="'+to.x+'"][data-y="'+to.y+'"]').innerHTML='';
    document.querySelector('[data-x="'+to.x+'"][data-y="'+to.y+'"]').appendChild(hint);
  }

  /**
   * Permet d'initialiser le panneau contenant les indications sur le jeu
   * Et le bouton pour déclarer les yokais appaisés
   */
  function initAsideRight(){
    var aside = document.createElement('aside');
    aside.setAttribute('id','rules');

    var panneau = document.createElement('div');
    panneau.setAttribute('id','panneau');
    panneau.addEventListener('click',function(){
      speakIndications("Me clique pas dessus ptdr t'es qui?");
    });
    var msg = document.createElement('p');
    msg.innerHTML="En attente des autres joueurs.";

    msg.setAttribute('id','message');
    panneau.appendChild(msg);

    var btn_end = document.createElement('button');
    btn_end.setAttribute('id','happy_yokai');
    btn_end.innerHTML="Les yokai sont appaisés.";
    btn_end.addEventListener("click",function(e){
      sock.emit("stop_game");

    });

    aside.appendChild(panneau);
    aside.appendChild(btn_end);

    document.getElementById('tableJeu').appendChild(aside);
    speakIndications("En attente des autres joueurs.");
  }

  /**
   * Permet de générer une insulte aléatoire pour la synthèse vocale
   * @returns L'insulte tirée
   */
  function generateRandomInsult(){
    var insulte = " T'es vraiment trop nul.";
    var random = Math.floor(Math.random() * 4);
    switch (random) {
      case 0:
        insulte = " ha ha nul.";
      break;
      case 1:
        insulte = " Bolosse.";
      break;
      case 2:
        insulte = " Andouille.";
      break;
      case 3:
        insulte = " T'es vraiment trop nul.";
      break;
    }
    return insulte;
  }

  /**
   * Permet d'utiliser la synthère vocale pour indiquer au joueur ce qu'il doit faire
   * @param {*} msg Message annoncé
   */
     function speakIndications(msg){
      if(!mute){
        let speak = new SpeechSynthesisUtterance(msg);
        speechSynthesis.speak(speak);
      }
    }

    function updatePanneau(){
      var msg = document.getElementById("message");
      switch (status) {
        case 1: // clik sur une carte pour la montrer x2
          msg.innerHTML="Clique sur deux cartes pour les retourner.";
          speakIndications("Clique sur deux cartes pour les retourner.");
        break;
        case 2: // cache tes cartes
          msg.innerHTML="Quand tu as finis clique pour les cacher de nouveau.";
          speakIndications("Quand tu as finis clique pour les cacher de nouveau.");
        break;
        case 3: // choisi la carte à déplcaer
          msg.innerHTML="Clique sur la carte que tu veux déplacer.";
          speakIndications("Clique sur la carte que tu veux déplacer.");
        break;
        case 4: // choisi ou tu veuc la mettre
          msg.innerHTML="Où veux tu la placer ?";
          speakIndications("Où veux tu la placer ?");
        break;
        case 5: //tire un indice ou chosi en un a plcaer
          msg.innerHTML="Tire un indice sur la pioche ou choisi en un à placer.";
          speakIndications("Tire un indice sur la pioche ou choisi en un à placer.");
        break;
        case 6: // place ton indice
          msg.innerHTML="Où veux tu placer ton indice ?";
          speakIndications("Où veux tu placer ton indice ?");
        break;
      }
    }

});

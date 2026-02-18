// =====================================================
// Banque de dictées — Brevet 2026 (Niveau 3ème)
// =====================================================
// Chaque dictée contient :
//   - texte complet
//   - groupes de mots pour la phase dictée (lu 2×)
//   - métadonnées (auteur, œuvre, thème, difficulté)
//   - points de grammaire à vérifier
//   - annotations pour la correction guidée

const DICTEES = [
  {
    id: 1,
    titre: "Le souvenir d'enfance",
    auteur: "Marcel Pagnol",
    oeuvre: "La Gloire de mon père",
    annee: 1957,
    theme: "Récit autobiographique",
    difficulte: 2, // 1=facile, 2=moyen, 3=difficile
    texte: `Le petit Marcel marchait dans les collines parfumées de thym et de lavande. Il suivait son père qui portait sur l'épaule un grand sac de toile. Les cigales chantaient dans les arbres, et le soleil éclatant les obligeait à plisser les yeux. C'était un matin d'août, et l'enfant découvrait pour la première fois les merveilles de la garrigue provençale. Les pierres blanches brillaient sous la lumière, et quelques lézards effarouchés s'enfuyaient à leur approche. Il n'avait jamais été aussi heureux.`,
    groupes: [
      "Le petit Marcel",
      "marchait dans les collines",
      "parfumées de thym et de lavande.",
      "Il suivait son père",
      "qui portait sur l'épaule",
      "un grand sac de toile.",
      "Les cigales chantaient",
      "dans les arbres,",
      "et le soleil éclatant",
      "les obligeait à plisser les yeux.",
      "C'était un matin d'août,",
      "et l'enfant découvrait",
      "pour la première fois",
      "les merveilles de la garrigue provençale.",
      "Les pierres blanches",
      "brillaient sous la lumière,",
      "et quelques lézards effarouchés",
      "s'enfuyaient à leur approche.",
      "Il n'avait jamais été",
      "aussi heureux."
    ],
    regles: [
      {
        type: "accord",
        mot: "parfumées",
        explication: "Le participe passé « parfumées » s'accorde avec « collines » (féminin pluriel). Règle : le participe passé employé comme adjectif s'accorde en genre et en nombre avec le nom qu'il qualifie."
      },
      {
        type: "conjugaison",
        mot: "marchait",
        explication: "Imparfait de l'indicatif, 3ème personne du singulier. Le sujet est « Marcel » → terminaison « -ait »."
      },
      {
        type: "homophones",
        mot: "C'était",
        explication: "« C'était » = « cela était ». Ne pas confondre avec « s'était » (pronom réfléchi). Astuce : remplacer par « cela était »."
      },
      {
        type: "accord",
        mot: "éclatant",
        explication: "Ici, « éclatant » est un adjectif qualificatif qui s'accorde avec « soleil » (masculin singulier)."
      },
      {
        type: "accord",
        mot: "effarouchés",
        explication: "Le participe passé « effarouchés » s'accorde avec « lézards » (masculin pluriel)."
      },
      {
        type: "conjugaison",
        mot: "s'enfuyaient",
        explication: "Verbe pronominal « s'enfuir » à l'imparfait, 3ème personne du pluriel. Sujet : « lézards »."
      },
      {
        type: "homophones",
        mot: "leur approche",
        explication: "« leur » ici est un déterminant possessif (= l'approche qui est la leur). Pas de « s » car il détermine un nom singulier."
      },
      {
        type: "conjugaison",
        mot: "n'avait jamais été",
        explication: "Plus-que-parfait de « être ». Négation « ne...jamais ». Auxiliaire « avoir » à l'imparfait + participe passé « été »."
      }
    ],
    ponctuation: "Attention aux virgules qui séparent les propositions coordonnées par « et »."
  },
  {
    id: 2,
    titre: "La tempête en mer",
    auteur: "Victor Hugo",
    oeuvre: "Les Travailleurs de la mer (adapté)",
    annee: 1866,
    theme: "Description / Nature",
    difficulte: 3,
    texte: `La mer, furieuse et déchaînée, lançait ses vagues immenses contre les rochers. Le vent hurlait avec une violence inouïe, arrachant les voiles des bateaux qui se trouvaient encore dans le port. Les pêcheurs, terrifiés par cette tempête soudaine, avaient abandonné leurs filets sur le quai. Personne n'osait s'aventurer dehors. Les nuages noirs s'amoncelaient au-dessus de la côte, et la pluie, mêlée d'embruns, fouettait les visages de ceux qui regardaient, impuissants, ce spectacle terrifiant.`,
    groupes: [
      "La mer,",
      "furieuse et déchaînée,",
      "lançait ses vagues immenses",
      "contre les rochers.",
      "Le vent hurlait",
      "avec une violence inouïe,",
      "arrachant les voiles des bateaux",
      "qui se trouvaient encore dans le port.",
      "Les pêcheurs,",
      "terrifiés par cette tempête soudaine,",
      "avaient abandonné leurs filets",
      "sur le quai.",
      "Personne n'osait",
      "s'aventurer dehors.",
      "Les nuages noirs",
      "s'amoncelaient au-dessus de la côte,",
      "et la pluie,",
      "mêlée d'embruns,",
      "fouettait les visages",
      "de ceux qui regardaient,",
      "impuissants,",
      "ce spectacle terrifiant."
    ],
    regles: [
      {
        type: "accord",
        mot: "furieuse et déchaînée",
        explication: "Deux adjectifs qualificatifs s'accordant avec « mer » (féminin singulier). Apposition entre virgules."
      },
      {
        type: "vocabulaire",
        mot: "inouïe",
        explication: "Adjectif « inouï » au féminin. Le tréma sur le « ï » indique que le « i » se prononce séparément du « u »."
      },
      {
        type: "accord",
        mot: "terrifiés",
        explication: "Participe passé « terrifiés » s'accorde avec « pêcheurs » (masculin pluriel)."
      },
      {
        type: "conjugaison",
        mot: "avaient abandonné",
        explication: "Plus-que-parfait : auxiliaire « avoir » à l'imparfait + participe passé. Le participe ne s'accorde pas car le COD « filets » est placé après."
      },
      {
        type: "homophones",
        mot: "leurs filets",
        explication: "« leurs » = déterminant possessif pluriel, car il y a plusieurs filets appartenant aux pêcheurs. Comparer avec « leur » singulier."
      },
      {
        type: "accord",
        mot: "mêlée",
        explication: "Participe passé « mêlée » s'accorde avec « pluie » (féminin singulier). Apposition entre virgules."
      },
      {
        type: "vocabulaire",
        mot: "embruns",
        explication: "« Embruns » : fines gouttelettes d'eau de mer soulevées par le vent. Toujours au pluriel."
      },
      {
        type: "accord",
        mot: "impuissants",
        explication: "Adjectif en apposition qui s'accorde avec « ceux » (masculin pluriel), désignant les personnes qui regardaient."
      }
    ],
    ponctuation: "Noter l'usage des appositions entre virgules (« furieuse et déchaînée », « mêlée d'embruns », « impuissants ») qui encadrent des expansions du nom."
  },
  {
    id: 3,
    titre: "Le jour de la rentrée",
    auteur: "Albert Camus",
    oeuvre: "Le Premier Homme (adapté)",
    annee: 1994,
    theme: "Récit autobiographique / École",
    difficulte: 2,
    texte: `Ce matin-là, Jacques avait enfilé ses vêtements neufs avec une émotion qu'il n'arrivait pas à dissimuler. Sa grand-mère l'avait accompagné jusqu'à la grille de l'école, où d'autres enfants attendaient déjà, silencieux et intimidés. La cour paraissait immense sous le ciel bleu de septembre. Un instituteur, vêtu d'une blouse grise, accueillit les nouveaux élèves en leur adressant quelques mots d'encouragement. Jacques sentait son cœur battre très fort. Il comprenait confusément que cette journée allait changer sa vie.`,
    groupes: [
      "Ce matin-là,",
      "Jacques avait enfilé",
      "ses vêtements neufs",
      "avec une émotion",
      "qu'il n'arrivait pas à dissimuler.",
      "Sa grand-mère",
      "l'avait accompagné",
      "jusqu'à la grille de l'école,",
      "où d'autres enfants",
      "attendaient déjà,",
      "silencieux et intimidés.",
      "La cour paraissait immense",
      "sous le ciel bleu de septembre.",
      "Un instituteur,",
      "vêtu d'une blouse grise,",
      "accueillit les nouveaux élèves",
      "en leur adressant",
      "quelques mots d'encouragement.",
      "Jacques sentait",
      "son cœur battre très fort.",
      "Il comprenait confusément",
      "que cette journée",
      "allait changer sa vie."
    ],
    regles: [
      {
        type: "accord",
        mot: "neufs",
        explication: "Adjectif « neuf » au masculin pluriel, s'accorde avec « vêtements »."
      },
      {
        type: "conjugaison",
        mot: "avait enfilé",
        explication: "Plus-que-parfait de l'indicatif. Auxiliaire « avoir » à l'imparfait + participe passé. Action antérieure au récit."
      },
      {
        type: "homophones",
        mot: "qu'il",
        explication: "« qu'il » = « que » + « il ». C'est la conjonction « que » élidée devant le pronom « il ». Ne pas confondre avec « qui l' »."
      },
      {
        type: "accord",
        mot: "accompagné",
        explication: "Le participe passé « accompagné » avec l'auxiliaire « avoir » : le COD « l' » (= Jacques, masculin) est placé avant → accord au masculin singulier."
      },
      {
        type: "accord",
        mot: "silencieux et intimidés",
        explication: "Deux adjectifs s'accordant avec « enfants » (masculin pluriel). « Silencieux » : même forme au singulier et au pluriel."
      },
      {
        type: "conjugaison",
        mot: "accueillit",
        explication: "Passé simple de « accueillir », 3ème personne du singulier. Attention à l'orthographe : « accueill- » avec deux « l »."
      },
      {
        type: "vocabulaire",
        mot: "confusément",
        explication: "Adverbe formé sur l'adjectif « confus » + suffixe « -ément ». Sens : de manière vague, sans précision."
      },
      {
        type: "conjugaison",
        mot: "allait changer",
        explication: "Futur proche dans le passé : verbe « aller » à l'imparfait + infinitif. Exprime une action imminente dans le passé."
      }
    ],
    ponctuation: "L'apposition « vêtu d'une blouse grise » est encadrée par des virgules. Elle décrit l'instituteur."
  },
  {
    id: 4,
    titre: "Une nuit d'hiver",
    auteur: "Guy de Maupassant",
    oeuvre: "Contes divers (adapté)",
    annee: 1885,
    theme: "Description / Atmosphère",
    difficulte: 2,
    texte: `La neige tombait depuis le matin, recouvrant les toits et les chemins d'un épais manteau blanc. Les rues du village étaient désertes ; seul le boulanger, levé avant l'aube, avait allumé son four dont la chaleur bienfaisante réchauffait les murs de la boutique. Quelques empreintes de pas, à demi effacées, menaient de la place de l'église jusqu'au lavoir. Le silence régnait partout, troublé seulement par le craquement des branches sous le poids de la glace.`,
    groupes: [
      "La neige tombait depuis le matin,",
      "recouvrant les toits",
      "et les chemins",
      "d'un épais manteau blanc.",
      "Les rues du village",
      "étaient désertes ;",
      "seul le boulanger,",
      "levé avant l'aube,",
      "avait allumé son four",
      "dont la chaleur bienfaisante",
      "réchauffait les murs de la boutique.",
      "Quelques empreintes de pas,",
      "à demi effacées,",
      "menaient de la place de l'église",
      "jusqu'au lavoir.",
      "Le silence régnait partout,",
      "troublé seulement",
      "par le craquement des branches",
      "sous le poids de la glace."
    ],
    regles: [
      {
        type: "accord",
        mot: "désertes",
        explication: "Adjectif « désert » au féminin pluriel, s'accorde avec « rues »."
      },
      {
        type: "accord",
        mot: "levé",
        explication: "Participe passé en apposition, s'accorde avec « boulanger » (masculin singulier)."
      },
      {
        type: "conjugaison",
        mot: "avait allumé",
        explication: "Plus-que-parfait : action accomplie avant le moment du récit (à l'imparfait). Auxiliaire « avoir » + participe passé."
      },
      {
        type: "accord",
        mot: "bienfaisante",
        explication: "Adjectif « bienfaisant » au féminin singulier, s'accorde avec « chaleur »."
      },
      {
        type: "accord",
        mot: "effacées",
        explication: "Participe passé « effacées » s'accorde avec « empreintes » (féminin pluriel). Apposition entre virgules."
      },
      {
        type: "vocabulaire",
        mot: "à demi effacées",
        explication: "« À demi » est un adverbe invariable. Quand il précède un adjectif, il n'y a pas de trait d'union (contrairement à « demi-heure »)."
      },
      {
        type: "homophones",
        mot: "dont",
        explication: "Pronom relatif « dont » = complément introduit par « de ». Ici : la chaleur de son four → « dont la chaleur ». Ne pas confondre avec « donc » (conjonction de conséquence)."
      },
      {
        type: "accord",
        mot: "troublé",
        explication: "Participe passé en apposition s'accordant avec « silence » (masculin singulier)."
      }
    ],
    ponctuation: "Le point-virgule sépare deux propositions indépendantes étroitement liées. Les appositions entre virgules enrichissent la description."
  },
  {
    id: 5,
    titre: "La découverte de Paris",
    auteur: "Émile Zola",
    oeuvre: "L'Assommoir (adapté)",
    annee: 1877,
    theme: "Description urbaine / Réalisme",
    difficulte: 3,
    texte: `Gervaise regardait les grands boulevards avec un étonnement mêlé de crainte. La foule pressée, les omnibus qui passaient dans un vacarme assourdissant, les devantures illuminées des magasins, tout l'étourdissait. Elle n'avait jamais imaginé qu'une ville pût être si vaste et si bruyante. Les Parisiens marchaient vite, indifférents aux nouveaux venus, et elle se sentait perdue au milieu de cette agitation. Cependant, une étrange fascination la retenait : elle qui avait toujours vécu dans un village tranquille découvrait un monde dont elle ne soupçonnait pas l'existence.`,
    groupes: [
      "Gervaise regardait",
      "les grands boulevards",
      "avec un étonnement",
      "mêlé de crainte.",
      "La foule pressée,",
      "les omnibus",
      "qui passaient",
      "dans un vacarme assourdissant,",
      "les devantures illuminées des magasins,",
      "tout l'étourdissait.",
      "Elle n'avait jamais imaginé",
      "qu'une ville pût être",
      "si vaste et si bruyante.",
      "Les Parisiens marchaient vite,",
      "indifférents aux nouveaux venus,",
      "et elle se sentait perdue",
      "au milieu de cette agitation.",
      "Cependant,",
      "une étrange fascination la retenait :",
      "elle qui avait toujours vécu",
      "dans un village tranquille",
      "découvrait un monde",
      "dont elle ne soupçonnait pas",
      "l'existence."
    ],
    regles: [
      {
        type: "accord",
        mot: "mêlé",
        explication: "Participe passé « mêlé » s'accorde avec « étonnement » (masculin singulier)."
      },
      {
        type: "accord",
        mot: "pressée",
        explication: "Participe passé employé comme adjectif, s'accorde avec « foule » (féminin singulier)."
      },
      {
        type: "conjugaison",
        mot: "pût",
        explication: "Subjonctif imparfait de « pouvoir », 3ème personne du singulier. Accent circonflexe obligatoire. Utilisé en concordance des temps avec « imaginé » (plus-que-parfait)."
      },
      {
        type: "accord",
        mot: "illuminées",
        explication: "Participe passé « illuminées » s'accorde avec « devantures » (féminin pluriel)."
      },
      {
        type: "accord",
        mot: "indifférents",
        explication: "Adjectif s'accordant avec « Parisiens » (masculin pluriel). Deux « f » dans « indifférents »."
      },
      {
        type: "accord",
        mot: "perdue",
        explication: "Participe passé « perdue » avec « se sentait » : accord avec le sujet « elle » (féminin singulier)."
      },
      {
        type: "accord",
        mot: "vécu",
        explication: "Participe passé de « vivre » avec l'auxiliaire « avoir » : pas d'accord car pas de COD avant le verbe. (« vécu » est intransitif ici)."
      },
      {
        type: "homophones",
        mot: "dont",
        explication: "Pronom relatif « dont » remplace « de ce monde ». « Elle ne soupçonnait pas l'existence de ce monde. »"
      }
    ],
    ponctuation: "L'énumération « La foule pressée, les omnibus..., les devantures..., tout l'étourdissait » utilise la virgule pour séparer les sujets avant le pronom récapitulatif « tout »."
  },
  {
    id: 6,
    titre: "Le départ pour la guerre",
    auteur: "Joseph Kessel",
    oeuvre: "L'Armée des ombres (adapté)",
    annee: 1943,
    theme: "Récit historique / Résistance",
    difficulte: 3,
    texte: `Les hommes s'étaient rassemblés dans la cour de la ferme, enveloppés dans leurs manteaux usés. Ils attendaient en silence l'ordre de partir. Leurs visages, éclairés par la lueur blafarde de l'aube, trahissaient une inquiétude qu'ils s'efforçaient de dissimuler. Quelques-uns fumaient, les mains tremblantes. D'autres avaient écrit à leurs familles des lettres qu'ils ne savaient pas s'ils pourraient envoyer un jour. Le chef du groupe, un homme d'une quarantaine d'années au regard déterminé, vérifia une dernière fois les documents cachés dans la doublure de sa veste.`,
    groupes: [
      "Les hommes s'étaient rassemblés",
      "dans la cour de la ferme,",
      "enveloppés dans leurs manteaux usés.",
      "Ils attendaient en silence",
      "l'ordre de partir.",
      "Leurs visages,",
      "éclairés par la lueur blafarde de l'aube,",
      "trahissaient une inquiétude",
      "qu'ils s'efforçaient de dissimuler.",
      "Quelques-uns fumaient,",
      "les mains tremblantes.",
      "D'autres avaient écrit",
      "à leurs familles",
      "des lettres",
      "qu'ils ne savaient pas",
      "s'ils pourraient envoyer un jour.",
      "Le chef du groupe,",
      "un homme d'une quarantaine d'années",
      "au regard déterminé,",
      "vérifia une dernière fois",
      "les documents cachés",
      "dans la doublure de sa veste."
    ],
    regles: [
      {
        type: "accord",
        mot: "rassemblés",
        explication: "Participe passé avec l'auxiliaire « être » (verbe pronominal « se rassembler ») : accord avec le sujet « hommes » (masculin pluriel)."
      },
      {
        type: "accord",
        mot: "enveloppés",
        explication: "Participe passé en apposition, s'accorde avec « hommes ». Attention aux deux « p » dans « enveloppés »."
      },
      {
        type: "accord",
        mot: "usés",
        explication: "Participe passé « usés » s'accorde avec « manteaux » (masculin pluriel)."
      },
      {
        type: "accord",
        mot: "éclairés",
        explication: "Participe passé « éclairés » s'accorde avec « visages » (masculin pluriel). Apposition entre virgules."
      },
      {
        type: "vocabulaire",
        mot: "blafarde",
        explication: "Adjectif « blafard » au féminin : « blafarde ». Sens : pâle, sans éclat."
      },
      {
        type: "conjugaison",
        mot: "s'efforçaient",
        explication: "Imparfait du verbe pronominal « s'efforcer ». Cédille sous le « c » devant « a » pour conserver le son [s]."
      },
      {
        type: "homophones",
        mot: "qu'ils / s'ils",
        explication: "« qu'ils » = « que » + « ils » (pronom relatif + sujet). « s'ils » = « si » + « ils » (conjonction + sujet). Savoir les distinguer par le sens."
      },
      {
        type: "conjugaison",
        mot: "vérifia",
        explication: "Passé simple de « vérifier », 3ème personne du singulier. Terminaison en « -a » (1er groupe)."
      }
    ],
    ponctuation: "Les appositions entre virgules décrivent les personnages : « éclairés par la lueur blafarde de l'aube », « un homme d'une quarantaine d'années au regard déterminé »."
  }
];

// Exporter pour utilisation dans app.js
if (typeof window !== 'undefined') {
  window.DICTEES = DICTEES;
}

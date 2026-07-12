#!/usr/bin/env node
// EINMALIGES Merge-Skript (nicht Teil der Build-Pipeline).
// Pflegt EN/FR/IT-Übersetzungen und Leichte-Sprache-Entwürfe (ls) in die
// 32 Lebenslagen von data/zh/lebenslagen.json ein. de bleibt unverändert.
//
// Designprinzipien:
//  - stichworte behalten lokale Eigennamen/Abkürzungen (ewz, VBZ, AOZ, KESB,
//    AHV, Spitex, ERZ, UGZ, MKZ) in ALLEN Sprachen, weil Menschen in Zürich
//    sie sprachunabhängig suchen — plus die übersetzten Alltagsbegriffe.
//  - ls = Leichte Sprache: kurze Sätze, einfache Wörter, schwierige Begriffe
//    erklärt. Bleibt Entwurf bis zum Fachreview (Issue #3).
//
// Nach dem Lauf kann das Skript entfernt werden; es liegt unter scripts/
// (vom Lint ausgenommen) und dient als nachvollziehbarer Datensatz.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, '..', 'data/zh/lebenslagen.json');

const T = {
  'hund-anmelden': {
    en: { frage: 'Register a dog / dog tax', stichworte: ['dog', 'dog tax', 'pet'], antwort: 'Dog registration and dog tax are handled by the Tax Office.' },
    fr: { frage: 'Enregistrer un chien / impôt sur les chiens', stichworte: ['chien', 'impôt sur les chiens', 'animal'], antwort: "L'enregistrement des chiens et l'impôt sur les chiens relèvent de l'Office des impôts." },
    it: { frage: 'Registrare un cane / tassa sui cani', stichworte: ['cane', 'tassa sui cani', 'animale'], antwort: "La registrazione dei cani e la tassa sui cani sono gestite dall'Ufficio imposte." },
    ls: { frage: 'Hund anmelden', stichworte: ['hund', 'hunde-steuer', 'tier'], antwort: 'Sie haben einen Hund? Sie müssen den Hund anmelden. Das macht das Steuer-Amt. Sie zahlen auch eine Steuer für den Hund.' },
  },
  'pass-id': {
    en: { frage: 'Apply for passport or ID card', stichworte: ['passport', 'id', 'identity card', 'travel document'], antwort: "Passports and ID cards are issued by the Residents' Registration Office." },
    fr: { frage: "Demander un passeport ou une carte d'identité", stichworte: ['passeport', "carte d'identité", "pièce d'identité", 'document de voyage'], antwort: "Les passeports et cartes d'identité sont délivrés par le Contrôle des habitants." },
    it: { frage: "Richiedere passaporto o carta d'identità", stichworte: ['passaporto', "carta d'identità", 'documento', 'documento di viaggio'], antwort: "Passaporti e carte d'identità sono rilasciati dall'Ufficio controllo abitanti." },
    ls: { frage: 'Pass oder Identitäts-Karte beantragen', stichworte: ['pass', 'id', 'ausweis'], antwort: 'Sie brauchen einen Pass oder eine ID? Das macht das Bevölkerungs-Amt. Die ID ist die Identitäts-Karte.' },
  },
  'umzug-melden': {
    en: { frage: 'Register or deregister a move', stichworte: ['move', 'moving', 'register', 'deregister', 'relocation', 'residence'], antwort: "Registration and deregistration at the Residents' Registration Office." },
    fr: { frage: 'Annoncer un déménagement (arrivée/départ)', stichworte: ['déménagement', 'arrivée', 'départ', 'domicile', 'emménagement'], antwort: "Arrivée et départ s'annoncent au Contrôle des habitants." },
    it: { frage: 'Annunciare un trasloco (arrivo/partenza)', stichworte: ['trasloco', 'arrivo', 'partenza', 'domicilio', 'cambio di residenza'], antwort: "Arrivo e partenza si annunciano all'Ufficio controllo abitanti." },
    ls: { frage: 'Umzug melden', stichworte: ['umzug', 'anmelden', 'abmelden', 'wohnung'], antwort: 'Sie ziehen um? Sie müssen das melden. Das macht das Bevölkerungs-Amt. Beim Wegzug melden Sie sich ab. Beim Zuzug melden Sie sich an.' },
  },
  'heiraten': {
    en: { frage: 'Get married / civil registry office', stichworte: ['marriage', 'wedding', 'marry', 'civil status', 'registered partnership'], antwort: "Marriage is registered at the Civil Registry Office (Residents' Registration Office)." },
    fr: { frage: "Se marier / état civil", stichworte: ['mariage', 'se marier', 'union', 'état civil', 'partenariat enregistré'], antwort: "Le mariage se célèbre à l'Office de l'état civil (Contrôle des habitants)." },
    it: { frage: 'Sposarsi / stato civile', stichworte: ['matrimonio', 'sposarsi', 'nozze', 'stato civile', 'unione domestica'], antwort: "Il matrimonio si celebra presso l'Ufficio dello stato civile (Ufficio controllo abitanti)." },
    ls: { frage: 'Heiraten', stichworte: ['heirat', 'heiraten', 'ehe', 'hochzeit'], antwort: 'Sie wollen heiraten? Das macht das Zivilstands-Amt. Das Amt ist beim Bevölkerungs-Amt.' },
  },
  'schule-anmelden': {
    en: { frage: 'Enrol a child in school', stichworte: ['school', 'kindergarten', 'primary', 'secondary', 'enrolment', 'school district'], antwort: 'School Office – enrolment is handled by your local school district.' },
    fr: { frage: "Inscrire un enfant à l'école", stichworte: ['école', "jardin d'enfants", 'primaire', 'secondaire', 'scolarisation', 'cercle scolaire'], antwort: "Office des écoles – l'inscription se fait via le cercle scolaire compétent." },
    it: { frage: 'Iscrivere un bambino a scuola', stichworte: ['scuola', "scuola dell'infanzia", 'elementare', 'secondaria', 'iscrizione', 'circondario scolastico'], antwort: "Ufficio scolastico – l'iscrizione avviene tramite il circondario scolastico competente." },
    ls: { frage: 'Kind in der Schule anmelden', stichworte: ['schule', 'kindergarten', 'anmelden'], antwort: 'Ihr Kind soll in die Schule? Sie melden Ihr Kind an. Das macht das Schul-Amt. Der Schul-Kreis bei Ihnen hilft Ihnen.' },
  },
  'kita-platz': {
    en: { frage: 'Find a daycare or after-school place', stichworte: ['daycare', 'kita', 'after-school care', 'day school', 'childcare'], antwort: 'Childcare via the School Office.' },
    fr: { frage: 'Chercher une place en crèche ou en accueil parascolaire', stichworte: ['crèche', 'kita', 'accueil parascolaire', 'garde d\'enfants', 'famille de jour'], antwort: "Accueil de jour via l'Office des écoles." },
    it: { frage: 'Cercare un posto al nido o al doposcuola', stichworte: ['asilo nido', 'kita', 'doposcuola', 'custodia bambini', 'famiglia diurna'], antwort: "Custodia diurna tramite l'Ufficio scolastico." },
    ls: { frage: 'Kita-Platz oder Hort-Platz suchen', stichworte: ['kita', 'hort', 'kinder-betreuung'], antwort: 'Sie brauchen am Tag einen Platz für Ihr Kind? Zum Beispiel eine Kita oder einen Hort. Das Schul-Amt hilft Ihnen.' },
  },
  'musikschule': {
    en: { frage: 'Enrol a child in music school', stichworte: ['music', 'music school', 'instrument', 'conservatory', 'mkz'], antwort: 'Music School Conservatory Zurich (MKZ).' },
    fr: { frage: "Inscrire un enfant à l'école de musique", stichworte: ['musique', 'école de musique', 'instrument', 'conservatoire', 'mkz'], antwort: 'École de musique Conservatoire de Zurich (MKZ).' },
    it: { frage: 'Iscrivere un bambino alla scuola di musica', stichworte: ['musica', 'scuola di musica', 'strumento', 'conservatorio', 'mkz'], antwort: 'Scuola di musica Conservatorio di Zurigo (MKZ).' },
    ls: { frage: 'Kind in die Musik-Schule anmelden', stichworte: ['musik', 'musik-schule', 'instrument', 'mkz'], antwort: 'Ihr Kind will Musik machen? Es gibt die Musik-Schule MKZ. Dort lernt Ihr Kind ein Instrument.' },
  },
  'sportplatz': {
    en: { frage: 'Sports facility, indoor pool, swimming pool', stichworte: ['sport', 'swimming pool', 'indoor pool', 'outdoor pool', 'sports facility', 'gym'], antwort: "Sports Office – the city's pools and sports facilities." },
    fr: { frage: 'Installation sportive, piscine couverte, piscine', stichworte: ['sport', 'piscine', 'piscine couverte', 'piscine en plein air', 'installation sportive', 'salle de gym'], antwort: 'Office des sports – piscines et installations sportives de la ville.' },
    it: { frage: 'Impianto sportivo, piscina coperta, piscina', stichworte: ['sport', 'piscina', 'piscina coperta', "piscina all'aperto", 'impianto sportivo', 'palestra'], antwort: 'Ufficio dello sport – piscine e impianti sportivi della città.' },
    ls: { frage: 'Sport-Anlage, Hallen-Bad, Schwimm-Bad', stichworte: ['sport', 'schwimm-bad', 'hallen-bad', 'baden'], antwort: 'Sie wollen Sport machen oder schwimmen? Die Stadt hat Bäder und Sport-Anlagen. Das macht das Sport-Amt.' },
  },
  'sozialhilfe': {
    en: { frage: 'Apply for social assistance', stichworte: ['social assistance', 'welfare', 'support', 'hardship', 'money', 'benefits'], antwort: 'Social Services – counselling and social assistance.' },
    fr: { frage: "Demander l'aide sociale", stichworte: ['aide sociale', 'soutien', 'détresse', 'argent', 'prestations'], antwort: 'Services sociaux – conseil et aide sociale.' },
    it: { frage: "Richiedere l'aiuto sociale", stichworte: ['aiuto sociale', 'assistenza', 'sostegno', 'difficoltà', 'denaro', 'prestazioni'], antwort: 'Servizi sociali – consulenza e aiuto sociale.' },
    ls: { frage: 'Sozial-Hilfe beantragen', stichworte: ['sozial-hilfe', 'hilfe', 'geld', 'not'], antwort: 'Sie haben zu wenig Geld zum Leben? Sie können Sozial-Hilfe bekommen. Die Sozialen Dienste beraten Sie.' },
  },
  'ahv-zusatz': {
    en: { frage: 'Supplementary benefits to OASI/DI (AHV/IV)', stichworte: ['supplementary benefits', 'ahv', 'iv', 'oasi', 'pension', 'old-age insurance'], antwort: 'Office for Supplementary Benefits to OASI/DI.' },
    fr: { frage: "Prestations complémentaires à l'AVS/AI", stichworte: ['prestations complémentaires', 'ahv', 'avs', 'iv', 'ai', 'rente'], antwort: "Office des prestations complémentaires à l'AVS/AI." },
    it: { frage: "Prestazioni complementari all'AVS/AI", stichworte: ['prestazioni complementari', 'ahv', 'avs', 'iv', 'ai', 'rendita'], antwort: "Ufficio delle prestazioni complementari all'AVS/AI." },
    ls: { frage: 'Zusatz-Leistungen zur AHV und IV', stichworte: ['zusatz-leistung', 'ahv', 'iv', 'rente', 'geld'], antwort: 'Ihre Rente reicht nicht zum Leben? Sie können Zusatz-Leistungen bekommen. Das macht das Amt für Zusatz-Leistungen.' },
  },
  'kesb': {
    en: { frage: 'Child/adult protection, guardianship, adoption', stichworte: ['kesb', 'guardianship', 'adult protection', 'child protection', 'adoption', 'foster child'], antwort: 'Child and Adult Protection Authority (KESB).' },
    fr: { frage: "Protection de l'enfant/adulte, curatelle, adoption", stichworte: ['kesb', 'curatelle', "protection de l'adulte", "protection de l'enfant", 'adoption', 'enfant placé'], antwort: "Autorité de protection de l'enfant et de l'adulte (KESB)." },
    it: { frage: 'Protezione minori/adulti, curatela, adozione', stichworte: ['kesb', 'curatela', 'protezione degli adulti', 'protezione dei minori', 'adozione', 'affido'], antwort: 'Autorità di protezione dei minori e degli adulti (KESB).' },
    ls: { frage: 'Schutz für Kinder und Erwachsene', stichworte: ['kesb', 'beistand', 'schutz', 'adoption'], antwort: 'Ein Mensch braucht Hilfe und Schutz? Zum Beispiel ein Kind oder ein kranker Mensch. Das macht die KESB. KESB heisst: Kindes- und Erwachsenen-Schutz-Behörde.' },
  },
  'asyl': {
    en: { frage: 'Asylum seekers, reception, integration', stichworte: ['asylum', 'refugee', 'reception', 'integration', 'aoz'], antwort: 'AOZ – Asylum Organisation Zurich.' },
    fr: { frage: "Demandeurs d'asile, accueil, intégration", stichworte: ['asile', 'réfugié', 'accueil', 'intégration', 'aoz'], antwort: "AOZ – Organisation d'asile de Zurich." },
    it: { frage: 'Richiedenti asilo, accoglienza, integrazione', stichworte: ['asilo', 'rifugiato', 'accoglienza', 'integrazione', 'aoz'], antwort: "AOZ – Organizzazione per l'asilo di Zurigo." },
    ls: { frage: 'Asyl, Aufnahme, Integration', stichworte: ['asyl', 'flüchtling', 'aoz', 'integration'], antwort: 'Sie suchen Asyl in der Schweiz? Die AOZ hilft Ihnen. AOZ heisst: Asyl-Organisation Zürich.' },
  },
  'berufslehre': {
    en: { frage: 'Find an apprenticeship, career counselling', stichworte: ['apprenticeship', 'traineeship', 'career counselling', 'career choice', 'training', 'education'], antwort: 'Career Centre – vocational guidance.' },
    fr: { frage: 'Trouver un apprentissage, orientation professionnelle', stichworte: ['apprentissage', "place d'apprentissage", 'orientation professionnelle', 'choix de carrière', 'formation'], antwort: 'Centre de carrière – orientation professionnelle.' },
    it: { frage: 'Trovare un tirocinio, orientamento professionale', stichworte: ['tirocinio', 'apprendistato', 'orientamento professionale', 'scelta professionale', 'formazione'], antwort: 'Centro per le carriere – orientamento professionale.' },
    ls: { frage: 'Lehr-Stelle suchen, Berufs-Beratung', stichworte: ['lehre', 'lehr-stelle', 'beruf', 'beratung'], antwort: 'Sie suchen eine Lehr-Stelle? Sie wissen nicht, welcher Beruf passt? Das Laufbahn-Zentrum berät Sie.' },
  },
  'baugesuch': {
    en: { frage: 'Submit a building application / permit', stichworte: ['building application', 'building permit', 'construction', 'renovation', 'extension', 'conversion'], antwort: 'Office for Building Permits.' },
    fr: { frage: 'Déposer une demande de construire / permis', stichworte: ['demande de construire', 'permis de construire', 'construction', 'rénovation', 'agrandissement', 'transformation'], antwort: 'Office des autorisations de construire.' },
    it: { frage: 'Presentare una domanda di costruzione / licenza', stichworte: ['domanda di costruzione', 'licenza edilizia', 'costruzione', 'ristrutturazione', 'ampliamento'], antwort: 'Ufficio delle licenze edilizie.' },
    ls: { frage: 'Bau-Gesuch und Bau-Bewilligung', stichworte: ['bau-gesuch', 'bauen', 'umbau', 'bewilligung'], antwort: 'Sie wollen bauen oder umbauen? Sie brauchen eine Erlaubnis. Das ist die Bau-Bewilligung. Das macht das Amt für Bau-Bewilligungen.' },
  },
  'stadtwohnung': {
    en: { frage: 'Find a municipal apartment', stichworte: ['apartment', 'municipal apartment', 'rent', 'housing', 'non-profit', 'flat'], antwort: 'Immobilien Stadt Zürich – municipal rental apartments.' },
    fr: { frage: 'Chercher un logement municipal', stichworte: ['logement', 'appartement municipal', 'loyer', 'habitation', "logement d'utilité publique"], antwort: 'Immobilien Stadt Zürich – logements locatifs municipaux.' },
    it: { frage: 'Cercare un alloggio comunale', stichworte: ['alloggio', 'appartamento comunale', 'affitto', 'abitazione', 'abitazione di utilità pubblica'], antwort: 'Immobilien Stadt Zürich – appartamenti in affitto comunali.' },
    ls: { frage: 'Wohnung von der Stadt suchen', stichworte: ['wohnung', 'miete', 'stadt-wohnung'], antwort: 'Sie suchen eine Wohnung? Die Stadt hat eigene Wohnungen. Diese Wohnungen sind oft günstiger. Immobilien Stadt Zürich hilft Ihnen.' },
  },
  'steuern': {
    en: { frage: 'Pay taxes / tax return', stichworte: ['tax', 'taxes', 'tax return', 'assessment', 'deadline extension'], antwort: 'Tax Office of the City of Zurich.' },
    fr: { frage: "Payer les impôts / déclaration d'impôt", stichworte: ['impôt', 'impôts', "déclaration d'impôt", 'taxation', 'prolongation de délai'], antwort: 'Office des impôts de la Ville de Zurich.' },
    it: { frage: "Pagare le imposte / dichiarazione d'imposta", stichworte: ['imposta', 'imposte', "dichiarazione d'imposta", 'tassazione', 'proroga del termine'], antwort: 'Ufficio imposte della Città di Zurigo.' },
    ls: { frage: 'Steuern zahlen und Steuer-Erklärung', stichworte: ['steuer', 'steuer-erklärung', 'geld'], antwort: 'Sie müssen Steuern zahlen. Jedes Jahr machen Sie eine Steuer-Erklärung. Das Steuer-Amt hilft Ihnen.' },
  },
  'strom': {
    en: { frage: 'Register electricity, electricity provider', stichworte: ['electricity', 'power', 'ewz', 'energy'], antwort: 'ewz – Electricity Utility of the City of Zurich.' },
    fr: { frage: "Annoncer l'électricité, fournisseur d'électricité", stichworte: ['électricité', 'courant', 'ewz', 'énergie'], antwort: "ewz – Services industriels d'électricité de la Ville de Zurich." },
    it: { frage: "Annunciare l'elettricità, fornitore di elettricità", stichworte: ['elettricità', 'corrente', 'ewz', 'energia'], antwort: 'ewz – Azienda elettrica della Città di Zurigo.' },
    ls: { frage: 'Strom anmelden', stichworte: ['strom', 'ewz', 'energie'], antwort: 'Sie ziehen in eine neue Wohnung? Sie brauchen Strom. Das ewz liefert den Strom. Sie melden den Strom beim ewz an.' },
  },
  'wasser': {
    en: { frage: 'Water connection, drinking water quality', stichworte: ['water', 'drinking water', 'water connection', 'pipe'], antwort: 'Water Supply Zurich.' },
    fr: { frage: "Raccordement d'eau, qualité de l'eau potable", stichworte: ['eau', 'eau potable', "raccordement d'eau", 'conduite'], antwort: 'Approvisionnement en eau de Zurich.' },
    it: { frage: "Allacciamento idrico, qualità dell'acqua potabile", stichworte: ['acqua', 'acqua potabile', 'allacciamento idrico', 'condotta'], antwort: 'Approvvigionamento idrico di Zurigo.' },
    ls: { frage: 'Wasser-Anschluss und Trink-Wasser', stichworte: ['wasser', 'trink-wasser'], antwort: 'Sie haben Fragen zum Wasser? Zum Beispiel zur Qualität vom Trink-Wasser. Die Wasser-Versorgung Zürich hilft Ihnen.' },
  },
  'abfall': {
    en: { frage: 'Waste calendar, bulky waste, recycling', stichworte: ['waste', 'bulky waste', 'rubbish', 'recycling', 'glass', 'paper', 'garbage', 'erz'], antwort: 'ERZ – Disposal + Recycling Zurich, waste division.' },
    fr: { frage: 'Calendrier des déchets, encombrants, recyclage', stichworte: ['déchets', 'encombrants', 'ordures', 'recyclage', 'verre', 'papier', 'erz'], antwort: 'ERZ – Élimination + recyclage Zurich, secteur déchets.' },
    it: { frage: 'Calendario dei rifiuti, ingombranti, riciclaggio', stichworte: ['rifiuti', 'ingombranti', 'spazzatura', 'riciclaggio', 'vetro', 'carta', 'erz'], antwort: 'ERZ – Smaltimento + riciclaggio Zurigo, settore rifiuti.' },
    ls: { frage: 'Abfall, Sperr-Gut, Recycling', stichworte: ['abfall', 'sperr-gut', 'müll', 'recycling', 'erz'], antwort: 'Wann kommt die Müll-Abfuhr? Wohin mit altem Glas oder Papier? Die ERZ kümmert sich um den Abfall.' },
  },
  'stadtreinigung': {
    en: { frage: 'Street cleaning, snow clearing', stichworte: ['street cleaning', 'cleaning', 'snow', 'snow clearing', 'winter service', 'erz'], antwort: 'ERZ – Street Cleaning.' },
    fr: { frage: 'Nettoyage des rues, déneigement', stichworte: ['nettoyage des rues', 'propreté', 'neige', 'déneigement', 'service hivernal', 'erz'], antwort: 'ERZ – Nettoiement.' },
    it: { frage: 'Pulizia delle strade, sgombero neve', stichworte: ['pulizia delle strade', 'pulizia', 'neve', 'sgombero neve', 'servizio invernale', 'erz'], antwort: 'ERZ – Pulizia stradale.' },
    ls: { frage: 'Strassen-Reinigung und Schnee-Räumung', stichworte: ['strassen-reinigung', 'schnee', 'putzen', 'erz'], antwort: 'Wer putzt die Strassen? Wer räumt den Schnee weg? Das macht die ERZ.' },
  },
  'oev': {
    en: { frage: 'Tram, bus, public transport passes', stichworte: ['tram', 'bus', 'public transport', 'vbz', 'pass', 'ticket', 'transit'], antwort: 'VBZ – Zurich Public Transport.' },
    fr: { frage: 'Tram, bus, abonnements de transports publics', stichworte: ['tram', 'bus', 'transports publics', 'vbz', 'abonnement', 'billet'], antwort: 'VBZ – Transports publics zurichois.' },
    it: { frage: 'Tram, bus, abbonamenti dei trasporti pubblici', stichworte: ['tram', 'bus', 'trasporti pubblici', 'vbz', 'abbonamento', 'biglietto'], antwort: 'VBZ – Trasporti pubblici di Zurigo.' },
    ls: { frage: 'Tram, Bus und ÖV-Abo', stichworte: ['tram', 'bus', 'öv', 'vbz', 'abo'], antwort: 'Sie fahren mit Tram oder Bus? Das ist der öffentliche Verkehr. Kurz: ÖV. Die VBZ fährt die Trams und Busse.' },
  },
  'pflegeheim': {
    en: { frage: 'Care home, home care (Spitex), elderly care', stichworte: ['care', 'care home', 'nursing home', 'spitex', 'senior centre', 'dementia', 'home care'], antwort: 'Care Centres / Health Centres for the Elderly.' },
    fr: { frage: 'EMS, soins à domicile (Spitex), prise en charge des aînés', stichworte: ['soins', 'ems', 'maison de retraite', 'spitex', 'centre pour personnes âgées', 'démence'], antwort: 'Centres de soins / centres de santé pour personnes âgées.' },
    it: { frage: 'Casa di cura, cure a domicilio (Spitex), assistenza agli anziani', stichworte: ['cure', 'casa di cura', 'casa per anziani', 'spitex', 'centro per anziani', 'demenza'], antwort: 'Centri di cura / centri sanitari per anziani.' },
    ls: { frage: 'Pflege-Heim, Spitex, Hilfe im Alter', stichworte: ['pflege', 'pflege-heim', 'spitex', 'alter'], antwort: 'Ein alter Mensch braucht Pflege? Es gibt Pflege-Heime. Die Spitex hilft auch zu Hause.' },
  },
  'spital': {
    en: { frage: 'Hospital treatment', stichworte: ['hospital', 'clinic', 'treatment', 'medical emergency', 'city hospital'], antwort: 'Stadtspital Zurich (Triemli and Waid sites).' },
    fr: { frage: 'Traitement hospitalier', stichworte: ['hôpital', 'clinique', 'traitement', 'urgence médicale', 'hôpital municipal'], antwort: 'Stadtspital Zurich (sites Triemli et Waid).' },
    it: { frage: 'Cure ospedaliere', stichworte: ['ospedale', 'clinica', 'cura', 'emergenza medica', 'ospedale cittadino'], antwort: 'Stadtspital Zurigo (sedi Triemli e Waid).' },
    ls: { frage: 'Behandlung im Spital', stichworte: ['spital', 'krankenhaus', 'notfall'], antwort: 'Sie sind krank und müssen ins Spital? Die Stadt hat ein Spital. Es heisst Stadt-Spital Zürich. Es gibt 2 Häuser: Triemli und Waid.' },
  },
  'schul-arzt': {
    en: { frage: 'School medical check-up, school health', stichworte: ['school doctor', 'school health', 'check-up', 'school vaccination'], antwort: 'School Health Services.' },
    fr: { frage: 'Examen médical scolaire, santé scolaire', stichworte: ['médecin scolaire', 'santé scolaire', 'examen', 'vaccination scolaire'], antwort: 'Services de santé scolaire.' },
    it: { frage: 'Visita medica scolastica, salute a scuola', stichworte: ['medico scolastico', 'salute scolastica', 'visita', 'vaccinazione scolastica'], antwort: 'Servizi di salute scolastica.' },
    ls: { frage: 'Schul-Arzt und Gesundheit in der Schule', stichworte: ['schul-arzt', 'gesundheit', 'schule'], antwort: 'In der Schule gibt es einen Schul-Arzt. Der Schul-Arzt schaut, ob Ihr Kind gesund ist. Das machen die Schul-Gesundheits-Dienste.' },
  },
  'umwelt': {
    en: { frage: 'Noise, air quality, food inspection', stichworte: ['noise', 'air', 'environment', 'food', 'gastronomy', 'ugz'], antwort: 'Environmental and Health Protection Zurich (UGZ).' },
    fr: { frage: "Bruit, qualité de l'air, contrôle des denrées alimentaires", stichworte: ['bruit', 'air', 'environnement', 'denrées alimentaires', 'restauration', 'ugz'], antwort: "Protection de l'environnement et de la santé Zurich (UGZ)." },
    it: { frage: "Rumore, qualità dell'aria, controllo alimentare", stichworte: ['rumore', 'aria', 'ambiente', 'alimenti', 'ristorazione', 'ugz'], antwort: "Protezione dell'ambiente e della salute Zurigo (UGZ)." },
    ls: { frage: 'Lärm, Luft und Lebensmittel', stichworte: ['lärm', 'luft', 'umwelt', 'lebensmittel', 'ugz'], antwort: 'Es ist zu laut bei Ihnen? Oder Sie haben Fragen zur Luft oder zum Essen? Das macht der Umwelt- und Gesundheits-Schutz Zürich. Kurz: UGZ.' },
  },
  'polizei': {
    en: { frage: 'Police, file a report', stichworte: ['police', 'report', 'theft', 'burglary', 'traffic accident'], antwort: 'Zurich City Police.' },
    fr: { frage: 'Police, déposer plainte', stichworte: ['police', 'plainte', 'vol', 'cambriolage', 'accident de la circulation'], antwort: 'Police municipale de Zurich.' },
    it: { frage: 'Polizia, sporgere denuncia', stichworte: ['polizia', 'denuncia', 'furto', 'scasso', 'incidente stradale'], antwort: 'Polizia municipale di Zurigo.' },
    ls: { frage: 'Polizei und Anzeige machen', stichworte: ['polizei', 'anzeige', 'diebstahl'], antwort: 'Ihnen ist etwas Schlimmes passiert? Zum Beispiel ein Diebstahl. Sie können zur Polizei gehen und eine Anzeige machen. Das ist die Stadt-Polizei Zürich.' },
  },
  'feuerwehr': {
    en: { frage: 'Fire brigade, ambulance, emergency', stichworte: ['fire brigade', 'fire', 'ambulance', 'rescue', 'emergency'], antwort: 'Schutz & Rettung Zurich – fire brigade and ambulance.' },
    fr: { frage: 'Pompiers, ambulance, urgence', stichworte: ['pompiers', 'incendie', 'ambulance', 'secours', 'urgence'], antwort: 'Schutz & Rettung Zurich – pompiers et ambulance.' },
    it: { frage: 'Pompieri, ambulanza, emergenza', stichworte: ['pompieri', 'incendio', 'ambulanza', 'soccorso', 'emergenza'], antwort: 'Schutz & Rettung Zurigo – pompieri e ambulanza.' },
    ls: { frage: 'Feuer-Wehr, Sanität, Notfall', stichworte: ['feuer-wehr', 'feuer', 'notfall', 'sanität'], antwort: 'Es brennt? Oder ein Mensch ist schwer krank? Dann rufen Sie Hilfe. Die Feuer-Wehr rufen Sie mit der Nummer 118. Die Sanität rufen Sie mit der Nummer 144. Das ist Schutz und Rettung Zürich.' },
  },
  'parkbusse': {
    en: { frage: 'Parking fine / penalty order', stichworte: ['parking fine', 'fine', 'penalty order', 'ticket', 'fixed penalty'], antwort: 'Stadtrichteramt – fines and penalty orders.' },
    fr: { frage: 'Amende de parking / ordonnance pénale', stichworte: ['amende de parking', 'amende', 'ordonnance pénale', 'contravention'], antwort: 'Stadtrichteramt – amendes et ordonnances pénales.' },
    it: { frage: "Multa di parcheggio / decreto d'accusa", stichworte: ['multa di parcheggio', 'multa', "decreto d'accusa", 'contravvenzione'], antwort: "Stadtrichteramt – multe e decreti d'accusa." },
    ls: { frage: 'Parkbusse und Strafe', stichworte: ['parkbusse', 'busse', 'strafe'], antwort: 'Sie haben eine Busse bekommen? Zum Beispiel fürs falsche Parkieren. Das Stadtrichter-Amt kümmert sich um Bussen.' },
  },
  'parkplatz': {
    en: { frage: 'Parking permit, blue zone, parking spaces', stichworte: ['parking permit', 'blue zone', 'parking space', 'resident', 'parking'], antwort: 'Traffic Department – parking management.' },
    fr: { frage: 'Macaron de stationnement, zone bleue, places de parc', stichworte: ['macaron', 'zone bleue', 'place de parc', 'riverain', 'stationnement'], antwort: 'Division de la circulation – gestion du stationnement.' },
    it: { frage: 'Permesso di parcheggio, zona blu, posteggi', stichworte: ['permesso di parcheggio', 'zona blu', 'posteggio', 'residente', 'parcheggio'], antwort: 'Divisione del traffico – gestione dei parcheggi.' },
    ls: { frage: 'Parkkarte, blaue Zone, Parkplatz', stichworte: ['parkkarte', 'blaue zone', 'parkplatz', 'parkieren'], antwort: 'Sie brauchen einen Parkplatz bei Ihrer Wohnung? Sie können eine Parkkarte kaufen. Das macht die Dienst-Abteilung Verkehr.' },
  },
  'betreibung': {
    en: { frage: 'Initiate debt collection, debt register extract', stichworte: ['debt collection', 'debt enforcement', 'debts', 'register extract', 'bankruptcy'], antwort: 'Stadtammann and Debt Collection Office.' },
    fr: { frage: 'Engager une poursuite, extrait du registre des poursuites', stichworte: ['poursuite', 'dettes', 'extrait du registre des poursuites', 'faillite'], antwort: 'Office du Stadtammann et des poursuites.' },
    it: { frage: "Avviare un'esecuzione, estratto del registro esecuzioni", stichworte: ['esecuzione', 'debiti', 'estratto del registro esecuzioni', 'fallimento'], antwort: "Ufficio dello Stadtammann e delle esecuzioni." },
    ls: { frage: 'Betreibung und Auszug aus dem Register', stichworte: ['betreibung', 'schulden', 'register'], antwort: 'Jemand zahlt Ihnen Geld nicht? Sie können eine Betreibung starten. Sie brauchen einen Auszug aus dem Betreibungs-Register? Das macht das Stadtammann- und Betreibungs-Amt.' },
  },
  'stadtarchiv': {
    en: { frage: 'Historical records, family research', stichworte: ['archive', 'history', 'family research', 'ancestry', 'records'], antwort: 'City Archive Zurich.' },
    fr: { frage: 'Documents historiques, recherche généalogique', stichworte: ['archives', 'histoire', 'recherche généalogique', 'ancêtres', 'documents'], antwort: 'Archives de la Ville de Zurich.' },
    it: { frage: 'Documenti storici, ricerca genealogica', stichworte: ['archivio', 'storia', 'ricerca genealogica', 'antenati', 'documenti'], antwort: 'Archivio della Città di Zurigo.' },
    ls: { frage: 'Alte Akten und Familien-Forschung', stichworte: ['archiv', 'geschichte', 'familie', 'akten'], antwort: 'Sie suchen alte Dokumente? Oder Sie forschen über Ihre Familie? Das Stadt-Archiv Zürich hat alte Akten.' },
  },
  'statistik': {
    en: { frage: 'Population figures, statistical data', stichworte: ['statistics', 'population figures', 'data', 'numbers', 'open data'], antwort: 'Statistics Office of the City of Zurich.' },
    fr: { frage: 'Chiffres de la population, données statistiques', stichworte: ['statistiques', 'chiffres de la population', 'données', 'chiffres', 'open data'], antwort: 'Statistique de la Ville de Zurich.' },
    it: { frage: 'Dati sulla popolazione, dati statistici', stichworte: ['statistica', 'dati sulla popolazione', 'dati', 'numeri', 'open data'], antwort: 'Statistica della Città di Zurigo.' },
    ls: { frage: 'Zahlen und Statistik', stichworte: ['statistik', 'zahlen', 'daten'], antwort: 'Sie suchen Zahlen über die Stadt? Zum Beispiel: Wie viele Menschen wohnen hier? Das macht Statistik Stadt Zürich.' },
  },
};

const data = JSON.parse(readFileSync(FILE, 'utf8'));
let filled = 0;
const missing = [];
for (const entry of data.lebenslagen) {
  const tr = T[entry.id];
  if (!tr) {
    missing.push(entry.id);
    continue;
  }
  for (const loc of ['en', 'fr', 'it', 'ls']) {
    entry.i18n[loc] = tr[loc];
  }
  filled++;
}

if (missing.length) {
  console.error('FEHLT Übersetzung für:', missing.join(', '));
  process.exit(1);
}

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`✓ ${filled}/${data.lebenslagen.length} Lebenslagen mit en/fr/it/ls befüllt.`);

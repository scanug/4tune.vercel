// Spunti per Passa la Bomba.
// Categorie: si dice una cosa che ci rientra. Sillabe: una parola che le contiene.

export const BOMBA_CATEGORIES = [
  'Marche di auto', 'Frutti', 'Città italiane', 'Animali della fattoria', 'Cose che trovi in cucina',
  'Calciatori', 'Cantanti italiani', 'Film Disney', 'Sport', 'Colori',
  'Strumenti musicali', 'Professioni', 'Paesi europei', 'Capitali del mondo', 'Formaggi',
  'Tipi di pasta', 'Supereroi', 'Personaggi dei cartoni', 'Marche di vestiti', 'Parti del corpo',
  'Cose in bagno', 'Mezzi di trasporto', 'Serie TV', 'Videogiochi', 'Pokémon',
  'App sul telefono', 'Dolci', 'Cocktail e drink', 'Verdure', 'Fiori',
  'Pesci', 'Uccelli', 'Insetti', 'Mobili', 'Cose da portare al mare',
  'Giochi da tavolo', 'Squadre di calcio', 'Regioni italiane', 'Fiumi', 'Cose dello spazio',
  'Lingue', 'Personaggi storici', 'Materie scolastiche', 'Cose rosse', 'Cose rotonde',
  'Cose che fanno rumore', 'Cose in uno zaino', 'Attori e attrici', 'Band musicali', 'Feste e ricorrenze',
  'Balli', 'Cose in un ufficio', 'Fast food', 'Spezie ed erbe', 'Animali della giungla',
  'Animali marini', 'Razze di cani', 'Emozioni', 'Cose al supermercato', 'Accessori',
  'Attrezzi da lavoro', 'Utensili da cucina', 'Cose che volano', 'Parole inglesi usate in italiano', 'Social network',
  'Cose fredde', 'Cose con le ruote', 'Monumenti famosi', 'Isole', 'Montagne',
  'Bevande calde', 'Piatti tipici italiani', 'Elettrodomestici', 'Giocattoli', 'Lavori di casa',
  'Cose da fare in vacanza', 'Nomi femminili', 'Nomi maschili', 'Cose verdi', 'Sport olimpici',
  'Marche di tecnologia', 'Cose che si aprono', 'Cose morbide', 'Cose che pungono', 'Gusti di gelato',
];

export const BOMBA_SYLLABLES = [
  'CA', 'CO', 'MA', 'TO', 'RE', 'PA', 'LA', 'NO', 'TA', 'PE',
  'SA', 'RI', 'TI', 'LO', 'BA', 'VE', 'NE', 'GA', 'PO', 'MO',
  'FI', 'SE', 'DO', 'LI', 'ST', 'TR', 'PR', 'GR', 'BR', 'SP',
  'CHE', 'GLI', 'GNO', 'SCI', 'ZZA', 'TTO', 'ANT', 'ERO', 'ONE', 'ATO',
  'ELLA', 'INO', 'URA', 'ANO', 'ESA', 'OLA', 'ICA', 'OSO', 'IRE', 'ARE',
];

// Durata della miccia in secondi: [minimo, massimo]
export const BOMBA_FUSES = {
  corta: [10, 25],
  media: [20, 45],
  lunga: [40, 75],
};

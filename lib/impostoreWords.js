// Word packs for Impostore game

export const CLASSICA_WORDS = [
  'Pizza', 'Gelato', 'Spiaggia', 'Calcio', 'Chitarra', 'Astronauta', 'Vulcano',
  'Dinosauro', 'Pirata', 'Fantasma', 'Robot', 'Sirena', 'Drago', 'Castello',
  'Tramonto', 'Arcobaleno', 'Cascata', 'Foresta', 'Deserto', 'Montagna',
  'Panino', 'Cioccolato', 'Caffè', 'Pasta', 'Tiramisù', 'Lasagna', 'Sushi',
  'Hamburger', 'Popcorn', 'Cornetto',
  'Pallone', 'Skateboard', 'Bicicletta', 'Paracadute', 'Surf', 'Snowboard',
  'Piscina', 'Palestra', 'Discoteca', 'Cinema',
  'Elefante', 'Pinguino', 'Canguro', 'Delfino', 'Squalo', 'Leone',
  'Aquila', 'Serpente', 'Ragno', 'Farfalla',
  'Ambulanza', 'Elicottero', 'Sottomarino', 'Treno', 'Mongolfiera',
  'Razzo', 'Limousine', 'Taxi', 'Autobus', 'Nave',
  'Scuola', 'Ospedale', 'Supermercato', 'Aeroporto', 'Stadio',
  'Chiesa', 'Museo', 'Zoo', 'Luna Park', 'Biblioteca',
  'Spada', 'Pistola', 'Bomba', 'Scudo', 'Armatura',
  'Corona', 'Diamante', 'Telescopio', 'Microscopio', 'Occhiali',
  'Pigiama', 'Costume', 'Cravatta', 'Cappello', 'Stivali',
  'Natale', 'Halloween', 'Carnevale', 'Compleanno', 'Matrimonio',
  'Terremoto', 'Tornado', 'Fulmine', 'Neve', 'Nebbia',
  'Mago', 'Clown', 'Ninja', 'Cowboy', 'Superman',
  'Tatuaggio', 'Piercing', 'Parrucca', 'Trucco', 'Selfie',
  'WiFi', 'Smartphone', 'PlayStation', 'TikTok', 'Netflix',
];

// Ocane mode: host provides custom words via input
// No predefined pack needed

export function pickRandomWord(words) {
  return words[Math.floor(Math.random() * words.length)];
}

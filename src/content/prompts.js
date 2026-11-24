// The whole content bank. No API, no generated text, no surprises.
//
// Each prompt has a blank (two or more underscores) and exactly one answer that
// actually is true. The fact line is what the reveal shows, so the game teaches
// something instead of just ending. Add entries freely; ids must stay unique.

export const PROMPTS = [
  {
    id: 'p01',
    prompt: 'The only mammal that cannot jump is the ___.',
    answer: 'elephant',
    fact: 'Elephants have no spring in their step: their legs are built for carrying weight, not launching it.'
  },
  {
    id: 'p02',
    prompt: 'A group of flamingos is called a ___.',
    answer: 'flamboyance',
    fact: 'Collective nouns got theatrical in the Middle Ages, and this one stuck.'
  },
  {
    id: 'p03',
    prompt: 'Honey sealed in ancient tombs was still ___ when it was found.',
    answer: 'edible',
    fact: 'Honey is too dry and too acidic for most microbes, so it keeps for a very long time.'
  },
  {
    id: 'p04',
    prompt: 'The shortest war in history lasted about ___ minutes.',
    answer: '38',
    fact: 'The Anglo-Zanzibar War of 1896 was over in well under an hour.'
  },
  {
    id: 'p05',
    prompt: 'The Eiffel Tower can stand about ___ taller in summer.',
    answer: '15 cm',
    fact: 'Iron expands in heat, so the tower grows a little and leans away from the sun.'
  },
  {
    id: 'p06',
    prompt: 'An octopus has ___ hearts.',
    answer: 'three',
    fact: 'Two pump blood through the gills and one serves the rest of the body.'
  },
  {
    id: 'p07',
    prompt: 'Botanically speaking, a banana is a ___.',
    answer: 'berry',
    fact: 'It grows from a single flower with a single ovary, which is the botanical test.'
  },
  {
    id: 'p08',
    prompt: 'A day on Venus lasts longer than a Venusian ___.',
    answer: 'year',
    fact: 'Venus spins so slowly that one rotation takes longer than one orbit of the sun.'
  },
  {
    id: 'p09',
    prompt: 'The unicorn is the national animal of ___.',
    answer: 'Scotland',
    fact: 'It has been on Scottish royal arms for centuries, chosen as a symbol of purity and stubbornness.'
  },
  {
    id: 'p10',
    prompt: 'Sharks are older than ___.',
    answer: 'trees',
    fact: 'Shark-like fish predate the first woody plants by tens of millions of years.'
  },
  {
    id: 'p11',
    prompt: 'Wombat droppings are shaped like ___.',
    answer: 'cubes',
    fact: 'The cube shape stops them rolling off the logs wombats use to mark territory.'
  },
  {
    id: 'p12',
    prompt: 'The dot over a lowercase i is called a ___.',
    answer: 'tittle',
    fact: 'From the Latin titulus, a small mark or label. The word survives mostly in this fact.'
  },
  {
    id: 'p13',
    prompt: "A shrimp's heart sits in its ___.",
    answer: 'head',
    fact: 'The heart sits just under the carapace, which is the front half of the animal.'
  },
  {
    id: 'p14',
    prompt: 'A sloth can hold its breath longer than a ___.',
    answer: 'dolphin',
    fact: 'Sloths slow their metabolism so far that a dive can last around forty minutes.'
  },
  {
    id: 'p15',
    prompt: 'The first product ever scanned with a barcode was a packet of ___.',
    answer: 'gum',
    fact: 'A pack of Wrigley\u2019s chewing gum was scanned in Ohio in 1974.'
  },
  {
    id: 'p16',
    prompt: 'The Michelin guide was created to sell ___.',
    answer: 'tyres',
    fact: 'The tyre company published a motoring guide in 1900 to encourage people to drive more.'
  },
  {
    id: 'p17',
    prompt: 'Nintendo was founded in ___.',
    answer: '1889',
    fact: 'It started as a maker of playing cards and did not touch video games for most of a century.'
  },
  {
    id: 'p18',
    prompt: 'The Canary Islands are named after ___.',
    answer: 'dogs',
    fact: 'The Latin name meant "island of the dogs", not "island of the canaries".'
  },
  {
    id: 'p19',
    prompt: 'The croissant began in ___.',
    answer: 'Austria',
    fact: 'The Austrian kipferl came first; French bakers turned it into the crescent we know.'
  },
  {
    id: 'p20',
    prompt: 'A jiffy is a real unit of ___.',
    answer: 'time',
    fact: 'In computing it is often one hundredth of a second. In physics it is much smaller.'
  },
  {
    id: 'p21',
    prompt: 'The smell after rain is called ___.',
    answer: 'petrichor',
    fact: 'Plant oils and soil bacteria combine into the smell that rises when dry ground gets wet.'
  },
  {
    id: 'p22',
    prompt: 'The plastic tip on a shoelace is called an ___.',
    answer: 'aglet',
    fact: 'It keeps the lace from fraying. Without one, the whole lace is on borrowed time.'
  },
  {
    id: 'p23',
    prompt: 'The largest desert on Earth is ___.',
    answer: 'Antarctica',
    fact: 'A desert is defined by dryness, not sand. Antarctica is the driest continent.'
  },
  {
    id: 'p24',
    prompt: 'Cleopatra lived closer in time to the ___ than to the Great Pyramid.',
    answer: 'Moon landing',
    fact: 'The pyramid was already about 2,500 years old when she was born.'
  },
  {
    id: 'p25',
    prompt: 'The disposable lighter was invented before the ___.',
    answer: 'match',
    fact: 'The first lighter appeared in 1823; the friction match followed a few years later.'
  },
  {
    id: 'p26',
    prompt: 'The first computer bug was an actual ___.',
    answer: 'moth',
    fact: 'A moth was taped into a 1947 logbook at Harvard with a note about the first actual case of bug.'
  },
  {
    id: 'p27',
    prompt: 'The Great Fire of London began in a ___.',
    answer: 'bakery',
    fact: 'It started in a baker\u2019s shop on Pudding Lane in 1666.'
  },
  {
    id: 'p28',
    prompt: "The Hundred Years' War lasted ___ years.",
    answer: '116',
    fact: 'The name is traditional; the fighting ran from 1337 to 1453 with long pauses.'
  },
  {
    id: 'p29',
    prompt: 'The country with the most time zones is ___.',
    answer: 'France',
    fact: 'Its overseas territories stretch across twelve zones, more than Russia.'
  },
  {
    id: 'p30',
    prompt: 'A newborn ___ is about the size of a grain of rice.',
    answer: 'kangaroo',
    fact: 'A joey is born tiny and climbs into the pouch to finish growing.'
  },
  {
    id: 'p31',
    prompt: 'In Switzerland it is illegal to own just one ___.',
    answer: 'guinea pig',
    fact: 'The law treats them as social animals, so they must have company.'
  },
  {
    id: 'p32',
    prompt: 'The first thing ever sold on eBay was a broken ___.',
    answer: 'laser pointer',
    fact: 'It went for about fourteen dollars in 1995, mostly as a test of the new site.'
  },
  {
    id: 'p33',
    prompt: 'A Greenland shark can live for about ___ years.',
    answer: '300',
    fact: 'Radiocarbon dating of their eyes suggests some are centuries old.'
  },
  {
    id: 'p34',
    prompt: 'A tardigrade can survive in the vacuum of ___.',
    answer: 'space',
    fact: 'They curl into a dried-out state and wait. Some have come back from orbit.'
  },
  {
    id: 'p35',
    prompt: 'The oldest living trees are ___ pines.',
    answer: 'bristlecone',
    fact: 'Some bristlecone pines in the American west are nearly five thousand years old.'
  },
  {
    id: 'p36',
    prompt: 'Your body contains enough ___ to make a small nail.',
    answer: 'iron',
    fact: 'Most of it is in your blood, carrying oxygen around.'
  },
  {
    id: 'p37',
    prompt: 'The human nose can tell apart about one ___ different smells.',
    answer: 'trillion',
    fact: 'A 2014 study put the number far higher than the old figure of ten thousand.'
  },
  {
    id: 'p38',
    prompt: "The first internet message was meant to say 'login'. It got as far as ___.",
    answer: 'LO',
    fact: 'The system crashed after two letters, which is why the first message on the network was "LO".'
  },
  {
    id: 'p39',
    prompt: 'The first webcam watched a ___.',
    answer: 'coffee pot',
    fact: 'Researchers at Cambridge pointed a camera at the coffee room so nobody made a wasted trip.'
  },
  {
    id: 'p40',
    prompt: 'The first domain name ever registered was ___.',
    answer: 'symbolics.com',
    fact: 'It was registered in 1985 and still resolves today.'
  },
  {
    id: 'p41',
    prompt: 'The most translated book in the world is the ___.',
    answer: 'Bible',
    fact: 'It has been translated into more languages than any other book.'
  },
  {
    id: 'p42',
    prompt: 'The country that drinks the most coffee per person is ___.',
    answer: 'Finland',
    fact: 'Finns get through several cups a day on average, well ahead of Italy.'
  },
  {
    id: 'p43',
    prompt: 'Lightning is about five times hotter than the surface of the ___.',
    answer: 'sun',
    fact: 'A strike can reach around thirty thousand kelvin; the sun\u2019s surface is about six thousand.'
  },
  {
    id: 'p44',
    prompt: 'The crack of a whip is actually a small ___.',
    answer: 'sonic boom',
    fact: 'The tip moves faster than sound, and the crack is the shock wave it leaves behind.'
  },
  {
    id: 'p45',
    prompt: 'The fastest animal in the world is the ___.',
    answer: 'peregrine falcon',
    fact: 'In a hunting dive it is the fastest animal on the planet, well over two hundred miles an hour.'
  },
  {
    id: 'p46',
    prompt: 'The animal that kills the most humans each year is the ___.',
    answer: 'mosquito',
    fact: 'Not by biting, but by carrying disease. It is the deadliest animal to humans by a wide margin.'
  },
  {
    id: 'p47',
    prompt: 'The largest organ in the human body is the ___.',
    answer: 'skin',
    fact: 'It covers roughly two square metres and replaces itself constantly.'
  },
  {
    id: 'p48',
    prompt: 'The strongest muscle in the human body for its size is the ___.',
    answer: 'jaw',
    fact: 'The masseter can close your teeth with hundreds of pounds of force.'
  },
  {
    id: 'p49',
    prompt: 'The only letter missing from every US state name is ___.',
    answer: 'Q',
    fact: 'Fifty states, twenty-six letters, and one of them never appears.'
  },
  {
    id: 'p50',
    prompt: "The word 'robot' comes from a Czech word for ___.",
    answer: 'forced labour',
    fact: 'Karel \u010capek used robota, the word for drudgery or forced work, in a 1920 play.'
  },
  {
    id: 'p51',
    prompt: "The word 'quarantine' comes from the Italian for ___.",
    answer: 'forty days',
    fact: 'Ships were held for quaranta giorni before passengers could come ashore.'
  },
  {
    id: 'p52',
    prompt: "The word 'sandwich' is named after a ___.",
    answer: 'earl',
    fact: 'The Earl of Sandwich is said to have asked for meat between bread so he could keep playing cards.'
  },
  {
    id: 'p53',
    prompt: "The word 'salary' comes from the Latin for ___.",
    answer: 'salt',
    fact: 'Sal was valuable enough to be a unit of pay, or at least a good story about one.'
  },
  {
    id: 'p54',
    prompt: "The word 'panic' comes from the god ___.",
    answer: 'Pan',
    fact: 'A sudden fright in the wild was blamed on Pan, the goat-legged god of the countryside.'
  },
  {
    id: 'p55',
    prompt: "The word 'algebra' comes from Arabic for ___.",
    answer: 'reunion',
    fact: 'Al-jabr described putting broken parts back together, which is roughly what the maths does.'
  },
  {
    id: 'p56',
    prompt: "A 'jumbo' jet is named after an ___.",
    answer: 'elephant',
    fact: 'Jumbo was a famous circus elephant, and the name became shorthand for anything enormous.'
  },
  {
    id: 'p57',
    prompt: 'The Pillsbury Doughboy is really called ___.',
    answer: "Poppin' Fresh",
    fact: 'He has been poking his own belly in adverts since 1965.'
  },
  {
    id: 'p58',
    prompt: 'Astronauts report that the Moon smells like ___.',
    answer: 'gunpowder',
    fact: 'Lunar dust brought inside the capsule smelled of spent fireworks to the Apollo crews.'
  },
  {
    id: 'p59',
    prompt: 'A decent-sized cloud can weigh more than a ___.',
    answer: 'blue whale',
    fact: 'The water in a fluffy cumulus adds up to hundreds of tonnes.'
  },
  {
    id: 'p60',
    prompt: 'There are more possible chess games than ___ in the universe.',
    answer: 'atoms',
    fact: 'The Shannon number is a lower bound on chess, and it dwarfs the observable universe.'
  },
  {
    id: 'p61',
    prompt: 'A group of crows is called a ___.',
    answer: 'murder',
    fact: 'Crows are smart, social and apparently deserving of a dramatic collective noun.'
  },
  {
    id: 'p62',
    prompt: 'A group of owls is called a ___.',
    answer: 'parliament',
    fact: 'Because they sit in silence and look like they are judging you.'
  },
  {
    id: 'p63',
    prompt: 'A group of jellyfish is called a ___.',
    answer: 'smack',
    fact: 'A bloom, a swarm or a smack, depending on who you ask. Smack is the fun one.'
  },
  {
    id: 'p64',
    prompt: 'The only bird that can fly backwards is the ___.',
    answer: 'hummingbird',
    fact: 'Its wings rotate at the shoulder, so it can hover and reverse.'
  },
  {
    id: 'p65',
    prompt: 'The first message ever sent by text said ___.',
    answer: 'Merry Christmas',
    fact: 'It was sent in 1992 by an engineer testing the new short message service.'
  },
  {
    id: 'p66',
    prompt: 'The first video uploaded to YouTube was called "Me at the ___".',
    answer: 'zoo',
    fact: 'It is nineteen seconds of a man standing in front of elephants.'
  },
  {
    id: 'p67',
    prompt: 'The first item sold on Amazon was a ___.',
    answer: 'book',
    fact: 'The first sale in 1995 was Douglas Hofstadter\u2019s Fluid Concepts and Creative Analogies.'
  },
  {
    id: 'p68',
    prompt: 'The most common password in the world is ___.',
    answer: '123456',
    fact: 'It has topped the breach lists for years, which is not a compliment.'
  }
];

export const PROMPT_COUNT = PROMPTS.length;

/**
 * Themed packs for /bluff. Every prompt belongs to exactly one pack, so the
 * packs are disjoint and together cover the whole bank.
 */
export const PACKS = {
  animals: ['p01', 'p02', 'p06', 'p10', 'p11', 'p13', 'p14', 'p30', 'p31', 'p33', 'p34', 'p45', 'p46', 'p56', 'p61', 'p62', 'p63', 'p64'],
  food: ['p03', 'p07', 'p15', 'p16', 'p19', 'p42', 'p52', 'p57'],
  science: ['p08', 'p20', 'p21', 'p35', 'p36', 'p37', 'p43', 'p44', 'p47', 'p48', 'p58', 'p59', 'p60'],
  tech: ['p26', 'p32', 'p38', 'p39', 'p40', 'p65', 'p66', 'p67', 'p68'],
  words: ['p12', 'p18', 'p22', 'p41', 'p49', 'p50', 'p51', 'p53', 'p54', 'p55'],
  history: ['p04', 'p05', 'p09', 'p17', 'p23', 'p24', 'p25', 'p27', 'p28', 'p29']
};

export const PACK_NAMES = Object.keys(PACKS);

export function promptsForPack(pack) {
  if (!pack || pack === 'all') return PROMPTS;
  const ids = PACKS[pack];
  if (!ids) return PROMPTS;
  const wanted = new Set(ids);
  return PROMPTS.filter((prompt) => wanted.has(prompt.id));
}

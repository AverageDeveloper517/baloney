// Trivia bank. Every question has exactly one correct option and a fact for
// the reveal. Answers are spread evenly across the four option slots.
// Add entries freely; ids must stay unique.

export const TRIVIA = [
  {
    id: 't01',
    category: 'science',
    q: 'Which planet has the most moons?',
    options: ['Saturn', 'Jupiter', 'Neptune', 'Mars'],
    answer: 0,
    fact: 'Saturn overtook Jupiter in 2023 after a wave of small moon discoveries.'
  },
  {
    id: 't02',
    category: 'science',
    q: 'Which gas makes up most of the air we breathe?',
    options: ['Oxygen', 'Argon', 'Nitrogen', 'Carbon dioxide'],
    answer: 2,
    fact: 'Nitrogen makes up about 78 percent of the air, with oxygen a distant second at 21 percent.'
  },
  {
    id: 't03',
    category: 'science',
    q: 'Which metal is liquid at room temperature?',
    options: ['Gallium', 'Mercury', 'Lead', 'Tin'],
    answer: 1,
    fact: 'Mercury stays liquid down to minus 39 Celsius, which is why it filled old thermometers.'
  },
  {
    id: 't04',
    category: 'science',
    q: 'How many bones are there in the adult human body?',
    options: ['186', '226', '246', '206'],
    answer: 3,
    fact: 'Babies are born with around 270 bones, and many fuse together as they grow.'
  },
  {
    id: 't05',
    category: 'science',
    q: 'What is the hardest naturally occurring substance?',
    options: ['Quartz', 'Steel', 'Obsidian', 'Diamond'],
    answer: 3,
    fact: 'Diamond scores a perfect 10 on the Mohs scale, though a sharp blow can still shatter it.'
  },
  {
    id: 't06',
    category: 'science',
    q: 'Which blood type is called the universal donor?',
    options: ['AB positive', 'O negative', 'A positive', 'B negative'],
    answer: 1,
    fact: 'O negative red cells lack the antigens that trigger most immune reactions, so they suit emergencies.'
  },
  {
    id: 't07',
    category: 'history',
    q: 'In which year did the Berlin Wall fall?',
    options: ['1991', '1987', '1989', '1985'],
    answer: 2,
    fact: 'The wall opened on the night of 9 November 1989 after weeks of protests and a confused press conference.'
  },
  {
    id: 't08',
    category: 'history',
    q: 'Who was the first person to walk on the Moon?',
    options: ['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins'],
    answer: 0,
    fact: 'Armstrong stepped onto the lunar surface on 20 July 1969, with Aldrin following about 19 minutes later.'
  },
  {
    id: 't09',
    category: 'history',
    q: 'The Great Fire of London began in which year?',
    options: ['1605', '1707', '1666', '1642'],
    answer: 2,
    fact: 'The fire started in a bakery on Pudding Lane and burned for four days.'
  },
  {
    id: 't10',
    category: 'history',
    q: 'Which ancient wonder stood in the harbour of Alexandria?',
    options: ['The Lighthouse of Alexandria', 'The Colossus of Rhodes', 'The Hanging Gardens', 'The Temple of Artemis'],
    answer: 0,
    fact: 'The Pharos guided ships for centuries before a series of earthquakes toppled it.'
  },
  {
    id: 't11',
    category: 'history',
    q: 'Which empire ruled Constantinople after 1453?',
    options: ['Byzantine Empire', 'Roman Empire', 'Persian Empire', 'Ottoman Empire'],
    answer: 3,
    fact: 'Mehmed II captured the city in 1453 and made it the capital of the Ottoman Empire.'
  },
  {
    id: 't12',
    category: 'history',
    q: 'What did the suffragette movement mainly campaign for?',
    options: ['Free school meals', 'Votes for women', 'An eight-hour workday', 'Abolition of the monarchy'],
    answer: 1,
    fact: 'The label suffragette was coined by a British newspaper as a dismissive term before activists reclaimed it.'
  },
  {
    id: 't13',
    category: 'geography',
    q: 'Which country spans the most time zones?',
    options: ['Russia', 'France', 'United States', 'China'],
    answer: 1,
    fact: 'Counting its overseas territories, France covers 12 time zones, more than any other nation.'
  },
  {
    id: 't14',
    category: 'geography',
    q: 'What is the capital of Australia?',
    options: ['Sydney', 'Melbourne', 'Perth', 'Canberra'],
    answer: 3,
    fact: 'Canberra was purpose-built as a compromise between rival cities Sydney and Melbourne.'
  },
  {
    id: 't15',
    category: 'geography',
    q: 'Which is the largest hot desert in the world?',
    options: ['Sahara', 'Gobi', 'Kalahari', 'Arabian'],
    answer: 0,
    fact: 'The Sahara covers roughly the same area as the United States.'
  },
  {
    id: 't16',
    category: 'geography',
    q: 'Mount Everest lies on the border of Nepal and which country?',
    options: ['India', 'Bhutan', 'China', 'Pakistan'],
    answer: 2,
    fact: 'The summit straddles the Nepal-China border, and climbers approach it from both sides.'
  },
  {
    id: 't17',
    category: 'geography',
    q: 'Which country has the longest coastline?',
    options: ['Canada', 'Russia', 'Australia', 'Indonesia'],
    answer: 0,
    fact: 'Canada has more than 200,000 kilometres of coastline, largely because of its many islands.'
  },
  {
    id: 't18',
    category: 'geography',
    q: 'In which country is the ancient city of Petra?',
    options: ['Egypt', 'Turkey', 'Jordan', 'Greece'],
    answer: 2,
    fact: 'Petra was carved into rose-coloured sandstone by the Nabataeans over 2,000 years ago.'
  },
  {
    id: 't19',
    category: 'tech',
    q: 'What do the letters "www" stand for in a web address?',
    options: ['Wide Web World', 'World Wide Web', 'Web World Wide', 'World Web Wide'],
    answer: 1,
    fact: 'Tim Berners-Lee proposed the World Wide Web at CERN in 1989.'
  },
  {
    id: 't20',
    category: 'tech',
    q: 'Which company built Android before Google bought it?',
    options: ['Nokia', 'Sun Microsystems', 'Palm', 'Android Inc.'],
    answer: 3,
    fact: 'Google acquired Android Inc. in 2005, three years before the first Android phone went on sale.'
  },
  {
    id: 't21',
    category: 'tech',
    q: 'In computing, what does "CPU" stand for?',
    options: ['Computer Power Unit', 'Central Program Utility', 'Core Processing Utility', 'Central Processing Unit'],
    answer: 3,
    fact: 'The CPU fetches, decodes and executes the instructions that run every program.'
  },
  {
    id: 't22',
    category: 'tech',
    q: 'In which year was the first iPhone released?',
    options: ['2005', '2007', '2009', '2010'],
    answer: 1,
    fact: 'The first iPhone went on sale in June 2007 and only gained an app store the following year.'
  },
  {
    id: 't23',
    category: 'tech',
    q: 'What does "HTTP" stand for?',
    options: ['High Transfer Text Protocol', 'Hyperlink Text Transport Process', 'HyperText Transfer Protocol', 'Host Transfer Protocol'],
    answer: 2,
    fact: 'The S in HTTPS stands for secure, meaning the traffic between browser and site is encrypted.'
  },
  {
    id: 't24',
    category: 'movies',
    q: 'Which classic film is set in Morocco during the Second World War?',
    options: ['Casablanca', 'Gone with the Wind', 'The Maltese Falcon', 'Citizen Kane'],
    answer: 0,
    fact: 'Casablanca won the Oscar for Best Picture and remains a favourite source of movie quotes.'
  },
  {
    id: 't25',
    category: 'movies',
    q: 'Who directed Jurassic Park?',
    options: ['James Cameron', 'Ridley Scott', 'Steven Spielberg', 'George Lucas'],
    answer: 2,
    fact: 'Jurassic Park was released in 1993 and won three Academy Awards for its visual effects and sound.'
  },
  {
    id: 't26',
    category: 'movies',
    q: 'What is the name of Dorothy\'s dog in The Wizard of Oz?',
    options: ['Toto', 'Rex', 'Buddy', 'Lassie'],
    answer: 0,
    fact: 'The role of Toto was played by a Cairn terrier whose real name was Terry.'
  },
  {
    id: 't27',
    category: 'movies',
    q: 'Which animated film features a lion cub called Simba?',
    options: ['Aladdin', 'Tarzan', 'Madagascar', 'The Lion King'],
    answer: 3,
    fact: 'The Lion King was released in 1994 and borrows its plot from Shakespeare\'s Hamlet.'
  },
  {
    id: 't28',
    category: 'movies',
    q: 'Which film series is set in the fictional nation of Wakanda?',
    options: ['Wonder Woman', 'Black Panther', 'Avatar', 'The Hunger Games'],
    answer: 1,
    fact: 'Wakanda is shown as the most technologically advanced nation on Earth, hidden from the world.'
  },
  {
    id: 't29',
    category: 'music',
    q: 'Which instrument has 88 keys?',
    options: ['Organ', 'Piano', 'Harpsichord', 'Accordion'],
    answer: 1,
    fact: 'A standard piano has 52 white keys and 36 black keys, which add up to 88.'
  },
  {
    id: 't30',
    category: 'music',
    q: 'Which band released the album Abbey Road?',
    options: ['The Rolling Stones', 'Pink Floyd', 'The Who', 'The Beatles'],
    answer: 3,
    fact: 'The cover photo was taken outside EMI\'s studios on Abbey Road in London.'
  },
  {
    id: 't31',
    category: 'music',
    q: 'How many strings does a standard violin have?',
    options: ['Four', 'Five', 'Six', 'Three'],
    answer: 0,
    fact: 'The strings are tuned in fifths: G, D, A and E.'
  },
  {
    id: 't32',
    category: 'music',
    q: 'Which composer wrote The Four Seasons?',
    options: ['Mozart', 'Beethoven', 'Vivaldi', 'Bach'],
    answer: 2,
    fact: 'Vivaldi wrote the four violin concertos around 1723, each paired with a sonnet.'
  },
  {
    id: 't33',
    category: 'music',
    q: 'What is the highest standard female voice type?',
    options: ['Soprano', 'Alto', 'Tenor', 'Contralto'],
    answer: 0,
    fact: 'A coloratura soprano can reach the highest notes, often well above the treble staff.'
  },
  {
    id: 't34',
    category: 'food',
    q: 'Which spice is harvested from the crocus flower?',
    options: ['Turmeric', 'Paprika', 'Saffron', 'Cumin'],
    answer: 2,
    fact: 'Saffron is the world\'s most expensive spice because each crocus yields only a few threads.'
  },
  {
    id: 't35',
    category: 'food',
    q: 'What is the main ingredient in guacamole?',
    options: ['Tomato', 'Avocado', 'Cucumber', 'Pea'],
    answer: 1,
    fact: 'The name guacamole comes from an Aztec word meaning avocado sauce.'
  },
  {
    id: 't36',
    category: 'food',
    q: 'What makes traditional sourdough bread taste sour?',
    options: ['Baking soda', 'Vinegar', 'Sugar', 'Lactic acid bacteria'],
    answer: 3,
    fact: 'Wild yeasts raise the dough while bacteria produce the acids behind the tang.'
  },
  {
    id: 't37',
    category: 'food',
    q: 'Which country produces the most coffee?',
    options: ['Colombia', 'Vietnam', 'Ethiopia', 'Brazil'],
    answer: 3,
    fact: 'Brazil has led the world in coffee production for more than 150 years.'
  },
  {
    id: 't38',
    category: 'food',
    q: 'Which herb is the main flavour in traditional pesto?',
    options: ['Parsley', 'Basil', 'Mint', 'Oregano'],
    answer: 1,
    fact: 'Classic pesto also contains pine nuts, garlic, parmesan and olive oil.'
  },
  {
    id: 't39',
    category: 'animals',
    q: 'What is the largest animal known to have lived?',
    options: ['African elephant', 'Whale shark', 'Blue whale', 'Colossal squid'],
    answer: 2,
    fact: 'A blue whale\'s heart can weigh as much as 180 kilograms.'
  },
  {
    id: 't40',
    category: 'animals',
    q: 'Which animal has fingerprints almost identical to ours?',
    options: ['Koala', 'Chimpanzee', 'Gorilla', 'Raccoon'],
    answer: 0,
    fact: 'Koala prints are so similar to human ones that they can confuse crime scene investigators.'
  },
  {
    id: 't41',
    category: 'animals',
    q: 'How many hearts does an octopus have?',
    options: ['One', 'Two', 'Three', 'Four'],
    answer: 2,
    fact: 'Two hearts pump blood to the gills and a third serves the rest of the body.'
  },
  {
    id: 't42',
    category: 'animals',
    q: 'Which mammal lays eggs?',
    options: ['Platypus', 'Armadillo', 'Pangolin', 'Sloth'],
    answer: 0,
    fact: 'The platypus is one of only five egg-laying mammals, all of them monotremes.'
  },
  {
    id: 't43',
    category: 'animals',
    q: 'What is a group of crows called?',
    options: ['A gaggle', 'A parliament', 'A colony', 'A murder'],
    answer: 3,
    fact: 'The collective noun murder for crows dates back to medieval hunting terms.'
  },
  {
    id: 't44',
    category: 'sports',
    q: 'How many players from each side start a football match?',
    options: ['10', '11', '12', '9'],
    answer: 1,
    fact: 'A team needs at least seven players on the pitch for a match to continue.'
  },
  {
    id: 't45',
    category: 'sports',
    q: 'In tennis, what is a score of zero called?',
    options: ['Nil', 'Love', 'Duck', 'Blank'],
    answer: 1,
    fact: 'The origin of love is uncertain, though one theory links it to the French word for egg.'
  },
  {
    id: 't46',
    category: 'sports',
    q: 'How often are the Summer Olympics normally held?',
    options: ['Every two years', 'Every three years', 'Every five years', 'Every four years'],
    answer: 3,
    fact: 'The modern Games began in 1896, and only the world wars have broken the four-year cycle.'
  },
  {
    id: 't47',
    category: 'sports',
    q: 'Which sport is played with a shuttlecock?',
    options: ['Badminton', 'Squash', 'Tennis', 'Table tennis'],
    answer: 0,
    fact: 'A shuttlecock can leave a racket faster than 490 km/h, the quickest projectile in any sport.'
  },
  {
    id: 't48',
    category: 'sports',
    q: 'How many rings appear on the Olympic flag?',
    options: ['Four', 'Six', 'Five', 'Three'],
    answer: 2,
    fact: 'The five rings stand for the inhabited continents and use colours found in national flags.'
  },
  {
    id: 't49',
    category: 'words',
    q: 'What do we call a word that reads the same both ways?',
    options: ['Palindrome', 'Anagram', 'Acronym', 'Homophone'],
    answer: 0,
    fact: 'Racecar and level are palindromes, and so is the number 2002.'
  },
  {
    id: 't50',
    category: 'words',
    q: 'What does the prefix "bio-" mean?',
    options: ['Book', 'Life', 'Two', 'Earth'],
    answer: 1,
    fact: 'Bio comes from Greek and appears in biology, biography and biodiversity.'
  },
  {
    id: 't51',
    category: 'words',
    q: 'Which language gave English the word kindergarten?',
    options: ['Dutch', 'French', 'German', 'Swedish'],
    answer: 2,
    fact: 'Kindergarten literally means children\'s garden in German.'
  },
  {
    id: 't52',
    category: 'words',
    q: 'What is a word that sounds like another but is spelled differently?',
    options: ['Synonym', 'Antonym', 'Homonym', 'Homophone'],
    answer: 3,
    fact: 'Sea and see are homophones, while homonyms share both sound and spelling.'
  },
  {
    id: 't53',
    category: 'words',
    q: 'What is a word formed from the first letters of other words?',
    options: ['Synonym', 'Metaphor', 'Acronym', 'Prefix'],
    answer: 2,
    fact: 'NASA began as an acronym, and so did scuba before it became an ordinary word.'
  },
  {
    id: 't54',
    category: 'words',
    q: 'What does the word polyglot mean?',
    options: ['Someone who fears heights', 'A person who collects maps', 'A lover of books', 'Someone who speaks many languages'],
    answer: 3,
    fact: 'Poly means many and glot means tongue, so a polyglot is literally many-tongued.'
  },
  {
    id: 't55',
    category: 'emoji',
    q: '🦖 🦕 🚙 🏝',
    options: ['Jurassic Park', 'Godzilla', 'The Land Before Time', 'King Kong'],
    answer: 0,
    fact: 'Jurassic Park brought dinosaurs to life with groundbreaking computer animation in 1993.'
  },
  {
    id: 't56',
    category: 'emoji',
    q: '👻 🚫 🏙 🚐',
    options: ['Casper', 'Ghostbusters', 'The Exorcist', 'Poltergeist'],
    answer: 1,
    fact: 'Ghostbusters mixed comedy and supernatural scares and spawned a hit theme song.'
  },
  {
    id: 't57',
    category: 'emoji',
    q: '🐖 🕷 🕸 🚜',
    options: ['Babe', 'Animal Farm', 'The Tale of Peter Rabbit', 'Charlotte\'s Web'],
    answer: 3,
    fact: 'Charlotte\'s Web, by E. B. White, tells of a pig saved by a clever spider.'
  },
  {
    id: 't58',
    category: 'emoji',
    q: '🥀 🏰 🕯 🫖',
    options: ['Cinderella', 'Sleeping Beauty', 'Beauty and the Beast', 'Snow White'],
    answer: 2,
    fact: 'Beauty and the Beast was the first animated film nominated for the Best Picture Oscar.'
  },
  {
    id: 't59',
    category: 'emoji',
    q: '⚡ 🧹 🏰 🦉',
    options: ['The Worst Witch', 'Harry Potter', 'Percy Jackson', 'The Chronicles of Narnia'],
    answer: 1,
    fact: 'Harry Potter and the Philosopher\'s Stone appeared in 1997 under two different titles.'
  },
  {
    id: 't60',
    category: 'emoji',
    q: '🐻 🍯 🌳 🎈',
    options: ['Winnie the Pooh', 'Paddington', 'The Jungle Book', 'Brother Bear'],
    answer: 0,
    fact: 'Winnie the Pooh was inspired by a real black bear that lived at London Zoo.'
  }
];

export const TRIVIA_COUNT = TRIVIA.length;

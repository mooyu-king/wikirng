'use strict';

const badgeLabels = {
  ocean: 'Ocean life',
  species: 'Living lineage',
  deepTime: 'Deep roots',
  adaptation: 'Unusual adaptation',
  specificPlace: 'Mapped location',
  geology: 'Geological feature',
  light: 'Light phenomenon',
  motion: 'Natural motion',
  instrument: 'Working instrument',
  ancient: 'Ancient artifact',
  unresolved: 'Open question',
  records: 'Record keeping',
  space: 'Extraterrestrial origin',
  acoustics: 'Sound and spaces'
};

const quizQuestions = [
  { prompt: 'What makes an Aeolian harp play?', choices: ['Rain', 'Wind', 'Sunlight'], correct: 1 },
  { prompt: 'What does a sundial use to mark the time?', choices: ['A shadow', 'A magnet', 'An echo'], correct: 0 },
  { prompt: 'Which animal is a close relative of the okapi?', choices: ['Zebra', 'Moose', 'Giraffe'], correct: 2 },
  { prompt: 'What is the Hoba meteorite mainly made of?', choices: ['Copper', 'Iron', 'Sandstone'], correct: 1 },
  { prompt: 'What does a Foucault pendulum help demonstrate?', choices: ['Earth’s rotation', 'The ocean tides', 'The shape of clouds'], correct: 0 }
];

const articles = [
  { slug: 'Nautilus', title: 'Nautilus', topic: 'Life', summary: 'A marine mollusk with a chambered shell. As it grows, it adds new chambers and uses the older ones to control its buoyancy.', badges: ['ocean', 'species', 'deepTime'] },
  { slug: 'Okapi', title: 'Okapi', topic: 'Life', summary: 'The striped forest animal that looks a little like a zebra is actually a close living relative of the giraffe.', badges: ['species', 'specificPlace'] },
  { slug: 'Pando_(tree)', title: 'Pando', topic: 'Life', summary: 'In Utah, thousands of quaking aspen stems grow from a shared root system, collectively forming one genetic individual.', badges: ['species', 'specificPlace', 'adaptation'] },
  { slug: 'Mantis_shrimp', title: 'Mantis shrimp', topic: 'Life', summary: 'These marine crustaceans strike with specialized limbs that can move fast enough to create cavitation bubbles in the water.', badges: ['ocean', 'species', 'adaptation'] },
  { slug: 'Tardigrade', title: 'Tardigrade', topic: 'Life', summary: 'Some of these microscopic animals survive severe drying by shrinking into a dormant form and resuming activity when rehydrated.', badges: ['species', 'adaptation'] },
  { slug: 'Bioluminescence', title: 'Bioluminescence', topic: 'Life', summary: 'Some organisms make light through chemical reactions. In the ocean this ability can help with disguise, communication or finding prey.', badges: ['ocean', 'light', 'adaptation'] },
  { slug: 'Ginkgo_biloba', title: 'Ginkgo biloba', topic: 'Life', summary: 'This fan-leaved tree is the only living species of a group of seed plants with an extensive fossil history.', badges: ['species', 'deepTime'] },
  { slug: 'Socotra', title: 'Socotra', topic: 'Earth', summary: 'This island in the Arabian Sea is home to many species found nowhere else, including the dragon’s blood tree.', badges: ['specificPlace', 'species'] },
  { slug: 'Catatumbo_lightning', title: 'Catatumbo lightning', topic: 'Earth', summary: 'Where the Catatumbo River reaches Lake Maracaibo, atmospheric conditions produce frequent thunderstorms and lightning.', badges: ['specificPlace', 'light', 'motion'] },
  { slug: 'Salar_de_Uyuni', title: 'Salar de Uyuni', topic: 'Earth', summary: 'A salt flat in Bolivia spreads across a high plateau. After rain, a thin layer of water can turn its surface into a vast mirror.', badges: ['specificPlace', 'geology'] },
  { slug: 'Giant%27s_Causeway', title: 'Giant’s Causeway', topic: 'Earth', summary: 'At the coast of Northern Ireland, ancient lava cooled and contracted into thousands of interlocking basalt columns.', badges: ['specificPlace', 'geology', 'deepTime'] },
  { slug: 'Fingal%27s_Cave', title: 'Fingal’s Cave', topic: 'Earth', summary: 'This sea cave on the Scottish island of Staffa is lined with basalt columns. Its shape and waves give it distinctive acoustics.', badges: ['specificPlace', 'geology', 'acoustics'] },
  { slug: 'Hoba_meteorite', title: 'Hoba meteorite', topic: 'Earth', summary: 'A massive iron meteorite in Namibia remains at the site where it was discovered. Its great weight helped keep it there.', badges: ['specificPlace', 'geology', 'space'] },
  { slug: 'Antikythera_mechanism', title: 'Antikythera mechanism', topic: 'Inventions', summary: 'Recovered from a shipwreck, this ancient Greek device used gears to model astronomical cycles and predict events such as eclipses.', badges: ['instrument', 'ancient'] },
  { slug: 'Aeolian_harp', title: 'Aeolian harp', topic: 'Inventions', summary: 'Wind, rather than a musician, sets this instrument’s strings vibrating. Different air speeds can bring out different tones.', badges: ['instrument', 'motion', 'acoustics'] },
  { slug: 'Sundial', title: 'Sundial', topic: 'Inventions', summary: 'A sundial uses the changing position of a shadow to mark local solar time.', badges: ['instrument', 'light'] },
  { slug: 'Foucault_pendulum', title: 'Foucault pendulum', topic: 'Inventions', summary: 'Watch a long swinging pendulum for hours and its swing appears to turn relative to the room, revealing the rotation of Earth.', badges: ['instrument', 'motion'] },
  { slug: 'Baghdad_Battery', title: 'Baghdad Battery', topic: 'Inventions', summary: 'A ceramic vessel and metal components led to speculation about an ancient battery. Its original purpose remains disputed.', badges: ['ancient', 'unresolved'] },
  { slug: 'Voynich_manuscript', title: 'Voynich manuscript', topic: 'Artifacts', summary: 'This illustrated medieval manuscript contains unfamiliar writing that has resisted a generally accepted decipherment.', badges: ['records', 'unresolved'] },
  { slug: 'Quipu', title: 'Quipu', topic: 'Artifacts', summary: 'Andean societies used these arrangements of cords and knots to record information, including numerical records.', badges: ['records'] },
  { slug: 'Lycurgus_Cup', title: 'Lycurgus Cup', topic: 'Artifacts', summary: 'This Roman glass vessel appears green in reflected light and red when light passes through it.', badges: ['ancient', 'light'] },
  { slug: 'Rongorongo', title: 'Rongorongo', topic: 'Artifacts', summary: 'These carved glyphs from Rapa Nui appear on surviving wooden objects. Their meaning remains unsettled.', badges: ['records', 'specificPlace', 'unresolved'] },
  { slug: 'Phaistos_Disc', title: 'Phaistos Disc', topic: 'Artifacts', summary: 'Symbols are stamped in a spiral on this fired clay disc from Crete. Many interpretations have been proposed for its undeciphered signs.', badges: ['ancient', 'records', 'unresolved'] }
];

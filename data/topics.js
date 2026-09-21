/* ==========================================================================
   daily-learn — sample content (M1)

   Thirteen topics, one or two per category, written to the shape every
   real topic will take. Loaded as a classic script rather than JSON so the
   app opens from the filesystem with no server and no build step.

   Field notes
     summary        ~120 words, self-contained, no reference to other topics
     points         three things worth carrying away
     caveat         how the idea is commonly misstated — required, not optional
     source         one high-quality article; checked to resolve when written
     related        topic ids, not free text
   ========================================================================== */

window.DL_CATEGORIES = [
  { id: "psychology",  label: "Psychology & Behaviour" },
  { id: "history",     label: "History" },
  { id: "physics",     label: "Physics & Space" },
  { id: "biology",     label: "Biology & the Mind" },
  { id: "economics",   label: "Economics & Society" },
  { id: "philosophy",  label: "Philosophy & Ethics" },
  { id: "engineering", label: "How Things Work" },
  { id: "ideas",       label: "Ideas, Principles & Paradoxes" }
];

window.DL_TOPICS = [
  {
    id: "dunning-kruger",
    title: "The Dunning–Kruger effect",
    category: "psychology",
    summary: "Incompetence hides itself. The people least able to do a task are often least able to see that they are doing it badly, and the skilled tend to assume what is hard for them is hard for everyone. David Dunning and Justin Kruger put numbers to that folk observation in 1999, prompted by McArthur Wheeler, a robber who rubbed lemon juice on his face and held up banks in daylight believing it made him invisible. In their studies, students who scored in the bottom quarter of a logic or grammar test placed themselves well above average; those in the top quarter placed themselves modestly below. Judging a skill and exercising it draw on the same competence.",
    points: [
      "Described in 1999 across four studies on humour, grammar and logical reasoning.",
      "The weakest group was not merely vain — it was the least able to recognise a good answer when shown one.",
      "Given brief training in the same task, the lowest scorers first rated themselves worse, then better: seeing the standard precedes judging yourself by it."
    ],
    caveat: "Usually repeated as \"stupid people are confident, clever people are insecure\", which is not the finding. Much of the measured pattern follows from arithmetic — a low score cannot be a high self-rating, and noise around a rating drags the weak upward and the strong downward. The durable part is narrower: in an unfamiliar domain you lack the knowledge that would tell you what good looks like.",
    source: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect" },
    related: ["confirmation-bias", "occams-razor"]
  },
  {
    id: "confirmation-bias",
    title: "Confirmation bias",
    category: "psychology",
    summary: "We gather evidence badly, and not from dishonesty. Testing a belief feels like looking for the cases that fit it. In Peter Wason's rule-discovery task, people shown the sequence 2, 4, 6 and asked to find the rule overwhelmingly guessed \"up by two\", then confirmed it by offering 8, 10, 12 — almost nobody tried 1, 5, 9, which would have refuted the guess and revealed the actual rule: any ascending sequence. The same asymmetry runs through diagnosis, hiring, investing and argument. A supporting instance costs nothing to notice, while a contradicting one can be explained away indefinitely. Beliefs are defended less by evidence than by habits of attention.",
    points: [
      "Wason's 1960 task is the cleanest demonstration: people seek confirmation, not falsification.",
      "It bites hardest where being wrong is expensive — medicine, law, intelligence analysis.",
      "Searching for disconfirming evidence is a trained skill, not a temperament, and teaching it measurably reduces the bias."
    ],
    caveat: "Described as a failing of the stubborn or the credulous. It is not: it operates strongly on experts who are motivated, because they know precisely which readings of the evidence will spare them from changing their minds. Believing that you alone are merely looking at the facts is the bias speaking.",
    source: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Confirmation_bias" },
    related: ["dunning-kruger", "memory-consolidation"]
  },
  {
    id: "memory-consolidation",
    title: "How memories are made",
    category: "biology",
    summary: "Memories are not filed away; they are rebuilt. When you learn something, the trace is fragile and held mainly by the hippocampus, which indexes a pattern spread across the cortex. Over hours, days and years that index is replayed — intensively during slow-wave sleep — and the connections between cortical regions strengthen until the memory can stand without the hippocampus at all. Each time you recall, the trace briefly becomes labile again and must be stored once more, a step called reconsolidation. A remembered event is therefore not a recording of the original but the latest of many re-writings, and every act of recall is a small act of editing.",
    points: [
      "Systems consolidation moves a trace from hippocampus-dependent to cortical, sometimes over years.",
      "Sleep is not idle time in this process: replay compresses the day into the connections that hold it.",
      "Because recall destabilises a memory, details can be added to it afterwards without your noticing."
    ],
    caveat: "Two errors are common. First, that the brain has a permanent store — consolidation is gradual, which is why an amnesic patient may hold childhood intact and lose last Tuesday. Second, that confidence tracks accuracy. It does not: a reconstructed memory can feel exactly as vivid as a faithful one.",
    source: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Memory_consolidation" },
    related: ["ship-of-theseus", "confirmation-bias"]
  },
  {
    id: "turkish-war",
    title: "The Turkish War of Independence",
    category: "history",
    summary: "The Ottoman Empire lost the First World War and was dismantled on paper. Greece occupied Smyrna in May 1919, Italy and France took slices, and the Treaty of Sèvres in 1920 left a truncated Turkish state. Mustafa Kemal, an Ottoman general made famous at Gallipoli, refused the settlement, landed at Samsun and built a rival parliament in Ankara. Two years of war followed on several fronts — Armenian, French, Greek, and against the British at Constantinople — ending with the Greek army defeated and Smyrna in flames in September 1922. Sèvres was replaced by Lausanne, and in October 1923 Turkey became a republic.",
    points: [
      "The only state to reverse a First World War peace settlement by fighting it.",
      "Conducted as several separate wars with separate settlements, not one continuous campaign.",
      "The sultanate was abolished in November 1922, before the republic was declared, ending six centuries of Ottoman rule."
    ],
    caveat: "National histories on both sides flatten this. The burn of Smyrna, the 1923 population exchange, and the fate of the Empire's Armenians and Assyrians belong to the same events and remain contested. Kurdish autonomy promised in the 1921 Ankara constitution was removed once the republic existed.",
    source: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Turkish_War_of_Independence" },
    related: ["fall-of-constantinople"]
  },
  {
    id: "fall-of-constantinople",
    title: "The fall of Constantinople",
    category: "history",
    summary: "On 29 May 1453, after a 53-day siege, Ottoman forces took Constantinople and the last remnant of the Roman Empire ended — a state a thousand years older than the name suggests. Mehmed II was twenty-one. The city's survival had rested on the Theodosian Walls, the strongest fortifications in Europe, and on a chain across the Golden Horn. Mehmed answered both: enormous bombards battered the walls over weeks, and his ships were dragged overland on greased logs past the chain to appear inside the harbour. Constantine XI died in the final assault. The city became the Ottoman capital, and its loss fixed in Western Europe the idea that the East could close.",
    points: [
      "The siege ran from 6 April to 29 May 1453.",
      "Gunpowder made the medieval wall obsolete within living memory of its building.",
      "Defender and attacker numbers in the chronicles are estimates, and they disagree."
    ],
    caveat: "Two overstatements persist. The city was already a shrinking remnant, holding perhaps 50,000 people, so the fall mattered more as symbol than as demography. And the flight of Greek scholars to Italy did not start the Renaissance, which was underway; the siege sharpened a current rather than creating one.",
    source: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Fall_of_Constantinople" },
    related: ["turkish-war"]
  },
  {
    id: "sky-is-blue",
    title: "Why the sky is blue",
    category: "physics",
    summary: "Sunlight is roughly white, a mixture of wavelengths. Air is made of molecules far smaller than visible light, and such particles scatter short wavelengths far more strongly than long ones. Rayleigh scattering falls off as the fourth power of wavelength, so blue light around 450 nanometres is scattered several times as much as red and reaches your eye from every direction rather than only from the sun's disc. The dome above you is that scattered light. Sunsets run the other way: near the horizon, light crosses much more atmosphere, the blue is scattered out of your line of sight entirely, and what remains is the orange end.",
    points: [
      "Scattering scales as 1/λ⁴, which is why blue wins decisively rather than slightly.",
      "The sky is not violet although violet scatters more: the sun emits less of it, eyes are less sensitive to it, and the upper atmosphere absorbs some.",
      "On Mars dust reverses the effect — a butterscotch day, and a blue glow around the setting sun."
    ],
    caveat: "\"Nitrogen and oxygen are blue\" is wrong; both are colourless and the effect is purely about particle size relative to wavelength. Nor does the sea's colour explain the sky's, a common answer — the sea looks blue mostly because it reflects the sky. Larger particles scatter all wavelengths equally, which is why clouds and haze are white.",
    source: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Rayleigh_scattering" },
    related: ["solar-system-formation"]
  },
  {
    id: "solar-system-formation",
    title: "How the Solar System formed",
    category: "physics",
    summary: "About 4.6 billion years ago a fragment of a molecular cloud — made from the debris of earlier generations of stars — began to collapse, plausibly triggered by the shockwave of a nearby supernova. As it fell, conservation of angular momentum spun it into a flat disc with nearly everything falling to the centre. That centre became the Sun. In the disc, dust grains stuck into pebbles, pebbles into kilometre-scale planetesimals, planetesimals into planets. Close to the young Sun volatiles boiled away and only metal and rock survived, making small dense worlds; beyond the frost line ice was available, so cores grew large enough to capture hydrogen and become gas giants.",
    points: [
      "The Sun holds about 99.8% of the system's mass; the planets are the leftovers.",
      "Lead-isotope dating of the oldest meteorites gives 4.56–4.57 billion years, more precisely than any rock on Earth.",
      "A Mars-sized body striking the young Earth is the leading account of the Moon."
    ],
    caveat: "The nebular hypothesis is strong on the general shape and weak on the details, and the solar nebula is reconstructed from a system we cannot rewatch forming. Exoplanets have since shown that hot Jupiters, super-Earths and tightly packed resonant chains are common, so planetary migration is the norm rather than the exception.",
    source: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Formation_and_evolution_of_the_Solar_System" },
    related: ["sky-is-blue", "butterfly-effect"]
  },
  {
    id: "occams-razor",
    title: "Occam's razor",
    category: "philosophy",
    summary: "Other things being equal, prefer the explanation that assumes less. The principle is credited to William of Ockham, a fourteenth-century Franciscan, though the familiar Latin formulation is centuries later and not his. It is not a law about how the world is but a rule about how we should reason between rivals: every extra entity in a theory buys explanatory power it has not yet paid for, so each one needs justifying. It cuts both ways — a hypothesis stripped of every auxiliary assumption can be too simple to fit the facts. It earns its keep where the machinery becomes expensive, as it did for phrenology, vitalism and the luminiferous aether.",
    points: [
      "Parsimony is one virtue among several, traded against fit, scope and fruitfulness.",
      "\"Entities must not be multiplied beyond necessity\" summarises Ockham; he did not write it.",
      "Bayesian inference formalises the intuition: a sharp hypothesis that predicts correctly beats a broad one that predicts anything."
    ],
    caveat: "Wielded as proof that the simpler account is true, which it is not. Copernicus kept circles and needed epicycles to fit the data; general relativity is not simpler than Newton; Darwin's theory is not simpler than design. Restraint in assumption is a discipline, not a shortcut to an answer.",
    source: { label: "Stanford Encyclopedia of Philosophy", url: "https://plato.stanford.edu/entries/simplicity/" },
    related: ["ship-of-theseus", "dunning-kruger"]
  },
  {
    id: "ship-of-theseus",
    title: "The ship of Theseus",
    category: "philosophy",
    summary: "Plutarch's puzzle: Athens kept the ship on which Theseus returned from Crete, replacing each decayed plank in turn until none of the original timber remained. Was it still the same ship? Hobbes added the twist — suppose someone gathered the discarded planks and rebuilt the original. Now there are two candidates, and continuity of matter and continuity of form point in different directions. The puzzle was never about ships. It recurs for anything whose parts are replaced while it persists: a resurfaced road, a company with none of its founding staff, an organism whose atoms turn over, a person. Answers generally land on degree, on usefulness, or on the claim that the question is malformed.",
    points: [
      "Recorded by Plutarch, sharpened by Hobbes in the seventeenth century.",
      "Locke moved the puzzle from objects to persons, tying identity to consciousness rather than substance.",
      "The four-dimensionalist reply treats objects as extended in time, so \"same thing\" becomes \"same whole at a time\"."
    ],
    caveat: "Easy to dismiss as wordplay, and partly justified: the question has no answer independent of what you need \"same\" to do. But that pragmatic version has real work to do — the same continuity disputes run through constitutions after revolution, liability after corporate restructuring, and identity in debates about dementia and mind-uploading.",
    source: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Ship_of_Theseus" },
    related: ["memory-consolidation", "occams-razor"]
  },
  {
    id: "diamond-water-paradox",
    title: "The diamond–water paradox",
    category: "economics",
    summary: "Adam Smith noticed it and it took two centuries to dissolve: water is indispensable and cheap, diamonds are useless and dear. The resolution is marginal utility. Value is set not by what a thing does in total but by what the next unit is worth — and because water is plentiful, the hundredth litre means almost nothing, while the first diamond is a novelty. Smith's slip was valuing goods as classes instead of at the margin. The same move explains why air is free, and why oil prices jump not when supply falls short but when the expected next barrel does.",
    points: [
      "Called the paradox of value by Smith in 1776; resolved by Jevons, Menger and Walras in the 1870s.",
      "Total and marginal utility diverge most sharply exactly where supply is abundant.",
      "Prices carry information about the next unit, which is why expectations move them before scarcity does."
    ],
    caveat: "Diamonds were dear for most of the twentieth century because De Beers restricted supply, so the example is less natural than textbooks admit. And marginalism explains exchange value, not worth: it says nothing about whether a drowning person's water and a collector's diamond are commensurable, which is where welfare economics stays contested.",
    source: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Diamond%E2%80%93water_paradox" },
    related: ["tragedy-of-the-commons"]
  },
  {
    id: "tragedy-of-the-commons",
    title: "The tragedy of the commons",
    category: "economics",
    summary: "Garrett Hardin's 1968 parable: herders sharing a pasture each gain the whole benefit of adding an animal while the cost of overgrazing is spread among everyone, so rational additions ruin the field. The framing spread because it needs no malice — collapse follows from incentives alone, which is why it fits fisheries, groundwater, the atmosphere and comment sections. The actual history is more interesting. Elinor Ostrom studied real commons — Alpine villages, Japanese forests, Spanish irrigation ditches — and found communities sustaining them for centuries with clear boundaries, graduated sanctions and locally written rules.",
    points: [
      "The structure is a repeated prisoner's dilemma: private gain, shared cost.",
      "Ostrom's work on it won the 2009 economics Nobel, the first awarded to a woman.",
      "Commons fail where users cannot make and enforce rules — not because commons must fail."
    ],
    caveat: "Hardin's \"commons\" was in fact open access, nobody's property, whereas historical commons were rights held by a defined group. Enclosure has destroyed well-run commons as often as it saved them, and blaming herders has been used to justify displacing them. The incentive logic survives; its automatic application does not.",
    source: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Tragedy_of_the_commons" },
    related: ["diamond-water-paradox", "butterfly-effect"]
  },
  {
    id: "butterfly-effect",
    title: "The butterfly effect",
    category: "ideas",
    summary: "Edward Lorenz found it by rounding a number. In 1961, running a twelve-equation model of the atmosphere, he restarted a forecast midway and typed 0.506 instead of the 0.506127 the printout had rounded from. The new run tracked the old briefly, then departed entirely, ending in a different weather pattern. Deterministic equations with no randomness inside, and long-range prediction still fails — because nearby states separate exponentially rather than staying nearby. Lorenz called it sensitive dependence on initial conditions; the butterfly came from a 1972 talk title asking whether a flap in Brazil could set off a tornado in Texas.",
    points: [
      "The separation rate is measurable — the system's Lyapunov exponent.",
      "The attractor the motion wanders on is fractal, so it stays bounded yet never repeats.",
      "Forecasting copes by running ensembles from slightly varied starts and reporting probabilities, not predictions."
    ],
    caveat: "Pop culture draws the wrong lesson: that small causes have large effects, so anything may follow from anything. Chaos says the opposite in practice — perturbations grow at a rate the system sets, which makes this about the limits of knowledge rather than the power of small actions. Weather is chaotic in its details; the seasonal mean is far more predictable than next Thursday.",
    source: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Butterfly_effect" },
    related: ["solar-system-formation", "tragedy-of-the-commons"]
  },
  {
    id: "shipping-container",
    title: "The shipping container",
    category: "engineering",
    summary: "Malcolm McLean, a North Carolina trucking entrepreneur, refitted a tanker called the Ideal X to carry 58 containers in 1956 — not because the box was new, but because he had watched his own trucks idle for days while cargo was rehandled by hand. What mattered was standardisation: one size, one locking fitting, and cranes, chassis, trains and quay design built around it. Handling costs collapsed, and the longshore labour that had employed tens of thousands in Liverpool and Brooklyn thinned out almost within a decade. Cheap enough movement is what made it sensible to build a thing on the far side of the world.",
    points: [
      "A widely quoted US Navy estimate put 1970 loading costs at $5.86 a ton break-bulk against $0.16 containerised.",
      "The invention is the standard, not the box: ISO sizes in the late 1960s let cargo travel unopened.",
      "The social cost landed on one group at once, which is why port cities deindustrialised before factories moved."
    ],
    caveat: "Be careful with the numbers: that $5.86 to $0.16 comparison is a dockside loading estimate from one study, quoted everywhere as settled fact, and delivered cost fell by far less. The container also did not create globalisation on its own — falling tariffs, compatible ports and political will were required. It is best read as the enabling technology, not the cause.",
    source: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Containerization" },
    related: ["diamond-water-paradox", "butterfly-effect"]
  }
];

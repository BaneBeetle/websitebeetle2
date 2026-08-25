/* Single source of truth for everything the garage says.
   Every string here traces to the resume PDF, the existing site pages, or
   the spec Brian gave for the car. Nothing is invented: if a project has
   no written source it is not in this file. */

export const PERSON = {
  name: 'Brian Phan',
  fullName: 'Brian Minh Phan',
  line: 'I like building things.',
  email: 'phan.brian.minh@gmail.com',
  school: 'brian.phan@columbia.edu',
  github: 'https://github.com/BaneBeetle',
  githubHandle: 'BaneBeetle',
  linkedin: 'https://www.linkedin.com/in/banebeetle',
  youtube: 'https://www.youtube.com/@brianbeetle',
  resume: 'files/PhanBrianResume.pdf',
  site: 'banebeetle.com',
};

/* The car is real. These numbers come from Brian, verbatim. */
export const CAR = {
  name: 'Carbeetle',
  model: 'BMW M3 E46',
  paint: 'Interlagos Blue',
  provenance: 'Passed down from my father.',
  specs: [
    { k: 'Engine',   v: 'S54',                 note: 'Inline six.' },
    { k: 'Intake',   v: 'Karbonius CSL airbox', note: 'The CSL breathing setup.' },
    { k: 'Tune',     v: 'Evolve Alpha-N',       note: 'Alpha-N, no mass airflow sensor.' },
    { k: 'Dyno',     v: 'HTE dyno tune',        note: 'Tuned on the rollers, not by feel.' },
    { k: 'Result',   v: '317.27 hp',            note: 'What the dyno actually printed.' },
  ],
};

/* Engine-bay hotspots: the two things Brian built around this car. */
export const BAY_PROJECTS = [
  {
    id: 'carbeetle',
    title: 'The Carbeetle Project',
    kicker: 'Vehicle classification with automated garage access',
    date: 'Oct 2024',
    body: 'A YOLOv11 model on a Raspberry Pi watches a live camera feed, recognizes the family E46, and fires a relay to open the garage door on sight.',
    tags: ['YOLOv11', 'Raspberry Pi', 'Python', 'Roboflow'],
    href: 'https://www.github.com/BaneBeetle/carbeetle_project',
    hrefLabel: 'View on GitHub',
  },
  {
    id: 'door',
    title: 'The garage door itself',
    kicker: 'The opener this whole site is named after',
    date: 'Oct 2024',
    body: 'The classifier is only half of it. The other half is a relay wired into the roller door, so the car is the key. That is the door you just came through.',
    tags: ['Relay', 'Camera feed', 'Home automation'],
    href: 'https://www.github.com/BaneBeetle/carbeetle_project',
    hrefLabel: 'View on GitHub',
  },
];

/* Workbench: software and ML work. Resume projects first, then the
   shipped course/coursework builds already published on the site. */
export const PROJECTS = [
  {
    id: 'ironbark',
    title: 'Iron Bark',
    kicker: 'Autonomous VLA robot dog',
    date: 'Mar 2026 to present',
    tag: 'Robotics, edge AI',
    body: 'A multithreaded perception pipeline combining YOLOv11 object detection, multi-shot ArcFace biometric enrollment, and a vision-language model across a distributed Pi 5 and GPU compute architecture.',
    bullets: [
      'Eliminated VLM hallucinations with YOLO-grounded prompting: real-time detection counts get injected into the VLM context.',
      'Swapped LLaVA-7B for Moondream and cut latency 4.7x.',
      'Behavior state machine, IDLE to FOLLOW to SEARCH to EXPLORE, with hysteresis-based transitions over a dual-camera edge system on ZeroMQ.',
    ],
    tags: ['YOLOv11', 'ArcFace', 'Moondream', 'ZeroMQ', 'Raspberry Pi 5'],
    href: null,
    photo: null,
  },
  {
    id: 'rembeetle',
    title: 'Rembeetle',
    kicker: 'Real-time agentic voice platform',
    date: 'Jul 2025 to present',
    tag: 'Generative models',
    body: 'A real-time multimodal inference pipeline with sub-second latency, orchestrating Whisper ASR, GPT-4o, TTS, and Silero VAD for bidirectional voice AI in asynchronous Python.',
    bullets: [
      'Retrieval-augmented generation with Google OAuth (ES256/JWKS), asyncpg Postgres with per-user data isolation, and pgvector cosine similarity over 1536-dim embeddings.',
      'Agentic pipeline on the Model Context Protocol with streaming JSON parsing, so tools are discovered and called at runtime.',
      'Started life as RemAI: an AI-powered waifu for people who want to bring their favorite character to life.',
    ],
    tags: ['Whisper', 'GPT-4o', 'pgvector', 'MCP', 'AWS EC2'],
    href: 'https://www.rembeetle.com/',
    hrefLabel: 'Visit rembeetle.com',
    photo: 'img/photo/remai-600.jpg',
    photoAlt: 'The Rembeetle voice assistant interface.',
  },
  {
    id: 'arm',
    title: 'Voice-controlled robotic arm',
    kicker: 'Say it, and the arm picks it up',
    date: 'Sep 2025 to Nov 2025',
    tag: 'Robotics, computer vision',
    body: 'A 4-DOF autonomous robotic arm driven by a custom-trained YOLOv11 model, executing spoken commands through computer vision.',
    bullets: [
      'Deterministic control state machine with 7-point linear interpolation mapping camera depth to servo angles at 0.5-degree actuation accuracy.',
      'Distributed control: vision at 8 FPS on a host PC, coordinates streamed over low-latency UDP to a Raspberry Pi embedded controller.',
    ],
    tags: ['YOLOv11', 'OpenCV', 'UDP', 'Raspberry Pi'],
    href: null,
    photo: null,
  },
  {
    id: 'thermal',
    title: 'Thermal performance predictor',
    kicker: 'Large-energy storage systems',
    date: 'Oct 2024',
    tag: 'Machine learning',
    body: 'Time-sequential neural networks (LSTM, GRU, RNN, RBF-RNN) standing in for slow thermal energy storage simulations. Built at Calit2, where the same work cut a 15-hour simulation to 6 minutes including training.',
    bullets: [
      'Custom training pipeline with gradient clipping and teacher forcing, stabilizing convergence across 100 epochs of volatile time-series data.',
      'Research is ongoing. Discharge patterns are still to be trained.',
    ],
    tags: ['PyTorch', 'LSTM', 'GRU', 'Time series'],
    href: 'https://www.github.com/alexajb2/ML-Thermal-Energy-Storage-Simulations',
    hrefLabel: 'View on GitHub',
    photo: 'img/photo/thermal-plot-600.jpg',
    photoAlt: 'Model predictions plotted against the reference simulation.',
  },
  {
    id: 'quiz',
    title: 'Automated Python quiz generator',
    kicker: 'Active recall, built for ICS 31',
    date: 'Sep 2024',
    tag: 'AI in education',
    body: 'GPT writes programming quiz questions for UC Irvine’s intro course, a synthesized voice reads them, and a video pipeline cuts them into short-form review clips. If students are scrolling anyway, learning can live in the feed too.',
    bullets: [
      'Shipped as a full-stack tool on AWS EC2 with FastAPI and React, with rate limiting and input sanitization.',
      'Cut content-creation workload by 93%.',
    ],
    tags: ['Python', 'FastAPI', 'React', 'OpenAI API', 'Moviepy'],
    href: 'https://www.github.com/BaneBeetle/ICS31_Quiz_Generator',
    hrefLabel: 'View on GitHub',
    photo: 'img/photo/ics31-566.jpg',
    photoAlt: 'A generated ICS 31 quiz question.',
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper AI',
    kicker: 'Certainty first, probability after',
    date: 'May 2024',
    tag: 'Artificial intelligence',
    body: 'An agent that clears Minesweeper boards using deterministic logical inference first, then probability estimates when certainty runs out. It outperformed 80 percent of participants in its course tournament.',
    bullets: [],
    tags: ['Python', 'Logical inference', 'Probability'],
    href: 'https://www.github.com/BaneBeetle/MineSweeperAI',
    hrefLabel: 'View on GitHub',
    photo: 'img/photo/minesweeper-600.jpg',
    photoAlt: 'The Minesweeper solver working through a board.',
  },
];

/* Wall: research, teaching, school. */
export const EDUCATION = [
  {
    school: 'Columbia University',
    degree: 'MS, Computer Science',
    when: 'Expected Dec 2026',
    where: 'New York, NY',
    note: 'Machine Learning, Deep Learning, Natural Language Processing, Reinforcement Learning.',
  },
  {
    school: 'University of California, Irvine',
    degree: 'BS, Computer Science',
    when: 'Jun 2025',
    where: 'Irvine, CA',
    note: null,
  },
];

export const EXPERIENCE = [
  {
    id: 'calit2',
    role: 'Machine Learning Engineer',
    org: 'Calit2',
    when: 'Oct 2024 to Mar 2025',
    where: 'Irvine, CA',
    body: 'Built a real-time LSTM prediction model in PyTorch simulating large-scale thermal behavior of energy storage systems, reducing simulation time from 15 hours to 6 minutes including training.',
    href: 'https://www.calit2.uci.edu/',
    photo: 'img/photo/calit2-600.jpg',
    photoAlt: 'The Calit2 building at UC Irvine.',
  },
  {
    id: 'ta',
    role: 'Guest Lecturer and Teaching Assistant',
    org: 'University of California, Irvine',
    when: 'Sep 2023 to Mar 2025',
    where: 'Irvine, CA',
    body: 'Guest-lectured a 360-student session on Python and data structures, and led a team of learning assistants coordinating grading, exams, and administrative operations.',
    href: 'https://www.youtube.com/@brianbeetle',
    photo: 'img/photo/brian-lectern-600.jpg',
    photoAlt: 'Brian guest-lecturing at a lectern.',
  },
  {
    id: 'nsf',
    role: 'NSF Research Experience for Undergraduates',
    org: 'Elementary Computing for All',
    when: 'Jan 2024',
    where: 'Irvine, CA',
    body: 'Co-developed one of the first elementary computational-thinking curricula.',
    href: 'https://www.elementarycomputingforall.org/',
    photo: 'img/photo/ec4all-600.jpg',
    photoAlt: 'Elementary Computing for All classroom materials.',
  },
  {
    id: 'aied',
    role: 'Artificial Intelligence Research Assistant',
    org: 'GenAI in Education',
    when: 'Oct 2024',
    where: 'Irvine, CA',
    body: 'Researching the impact AI has on education.',
    href: 'https://www.genaied.org/',
    photo: 'img/photo/aied-600.jpg',
    photoAlt: 'GenAI in education research materials.',
  },
];

export const PAPER = {
  title: 'Designing a Culturally Sustaining Computer Science Curriculum Integrated with Environmental Literacy through a Research-Practice Partnership',
  venue: '2025 AERA Annual Meeting, Denver, Colorado',
  date: 'April 2025',
  status: 'Accepted by AERA. Presented at AERA 2025.',
  speaker: 'Brian Phan',
  href: 'publication.html',
  photo: 'img/photo/aera2025-800.jpg',
  photoAlt: 'Brian presenting at the 2025 AERA Annual Meeting.',
  blurb: 'Co-designing a CS curriculum with elementary teachers for predominantly Latinx and multilingual communities, built to honor community knowledge rather than paper over it.',
};

/* Personal texture. One line, no more. */
export const BIKE = {
  title: 'Mountain bike',
  body: 'Same reason as the car: the trail keeps me sharp.',
  photo: 'img/photo/brian-bike-454.jpg',
  photoAlt: 'Brian mid-air on a mountain bike trail.',
};

export const DOG = {
  title: 'Iron Bark',
  body: 'The robot dog from the workbench, parked on its dock. Sit, follow, search, explore.',
  ref: 'ironbark',
};

export const CREDITS = {
  model: 'This work is based on "BMW M3 E46" (https://sketchfab.com/3d-models/bmw-m3-e46-a067132c75f5456daa4f60c4001337d7) by Lexyc16 (https://sketchfab.com/Lexyc16) licensed under CC-BY-NC-4.0.',
  modelLink: 'https://sketchfab.com/3d-models/bmw-m3-e46-a067132c75f5456daa4f60c4001337d7',
  authorLink: 'https://sketchfab.com/Lexyc16',
  licenseLink: 'http://creativecommons.org/licenses/by-nc/4.0/',
  built: 'Built with three.js. No frameworks, no build step. Everything in the room except the car is generated in code.',
};

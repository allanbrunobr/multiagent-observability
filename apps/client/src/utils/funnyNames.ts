// Deterministic funny name generator for agent IDs
// Same agentId always produces the same name (like Docker container names)

const adjectives = [
  'angry', 'brave', 'calm', 'dizzy', 'eager',
  'fancy', 'goofy', 'happy', 'icy', 'jolly',
  'keen', 'lazy', 'moody', 'nerdy', 'odd',
  'proud', 'quiet', 'rowdy', 'silly', 'tiny',
  'uppity', 'vivid', 'wacky', 'xenial', 'zany',
  'cosmic', 'crispy', 'funky', 'grumpy', 'hyper',
  'jazzy', 'lumpy', 'mellow', 'nifty', 'peppy',
  'quirky', 'rusty', 'snappy', 'turbo', 'witty',
];

const scientists = [
  'turing', 'curie', 'tesla', 'darwin', 'euler',
  'fermi', 'gauss', 'hubble', 'ising', 'joule',
  'kepler', 'lorenz', 'mendel', 'newton', 'ohm',
  'planck', 'quine', 'raman', 'sagan', 'tao',
  'ulam', 'volta', 'wigner', 'yang', 'zuse',
  'bohr', 'dirac', 'faraday', 'hopper', 'laplace',
  'maxwell', 'noether', 'pascal', 'riemann', 'shannon',
  'wald', 'fourier', 'cauchy', 'galois', 'hilbert',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function generateFunnyName(agentId: string): string {
  const hash = hashString(agentId);
  const adj = adjectives[hash % adjectives.length];
  const sci = scientists[(hash >> 8) % scientists.length];
  return `${adj}_${sci}`;
}

// types stay the same
export type Hotline = {
  id: string;
  name: string;
  subtitle?: string;
  tag?: string;
  phones: string[];
  sms?: string[];
};

export const LINGAYEN_HOTLINES: Hotline[] = [
  { id: "pdrrmo", name: "PDRRMO", subtitle: "Prov’l Disaster Risk Reduction", tag: "24/7", phones: ["911","09171505754","09985846867"] },
  { id: "pnp", name: "PNP – Lingayen", subtitle: "Police Station", phones: ["09165625358","09985985130"] },
  { id: "mswdo", name: "MSWDO", phones: ["0756337991"] },
  { id: "ldh", name: "Lingayen District Hospital", phones: ["0755422295","09430770072"] },
  { id: "jngh", name: "Jesus Nazarene General Hospital", phones: ["0755425758","09773485328"] },
  { id: "sncgh", name: "Sto. Niño de Casipit General Hospital", phones: ["0755224295","09662152473"] },
  { id: "ldrrmo", name: "LDRRMO", tag: "24/7", phones: ["0756537515","09190992230"] },
  { id: "bfp", name: "BFP – Lingayen", subtitle: "Fire Station", phones: ["0755290693","09171861611"] },
  { id: "primewater", name: "PrimeWater", phones: ["0756944407","09956504444"] },
  { id: "cenpelco", name: "CENPELCO", phones: ["0755295179","09175156420","09215257718"] },
  { id: "rhu1", name: "Rural Health Unit I", phones: ["0755119877"] },
  { id: "rhu2", name: "Rural Health Unit II", phones: ["0755238146","09190895882"] },
  { id: "rhu3", name: "Rural Health Unit III", phones: ["09479921899"] },
];

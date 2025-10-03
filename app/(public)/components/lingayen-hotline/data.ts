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
  { id: "pnp", name: "PNP – Lingayen",tag: "24/7", subtitle: "Police Station", phones: ["09165625353","09985985109"] },
  { id: "mswdo", name: "MSWDO", phones: ["0756337991"] },
  { id: "ldh", name: "Lingayen District Hospital", subtitle: "Hotline & Number", phones: ["0755422295","09430770072"] },
  { id: "jngh", name: "Jesus Nazarene General Hospital", subtitle: "Hotline & Number",phones: ["0755425758","09773485328"] },
  { id: "sncgh", name: "Sto. Niño de Casipit General Hospital", subtitle: "Hotline & Number",phones: ["0755224295","09662152473"] },
  { id: "ldrrmo", tag: "24/7", name: "LDRRMO", subtitle: "Hotline & Number",phones: ["0756537515","09190992230"] },
  { id: "bfp", name: "BFP – Lingayen", subtitle: "Fire Station", phones: ["0755427080","09171861611"] },
  { id: "primewater", name: "PrimeWater", subtitle: "Hotline & Number",phones: ["0756544447","09985903400","09277804924"] },
  { id: "cenpelco", name: "CENPELCO",subtitle: "Hotline & Number", phones: ["0755295179","09215257718","09165847423"] },
  { id: "rhu1", name: "Rural Health Unit I", phones: ["0755119877"] },
  { id: "rhu2", name: "Rural Health Unit II", subtitle: "Hotline & Number",phones: ["0756323146","09190895828"] },
  { id: "rhu3", name: "Rural Health Unit III", subtitle: "Hotline & Number",phones: ["09479921899"] },
];

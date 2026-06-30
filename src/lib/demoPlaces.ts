export interface DemoPlace {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  aliases: string[];
}

export const DEMO_PLACES: DemoPlace[] = [
  {
    id: "cin-ufpe",
    label: "Centro de Informatica - UFPE",
    address: "Av. Jornalista Anibal Fernandes, s/n - Cidade Universitaria, Recife - PE",
    latitude: -8.05536,
    longitude: -34.95194,
    aliases: [
      "cin",
      "c in",
      "ufpe",
      "centro de informatica",
      "centro de informatica ufpe",
      "cidade universitaria",
    ],
  },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function searchDemoPlaces(query: string) {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return [];

  return DEMO_PLACES.filter((place) => {
    const haystack = [place.label, place.address, ...place.aliases].map(normalize).join(" ");
    return normalizedQuery
      .split(/\s+/)
      .filter(Boolean)
      .every((term) => haystack.includes(term));
  });
}

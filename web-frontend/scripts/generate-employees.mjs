import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUTPUT = path.resolve(process.cwd(), "public", "employees.json");

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function readExisting(file) {
  try {
    const s = fs.readFileSync(file, "utf8");
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const FIRST_NAMES = [
  "Alex","Bianca","Carlos","Dina","Evan","Fatima","Galen","Helena","Ismael","Jasmine",
  "Ken","Lara","Milo","Nina","Owen","Pia","Quinn","Ravi","Sara","Tomas",
  "Uma","Vince","Wren","Xena","Yuri","Zara","Anton","Bella","Cyrus","Dahlia",
  "Elias","Fiona","Gio","Hazel","Iris","Jonas","Kira","Levi","Mara","Nolan",
  "Olive","Paolo","Queenie","Rhea","Soren","Talia","Uri","Victor","Willa","Xander",
  "Yana","Zed"
];
const LAST_NAMES = [
  "Agbayani","Alcantara","Aquino","Arellano","Baluyot","Bartolome","Bautista","Belmontes","Benitez","Bernardo",
  "Caballero","Calderon","Camacho","Carandang","Castillo","Castro","Chavez","Concepcion","Cordero","Cruz",
  "Del Mundo","De Leon","Del Rosario","Diaz","Domingo","Estrada","Evangelista","Ferrer","Flores","Francisco",
  "Gamboa","Garcia","Gonzales","Guzman","Hernandez","Ibanez","Ignacio","Jacinto","Jimenez","Lazaro",
  "Lim","Lopez","Macapagal","Manalo","Mendoza","Morales","Navarro","Nicolas","Ocampo","Olivarez",
  "Ortiz","Padilla","Panganiban","Pascual","Perez","Pineda","Ramos","Reyes","Rivera","Salazar",
  "Sanchez","Santiago","Sison","Soriano","Tan","Torres","Valdez","Valencia","Vargas","Velasco",
  "Vergara","Villanueva","Yu","Yap","Zamora","Zulueta"
];

function makeUniqueNameGenerator(used, seedI = 0, seedJ = 0) {
  let i = seedI % FIRST_NAMES.length;
  let j = seedJ % LAST_NAMES.length;
  let suffix = 1;
  return function next() {
    while (true) {
      let candidate = `${FIRST_NAMES[i]} ${LAST_NAMES[j]}`;
      i = (i + 1) % FIRST_NAMES.length;
      j = (j + 3) % LAST_NAMES.length;
      if (i === 0 && j === 0) {
        suffix++;
      }
      if (suffix > 1) {
        candidate = `${candidate} ${suffix}`;
      }
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
    }
  };
}

function hashString(s) {
  let h = 0;
  for (let k = 0; k < s.length; k++) {
    h = ((h << 5) - h + s.charCodeAt(k)) | 0;
  }
  return Math.abs(h);
}

function generateUniquePlaceholders(count, used, seedI = 0, seedJ = 0) {
  const nextName = makeUniqueNameGenerator(used, seedI, seedJ);
  const out = [];
  for (let k = 0; k < count; k++) {
    out.push(nextName());
  }
  return out;
}

async function main() {
  console.log(`[employees] Fetching offices from ${BASE_URL}/api/offices-data`);
  const officesData = await fetchJSON(`${BASE_URL}/api/offices-data`);
  const officeNames = [
    ...(officesData.topLevelOffices || []).map(o => o.name),
    ...(officesData.services || []).flatMap(s => (s.offices || []).map(o => o.name))
  ].filter(Boolean);

  const byOffice = {};
  const used = new Set();
  for (const name of officeNames) {
    const h = hashString(name);
    byOffice[name] = generateUniquePlaceholders(5, used, h, h * 7);
  }

  const data = { byOffice };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2), "utf8");
  console.log(`[employees] Wrote ${OUTPUT} with ${Object.keys(byOffice).length} offices`);
}

main().catch(err => {
  console.error("[employees] Failed to generate employees.json:", err?.message || err);
  process.exit(1);
});

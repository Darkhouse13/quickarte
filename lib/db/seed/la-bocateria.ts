import { and, eq } from "drizzle-orm";
import { auth } from "../../auth/server";
import { db } from "../index";
import {
  users,
  businesses,
  businessSettings,
  categories,
  products,
  productVariants,
  productOptions,
  optionValues as optionValueRows,
} from "../schema";

const BUSINESS = {
  ownerName: "Hamza Bakhat",
  email: "hamza@labocateria.ma",
  password: "labocateria26",
  name: "La Bocatería",
  slug: "la-bocateria",
  type: "restaurant" as const,
  city: "Tangier",
  address:
    "immeuble n°79, complexe Kawassim, 90000 Route principale, Rte Rahrah, Tanger 90000",
  currency: "MAD",
  timezone: "Africa/Casablanca",
  locale: "fr-MA",
};

type VariantSeed = { name: string; price: number; isDefault?: boolean };
type OptionValueSeed = { name: string; price?: number };
type OptionSeed = {
  name: string;
  type: "single_select" | "multi_select";
  required?: boolean;
  minSelect?: number;
  maxSelect?: number | null;
  values: OptionValueSeed[];
};
type ProductSeed = {
  name: string;
  price: number;
  description?: string;
  variants?: VariantSeed[];
  options?: OptionSeed[];
};
type CategorySeed = { name: string; products: ProductSeed[] };

const sauces = ["Algérienne", "Samouraï", "Biggy", "Harissa", "Blanche"];
const boxSauces = [...sauces, "BBQ"];
const garnishValues = [
  "Riz à la provençale",
  "Légumes sautés",
  "Frites",
  "Pommes au four",
  "Riz sauce champignons",
  "Purée de pommes de terre",
];
const grillSauces = ["Champignons", "Roquefort", "Poivre vert"];
const sweetFlavors: VariantSeed[] = [
  ["Nature/sucrée", 20],
  ["Confiture ou miel", 25],
  ["Caramel", 25],
  ["Amlou", 28],
  ["Chocolat au lait", 29],
  ["Chocolat blanc", 29],
  ["Black & White", 30],
  ["Nutella", 30],
  ["Brazilian", 35],
  ["Ferrero Rocher", 42],
  ["Kinder Bueno", 42],
  ["Bounty", 42],
  ["Lotus", 42],
  ["Kit Kat", 42],
].map(([name, price], i) => ({ name: name as string, price: price as number, isDefault: i === 0 }));

function optionValueSeeds(names: string[]): OptionValueSeed[] {
  return names.map((name) => ({ name, price: 0 }));
}

function tacosOptions(): OptionSeed[] {
  // TODO: Confirm sauce list with merchant before launch.
  return [
    {
      name: "Sauce",
      type: "single_select",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      values: optionValueSeeds(sauces),
    },
    {
      name: "Gratiné",
      type: "single_select",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      values: [
        { name: "Non", price: 0 },
        { name: "Oui", price: 15 },
      ],
    },
  ];
}

function grillOptions(garnitureCount = 2): OptionSeed[] {
  return [
    {
      name: "Garnitures",
      type: "multi_select",
      required: true,
      minSelect: garnitureCount,
      maxSelect: garnitureCount,
      values: optionValueSeeds(garnishValues),
    },
    {
      name: "Sauce",
      type: "single_select",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      values: optionValueSeeds(grillSauces),
    },
  ];
}

function burgerOptions(): OptionSeed[] {
  return [
    {
      name: "Enrobage",
      type: "single_select",
      required: false,
      minSelect: 0,
      maxSelect: 1,
      values: [
        { name: "Aucun", price: 0 },
        { name: "Doritos", price: 20 },
        { name: "Cheetos", price: 20 },
      ],
    },
  ];
}

function crispySauceOption(maxSelect: number): OptionSeed[] {
  // TODO: Confirm box sauce list with merchant before launch.
  return [
    {
      name: "Sauce",
      type: "multi_select",
      required: true,
      minSelect: maxSelect,
      maxSelect,
      values: optionValueSeeds(boxSauces),
    },
  ];
}

const CATEGORIES: CategorySeed[] = [
  {
    name: "Petits déjeuner",
    products: [
      ["Parisien", 39, "Assortiment de mini viennoiseries, tranches de pain, beurre, confiture, boisson chaude, eau 33 cl, mini jus d'orange."],
      ["Espagnol", 45, "Pain ou toast grillé, purée de tomate, fromage manchego, tapenade, boisson chaude, eau 33 cl, mini jus d'orange."],
      ["Fassi", 45, "Khlie avec 2 œufs, panier de pain, olives noires, fromage beldi, dchicha, boisson chaude, eau 33 cl."],
      ["Chamali", 45, "2 œufs, mortadelle, fromage beldi, La Vache qui rit, boisson chaude, dchicha, eau 33 cl."],
      ["Marocain", 45, "Baghrir, harcha, rghayef, miel, amlou, beurre, fromage beldi, boisson chaude, eau 33 cl, belboula."],
      ["Hollandais", 48, "Toasts grillés, 2 œufs, dinde fumée, fromage Edam, boisson chaude, mini jus d'orange."],
      ["Mexicain", 52, "Toast spécial, purée d'avocat, thon, œufs, boisson chaude, eau 33 cl, mini jus d'orange."],
      ["Norvégien", 68, "Toast, purée d'avocat, laitue, fromage, saumon fumé, 2 œufs, boisson chaude, mini jus d'orange, eau 33 cl."],
      ["British", 60, "Haricots à la sauce tomate, bacon de bœuf, œufs, merguez, tomates grillées, champignons, boisson chaude, mini jus d'orange."],
      ["Sportif", 50, "Tartines pain polka (saumon, avocat, dinde fumée, fromage, 2 œufs pochés), bol composé (yaourt nature, chouffane, fruit de saison, miel)."],
      ["La Bocatería", 80, "Omelette au fromage Edam, dinde fumée, champignons, tartine d'avocat et gambas, 2 mini viennoiseries, yaourt fruits secs, boisson chaude, mini jus d'orange, salade de fruits, eau 33 cl."],
    ].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string })),
  },
  {
    name: "Petits déjeuner enfants",
    products: [
      {
        name: "Petit-déj enfant",
        price: 38,
        description:
          "Bol de cornflakes OU bol de salade de fruits, au choix (baby pancakes Nutella / trio mini viennoiseries / 2 mini crêpes), bouteille d'eau, chocolat chaud, mini jus d'orange.",
        options: [
          { name: "Composition principale", type: "single_select", required: true, minSelect: 1, maxSelect: 1, values: optionValueSeeds(["Cornflakes", "Salade de fruits"]) },
          { name: "Au choix", type: "single_select", required: true, minSelect: 1, maxSelect: 1, values: optionValueSeeds(["Baby pancakes Nutella", "Trio mini viennoiseries", "2 mini crêpes"]) },
        ],
      },
      { name: "Brunch", price: 110, description: "Assortiment de viennoiseries, croissant farci avocat & saumon fumé, poêle omelette pepperoni, poulet pané, mini pancakes Nutella, salade de fruits, pommes au four, panier de pain, boisson chaude, bouteille d'eau, jus d'orange." },
    ],
  },
  { name: "À la carte — Toasts & Croques", products: [["Toast au fromage Edam",18],["Toast au fromage et dinde fumée",20],["Croque au fromage",28],["Croque au fromage et dinde fumée",30]].map(([name, price]) => ({ name: name as string, price: price as number })) },
  { name: "À la carte — Omelettes", products: [["Omelette nature",20],["Omelette au fromage",25],["Omelette aux champignons frais",28],["Omelette végétarienne",30],["Omelette au fromage et champignons",30],["Omelette au fromage et dinde fumée",35]].map(([name, price]) => ({ name: name as string, price: price as number })) },
  {
    name: "À la carte — Œufs",
    products: [
      { name: "Œufs au plat", price: 12, variants: [{ name: "1 œuf", price: 12, isDefault: true }, { name: "2 œufs", price: 16 }, { name: "3 œufs", price: 20 }] },
      { name: "Œufs spécial", price: 25, variants: [{ name: "1 œuf", price: 25, isDefault: true }, { name: "2 œufs", price: 32 }] },
      { name: "Œufs au khlie", price: 22, variants: [{ name: "1 œuf", price: 22, isDefault: true }, { name: "2 œufs", price: 30 }, { name: "3 œufs", price: 38 }] },
    ],
  },
  { name: "À la carte — Baghrir / Rghayef / Pain", products: [{ name: "Baghrir, rghayef, pain (avec accompagnements)", price: 13, description: "Accompagnements à confirmer côté merchant : miel, amlou, beurre, fromage, confiture.", variants: [{ name: "2 accompagnements", price: 13, isDefault: true }, { name: "3 accompagnements", price: 20 }] }] },
  { name: "Crêpes, Gauffres, Waffles sucrées", products: ["Crêpe", "Gauffre", "Waffle"].map((name) => ({ name, price: 20, variants: sweetFlavors })) },
  { name: "Crêpes salées", products: [{ name: "Crêpe salée (servie avec frites)", price: 38, variants: [["Au fromage",38],["Au fromage charcuterie",45],["Au poulet champignons",48],["À la viande hachée",55],["Mixte",60]].map(([name, price], i) => ({ name: name as string, price: price as number, isDefault: i === 0 })) }] },
  { name: "Glaces", products: [["Exotique (boule de glace)",52],["Fruits rouges (boule de glace)",55],["Dubai pistachio (boule de glace)",60],["Coupe La Bocatería",69,"Lotus, Kinder, Kit Kat, Nutella, 2 boules de glace." ]].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string | undefined })) },
  { name: "Jus Frais", products: [["Orange",20],["Citron",25],["Citron gingembre",28],["Banane orange",28],["Pomme orange",28],["Carotte orange",28],["Fraise orange",30],["Betterave orange",30],["Avocat",35],["Mangue orange",35],["Ananas",35],["Kiwi orange",35],["Fraise mangue",38],["Fraise kiwi orange",38],["Mangue ananas",38],["Fraise ananas",38],["Dragon orange",40]].map(([name, price]) => ({ name: name as string, price: price as number })) },
  { name: "Bocatería Coffee-Choco", products: [
    { name: "Chocolat chaud", price: 25, description: "Cacao onctueux et velouté." },
    { name: "Cappuccino italien", price: 25, description: "Expresso intense surmonté d'une mousse de lait crémeuse et légère." },
    { name: "Cappuccino viennois", price: 22, description: "Espresso allongé, crème chantilly, soupçon de cacao." },
    { name: "Chocolat fondu", price: 25, description: "Chocolat pur fondu.", options: [{ name: "Type", type: "single_select", required: true, minSelect: 1, maxSelect: 1, values: optionValueSeeds(["Noir", "Blanc"]) }] },
    { name: "Macchiato au choix", price: 28, description: "Café multicouche, force de l'expresso + douceur du lait chaud. Type à confirmer côté merchant." },
  ] },
  { name: "Nos Ice Teas Maison", products: [
    { name: "Ice Tea Classique", price: 35, options: [{ name: "Parfum", type: "single_select", required: true, minSelect: 1, maxSelect: 1, values: optionValueSeeds(["Pêche", "Citron"]) }] },
    { name: "Ice Tea Création Premium", price: 55, options: [{ name: "Parfum", type: "single_select", required: true, minSelect: 1, maxSelect: 1, values: optionValueSeeds(["Floral Berry", "Fruits Rouges & Vanille", "Passion Mangue"]) }] },
  ] },
  { name: "Mocktails classiques", products: [
    ["Bora Bora",45,"Jus d'ananas, jus de passion, sirop de grenadine, jus de citron."],["Piña colada",45,"Jus d'ananas, crème de coco, glace ananas."],["Mojito classique",38,"Menthe fraîche, citron vert en quartiers, sucre de canne, eau gazeuse, glace pilée."],["Mojito coco",45,"Base mojito (menthe, citron) + sirop de coco."],["Mojito fruits de la passion",45,"Base mojito + purée et sirop de fruits de la passion."],["Mojito fruits rouges",45,"Base mojito + fruits rouges frais ou sirop de fruits rouges."],["Smoothie Mango Madness",45,"Mangue, orange, banane, glace yaourt."],["Smoothie Berry Madness",45,"Fruits rouges, banane, pomme pressée, glace yaourt."],["Smoothie Strawberry Surprise",45,"Fraise, ananas, banane, glace yaourt."],
  ].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string })) },
  { name: "Bubble Tea", products: [["Strawberry bubble tea",45,"Thé vert infusé à la fraise, perles de saveur assorties."],["Blueberry fruits de la passion",45,"Myrtille sauvage et fruit de la passion."],["Mango bubble tea",45,"Mangue mûre, thé léger, billes fruitées."],["Pineapple bubble tea",45,"Thé ultra-frais, perles d'ananas croquantes."]].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string })) },
  { name: "Tacos", products: [["Tacos poulet",49,"Poulet, sauce fromagère, oignons crispy, frites."],["Tacos nuggets",55,"Nuggets, sauce fromagère, oignons crispy, frites."],["Tacos viande hachée",59,"Viande hachée, sauce fromagère, oignons crispy, frites."],["Tacos cordon bleu",55,"Cordon bleu, sauce fromagère, oignons crispy, frites."],["Tacos mixte",65,"Poulet + viande hachée, sauce fromagère, oignons crispy, frites."]].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string, options: tacosOptions() })) },
  { name: "Poulet rôti & grillades", products: [
    { name: "1/4 poulet rôti", price: 55, description: "Sauce champignons + 2 garnitures au choix.", options: grillOptions() },
    { name: "1/2 poulet", price: 95, description: "3 garnitures au choix.", options: grillOptions(3) },
    { name: "1 poulet entier", price: 149, description: "Garnitures fixes: purée, légumes sautés, frites, riz à la crème. Sauce champignons (4p)." },
    ...[["Brochettes poulet",69,"À la plancha."],["Brochettes viande hachée",69,"À la plancha."],["Brochettes mixtes",95,"Poulet, viande hachée, saucisses, à la plancha."],["Émincé de poulet",75],["Émincé de bœuf",95],["Cordon bleu maison",85],["Filet de bœuf",180],["Entrecôte de bœuf",160]].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string | undefined, options: grillOptions() })),
  ] },
  { name: "Menu kids", products: [["Mini cheese burger + frites + boisson",45],["Assortiment de nuggets + frites",45],["Mini pâtes bolognaise",45]].map(([name, price]) => ({ name: name as string, price: price as number })) },
  { name: "Pizza", products: [["Margherita",45,"Sauce tomate, mozzarella, basilic frais, huile d'olive."],["Végétarienne",48,"Sauce tomate ou crème, mozzarella, champignons, poivrons, oignons, olives, courgettes, aubergines."],["Al tonno",50,"Sauce tomate, mozzarella, thon, oignons, olives, basilic frais."],["Alfredo",55,"Mozzarella, poulet cuit, oignons rouges, champignons, basilic frais."],["Chicken barbecue",55,"Mozzarella, poulet cuit, champignons, sauce barbecue, basilic frais."],["Bolognaise",55,"Mozzarella, sauce bolognaise (viande hachée de bœuf), oignons confits, olives."],["Pepperoni",58,"Sauce tomate, mozzarella, pepperoni, basilic frais."],["4 fromages",65,"Sauce tomate, roquefort, emmental, edam, mozzarella."],["4 saisons",65,"Sauce tomate, viande hachée, poulet, légumes grillés, fruits de mer."],["Fruits de mer",65,"Sauce tomate, fruits de mer, mozzarella, champignons, olives."],["Bocatería",75,"Sauce tomate, fruits de mer, poulet, mozzarella, câpres, champignons, moules."],["Pizza burrata tartufata",110]].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string | undefined })) },
  { name: "Pastas", products: [["Al Arrabiata",45,"Pâtes, sauce tomate, ail, piment, huile d'olive, sel, persil, parmesan ou pecorino."],["Al tonno",49,"Pâtes, thon, sauce tomate, ail, huile d'olive, persil, parmesan ou pecorino."],["Carbonara",55,"Pâtes, jaunes d'œufs, grana padano râpé, poivre noir."],["Bolognaise",59,"Pâtes, viande hachée, sauce tomate, concentré, oignons, parmesan râpé."],["Poulet champignons",59,"Pâtes, poulet, champignons, crème fraîche, oignons, ail, poivre, parmesan."],["Alfredo (pâtes au choix)",69,"Beurre, crème, parmesan râpé, ail, poivre, noix de muscade, crème de truffes, poulet, champignons."],["Fruits de mer",75,"Pâtes, palourdes, calamars, crevettes, sauce tomate, ail, huile d'olive, persil, poivre."],["Tagliatelles 4 fromages",75,"Crème fraîche, parmesan, gorgonzola, mozzarella, edam."],["Linguini au saumon",95,"Saumon frais ou fumé, crème fraîche, oignon ou échalote, ail, aneth, ciboulette, poivre, parmesan râpé."],["Spécialité du chef — Moelleux de saumon sauce aux crevettes",170],["Cheese steak sandwich aux poivrons",150,"Servi avec frites à l'ail et herbes de Provence."]].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string | undefined })) },
  { name: "Sandwichs", products: [["Poulet spécial",55,"Brochettes de poulet marinés, salade iceberg, oignons crispy, oignons caramélisés, double cheddar, sauce brazil, sauce maison, frites."],["Long chicken",59,"Escalope de poulet panée marinée, salade iceberg, oignons crispy, double cheddar, sauce pita, sauce maison, frites."],["Poulet tandoori",59,"Brochettes tandoori, oignons crispy, double cheddar, sauce tandoori, sauce maison, frites."],["Poulet curry",59,"Brochettes curry, oignons crispy, oignons caramélisés, double cheddar, sauce curry, sauce maison, frites."],["Bocadillo de calamares",65,"Calamars frais, salade iceberg, sauce fromage, sauce pita, oignons crispy, frites."],["Viande hachée",65,"Steaks de viande hachée marinés, oignons crispy, oignons caramélisés, double cheddar, sauce maison, frites."],["Saucisses de veau",60,"Saucisses de veau, oignons crispy, oignons caramélisés, double cheddar, sauce maison, frites."]].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string })) },
  { name: "Burgers", products: [["Cheese burger",45,"Pain brioche, steak viande hachée, cheddar, salade, tomate, sauce maison, frites."],["Chicken burger",55,"Pain brioche, poulet crunchy, cheddar, coleslaw, oignons crispy, sauce pita, frites."],["Smash burger",59,"Pain brioche smash, viande hachée 100 g, cheddar, oignons crispy, oignons caramélisés, frites."],["Double smash burger",75,"Pain brioche smash, double steak (200 g), cheddar, oignons crispy, oignons caramélisés, frites."],["Bacon buffalo burger",69,"Pain brioche, viande hachée 100 g, bacon de bœuf, cheddar, oignons crispy, oignons caramélisés, sauce maison, frites."],["Chili burger",69,"Pain brioché chili, viande hachée 100 g, cheddar, oignons crispy, jalapeños, sauce chili thaï, frites."],["Bocatería burger",90,"Pain brioche smash, double steak (200 g), salade iceberg, 2 mozzasticks, 2 oignons rings, double cheddar, tomates séchées, champignons, oignons crispy, oignons caramélisés, frites."]].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string, options: burgerOptions() })) },
  { name: "Salades", products: [["Salade niçoise",45,"Salade verte, tomates, oignons, pommes de terre, haricots verts, thon, olives noires, anchois marinés, œuf, vinaigrette."],["Salade César",55,"Salade romaine, poulet grillé, croûtons dorés, tomates cerises, parmesan, sauce César."],["Salade César Gambas",65,"Salade romaine, crevettes panées, croûtons dorés, tomates cerises, parmesan, sauce César."],["Salade La Bocatería",79,"Gambas, saumon fumé, poulet crispy, avocat, parmesan, croûtons, tomates cerises, sauce Bocatería."]].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string })) },
  { name: "Patata asada", products: [["Patata asada thon",49,"Thon, maïs, olives, mozzarella, oignons crispy, sauce maison."],["Patata asada shawarma",49,"Poulet shawarma, mozzarella, oignons crispy, sauce maison."],["Patata asada poulet champignons",52,"Poulet, champignons, mozzarella, oignons crispy, sauce."],["Patata asada bolognaise",52,"Viande hachée bolognaise, oignons crispy, champignons, mozzarella, sauce tomate."],["Patata asada fruits de mer",59,"Crevettes, calamar, champignons, mozzarella, oignons crispy, sauce maison."],["Patata asada pepperoni",55,"Pepperoni, champignons, mozzarella, oignons crispy, sauce maison."],["Patata asada sweet chili",55,"Poulet crispy, oignons crispy, mozzarella, sauce sweet chili, sauce maison."]].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string })) },
  { name: "Menu bowls", products: [["Bowl Américain",55,"Frites, sauce cheesy, sauce maison, oignons crispy, tenders poulet."],["Bowl viande kebab",55,"Frites, sauce pita, sauce cheesy, oignons crispy, cheddar, viande kebab shawarma."],["Bowl anglais",58,"Frites, sauce maison, oignons crispy, cheddar, saucisse de veau."]].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string })) },
  { name: "Boxs crispy chicken", products: [
    { name: "Medium box", price: 59, description: "3 pièces crispy chicken, frites, coleslaw, sauces au choix, buns.", options: crispySauceOption(2) },
    { name: "Large box", price: 89, description: "7 pièces crispy chicken, frites, coleslaw, sauces au choix, buns.", options: crispySauceOption(3) },
    { name: "Family box (crispy)", price: 169, description: "15 pièces crispy chicken, frites, salade coleslaw, sauces au choix, buns.", options: crispySauceOption(5) },
  ] },
  { name: "Shawarmas", products: [["Shawarma poulet raghif",36],["Kebab shawarma poulet",49],["Assiette shawarma poulet",58]].map(([name, price]) => ({ name: name as string, price: price as number })) },
  { name: "Boxes & partage (Family box / Tasty box)", products: [["Family box (cheesy)",145,"3 cheese burgers, frites, sauce cheddar, oignons crispy, mozzasticks, sauce buffalo, sauce pita, sauce brazil, salade coleslaw."],["Tasty box",199,"1 bacon buffalo, 1 smash burger, 1 chicken burger, frites, oignons crispy, mozzasticks, onion rings, sauce buffalo, sauce maison, sauce pita, salade coleslaw."]].map(([name, price, description]) => ({ name: name as string, price: price as number, description: description as string })) },
];

async function ensureOwner() {
  let owner = await db.query.users.findFirst({
    where: eq(users.email, BUSINESS.email),
  });
  if (!owner) {
    const signUp = await auth.api.signUpEmail({
      body: { email: BUSINESS.email, password: BUSINESS.password, name: BUSINESS.ownerName },
    });
    const created = await db.query.users.findFirst({ where: eq(users.id, signUp.user.id) });
    if (!created) throw new Error("Failed to create La Bocatería owner");
    owner = created;
  }
  await db
    .update(users)
    .set({ name: BUSINESS.ownerName, role: "owner", updatedAt: new Date() })
    .where(eq(users.id, owner.id));
  if (!owner) throw new Error("Missing La Bocatería owner");
  return owner.id;
}

async function ensureBusiness(ownerId: string) {
  const existing = await db.query.businesses.findFirst({
    where: eq(businesses.slug, BUSINESS.slug),
  });
  const values = {
    ownerId,
    name: BUSINESS.name,
    slug: BUSINESS.slug,
    type: BUSINESS.type,
    city: BUSINESS.city,
    address: BUSINESS.address,
    currency: BUSINESS.currency,
    timezone: BUSINESS.timezone,
    locale: BUSINESS.locale,
    updatedAt: new Date(),
  };
  if (existing) {
    const [business] = await db
      .update(businesses)
      .set(values)
      .where(eq(businesses.id, existing.id))
      .returning();
    if (!business) throw new Error("Failed to update La Bocatería business");
    return business;
  }
  const [business] = await db.insert(businesses).values(values).returning();
  if (!business) throw new Error("Failed to insert La Bocatería business");
  return business;
}

async function ensureSettings(businessId: string) {
  const existing = await db.query.businessSettings.findFirst({
    where: eq(businessSettings.businessId, businessId),
  });
  const values = {
    businessId,
    menuQrEnabled: true,
    orderingEnabled: true,
    loyaltyEnabled: true,
    analyticsEnabled: true,
    reservationsEnabled: false,
    dineInEnabled: true,
    takeawayEnabled: true,
    deliveryEnabled: false,
    tableQrCount: 12,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(businessSettings).set(values).where(eq(businessSettings.id, existing.id));
  } else {
    await db.insert(businessSettings).values(values);
  }
}

async function ensureCategory(businessId: string, seed: CategorySeed, position: number) {
  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.businessId, businessId), eq(categories.name, seed.name)),
  });
  if (existing) {
    const [category] = await db
      .update(categories)
      .set({ position, visible: true, updatedAt: new Date() })
      .where(eq(categories.id, existing.id))
      .returning();
    if (!category) throw new Error(`Failed to update category ${seed.name}`);
    return category;
  }
  const [category] = await db
    .insert(categories)
    .values({ businessId, name: seed.name, position, visible: true })
    .returning();
  if (!category) throw new Error(`Failed to insert category ${seed.name}`);
  return category;
}

async function ensureProduct(
  businessId: string,
  categoryId: string,
  seed: ProductSeed,
  position: number,
) {
  const existing = await db.query.products.findFirst({
    where: and(
      eq(products.businessId, businessId),
      eq(products.categoryId, categoryId),
      eq(products.name, seed.name),
    ),
  });
  const values = {
    businessId,
    categoryId,
    name: seed.name,
    description: seed.description ?? null,
    price: seed.price.toFixed(2),
    image: null,
    available: true,
    position,
    updatedAt: new Date(),
  };
  if (existing) {
    const [product] = await db
      .update(products)
      .set(values)
      .where(eq(products.id, existing.id))
      .returning();
    if (!product) throw new Error(`Failed to update product ${seed.name}`);
    return product;
  }
  const [product] = await db.insert(products).values(values).returning();
  if (!product) throw new Error(`Failed to insert product ${seed.name}`);
  return product;
}

async function replaceVariants(productId: string, variants: VariantSeed[] | undefined) {
  await db.delete(productVariants).where(eq(productVariants.productId, productId));
  if (!variants?.length) return;
  await db.insert(productVariants).values(
    variants.map((variant, position) => ({
      productId,
      name: variant.name,
      priceOverride: variant.price.toFixed(2),
      position,
      isDefault: variant.isDefault ?? position === 0,
      available: true,
    })),
  );
}

async function replaceOptions(productId: string, options: OptionSeed[] | undefined) {
  await db.delete(productOptions).where(eq(productOptions.productId, productId));
  if (!options?.length) return 0;
  let optionCount = 0;
  for (const [position, option] of options.entries()) {
    const [inserted] = await db
      .insert(productOptions)
      .values({
        productId,
        name: option.name,
        type: option.type,
        required: option.required ?? false,
        minSelect: option.minSelect ?? 0,
        maxSelect: option.maxSelect ?? null,
        position,
        available: true,
      })
      .returning({ id: productOptions.id });
    if (!inserted) throw new Error(`Failed to insert option ${option.name}`);
    optionCount += 1;
    await db.insert(optionValueRows).values(
      option.values.map((value, valuePosition) => ({
        optionId: inserted.id,
        name: value.name,
        priceAddition: (value.price ?? 0).toFixed(2),
        position: valuePosition,
        available: true,
      })),
    );
  }
  return optionCount;
}

export async function seedLaBocateriaDemo() {
  const ownerId = await ensureOwner();
  const business = await ensureBusiness(ownerId);
  await ensureSettings(business.id);

  let productCount = 0;
  let optionGroupCount = 0;
  for (const [categoryPosition, categorySeed] of CATEGORIES.entries()) {
    const category = await ensureCategory(business.id, categorySeed, categoryPosition);
    for (const [productPosition, productSeed] of categorySeed.products.entries()) {
      const product = await ensureProduct(business.id, category.id, productSeed, productPosition);
      await replaceVariants(product.id, productSeed.variants);
      optionGroupCount += await replaceOptions(product.id, productSeed.options);
      productCount += 1;
    }
  }

  console.log(
    `La Bocatería seeded — ${CATEGORIES.length} categories, ${productCount} products, ${optionGroupCount} option groups.`,
  );
  console.log(`  [la-bocateria] login: ${BUSINESS.email} / ${BUSINESS.password}`);
}

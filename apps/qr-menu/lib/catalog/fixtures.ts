export type MenuItem = {
  productId?: string;
  name: string;
  description: string;
  price: number;
  image?: { src: string; alt: string };
  badge?: string;
  isSignature?: boolean;
  hasConfiguration?: boolean;
  variants?: MenuItemVariant[];
  options?: MenuItemOption[];
};

export type MenuItemVariant = {
  id: string;
  name: string;
  priceOverride: number | null;
  isDefault?: boolean;
  available?: boolean;
  optionMaxSelectionsOverrides: Record<string, number>;
  option_max_selections_overrides?: Record<string, number>;
};

export type MenuItemOptionValue = {
  id: string;
  name: string;
  priceAddition: number;
  available?: boolean;
};

export type MenuItemOption = {
  id: string;
  name: string;
  type: "single_select" | "multi_select";
  required: boolean;
  minSelect?: number;
  maxSelect?: number | null;
  maxSelections: number | null;
  available?: boolean;
  values: MenuItemOptionValue[];
};

export type MenuSection = {
  id: string;
  label: string;
  items: MenuItem[];
};

export type StorefrontFixture = {
  slug: string;
  name: string;
  location: string;
  description?: string;
  orderingEnabled?: boolean;
  dineInEnabled?: boolean;
  takeawayEnabled?: boolean;
  sections: MenuSection[];
};

export const cafeDesArts: StorefrontFixture = {
  slug: "cafe-maarif",
  name: "Cafe Maarif",
  location: "Maarif, Casablanca",
  sections: [
    {
      id: "viennoiseries",
      label: "Petit dej",
      items: [
        {
          name: "Msemen miel",
          description: "Msemen chaud, miel et beurre fondu.",
          price: 1.6,
          isSignature: true,
          image: {
            src: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=160&q=80",
            alt: "Msemen",
          },
        },
        {
          name: "Harcha fromage",
          description: "Semoule fine, fromage frais, servie chaude.",
          price: 1.8,
        },
        {
          name: "Baghrir amlou",
          description: "Crepes mille trous, amlou et miel.",
          price: 2.2,
        },
        {
          name: "Meloui nature",
          description:
            "Feuilletage pur beurre, pommes du Limousin légèrement caramélisées.",
          price: 2.4,
        },
        {
          name: "Raib maison",
          description:
            "Spécialité bretonne, beurre demi-sel, caramélisation lente.",
          price: 2.8,
          isSignature: true,
        },
      ],
    },
    {
      id: "boissons-chaudes",
      label: "Boissons Chaudes",
      items: [
        {
          name: "Cafe noir",
          description: "Espresso court, torrefaction locale.",
          price: 1.8,
          badge: "Populaire",
        },
        {
          name: "Noisette",
          description: "Espresso, nuage de lait entier.",
          price: 2.2,
        },
        {
          name: "Cafe creme",
          description: "Espresso allongé, lait entier frais, microfoam.",
          price: 3.2,
          image: {
            src: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&w=160&q=80",
            alt: "Café Crème",
          },
        },
        {
          name: "Cappuccino",
          description: "Double espresso, lait vapeur, mousse dense.",
          price: 3.8,
        },
        {
          name: "Chocolat chaud",
          description: "Chocolat noir fondu, lait entier, chantilly maison.",
          price: 3.9,
        },
        {
          name: "The vert menthe",
          description: "The vert infuse a la menthe fraiche.",
          price: 3.5,
        },
      ],
    },
    {
      id: "petit-dejeuner",
      label: "Petit-Déjeuner",
      items: [
        {
          name: "Petit dej beldi",
          description:
            "Msemen, oeuf, olives, fromage frais et the a la menthe.",
          price: 4.5,
          image: {
            src: "https://images.unsplash.com/photo-1528207776546-32248a4f1ce4?auto=format&fit=crop&w=160&q=80",
            alt: "Tartine",
          },
        },
        {
          name: "Oeufs khlii",
          description:
            "Oeufs, khlii, huile d'olive et pain maison.",
          price: 9.5,
        },
      ],
    },
    {
      id: "jus",
      label: "Jus & Boissons Fraîches",
      items: [
        {
          name: "Jus d'orange pressé",
          description: "Oranges pressées à la commande, sans sucre ajouté.",
          price: 4.8,
          image: {
            src: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=160&q=80",
            alt: "Jus d'orange",
          },
        },
        {
          name: "Citron pressé",
          description: "Citrons pressés, eau plate, sucre de canne à part.",
          price: 4.2,
        },
      ],
    },
    {
      id: "sandwiches",
      label: "Tacos & Sandwiches",
      items: [
        {
          name: "Tacos poulet",
          description:
            "Poulet marine, frites, fromage et sauces au choix.",
          price: 5.9,
          isSignature: true,
          image: {
            src: "https://images.unsplash.com/photo-1553909489-cd47ce260105?auto=format&fit=crop&w=160&q=80",
            alt: "Jambon-beurre",
          },
        },
        {
          name: "Sandwich kefta",
          description:
            "Poulet rôti, salade, tomate, mayonnaise maison, pain ciabatta.",
          price: 6.5,
        },
        {
          name: "Sandwich thon",
          description:
            "Thon à l'huile d'olive, œuf dur, salade, tomate, baguette.",
          price: 6.5,
        },
        {
          name: "Panini dinde fumee",
          description:
            "Pain grille, dinde fumee, fromage et sauce maison.",
          price: 8.9,
        },
      ],
    },
    {
      id: "salades",
      label: "Salades",
      items: [
        {
          name: "Salade marocaine",
          description:
            "Tomate, concombre, oignon, olives et herbes fraiches.",
          price: 11.5,
        },
        {
          name: "Salade poulet avocat",
          description:
            "Thon, œuf, haricots verts, olives, anchois, tomate, pomme de terre.",
          price: 12.0,
        },
      ],
    },
  ],
};

export type MenuItem = {
  productId?: string;
  name: string;
  description: string;
  price: number;
  image?: { src: string; alt: string };
  badge?: string;
  isSignature?: boolean;
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
  sections: MenuSection[];
};

export const cafeDesArts: StorefrontFixture = {
  slug: "cafe-des-arts",
  name: "Café des Arts",
  location: "Rue Oberkampf, Paris 11e",
  sections: [
    {
      id: "viennoiseries",
      label: "Viennoiseries",
      items: [
        {
          name: "Croissant au beurre",
          description: "Pur beurre d'Isigny AOP, cuit chaque matin.",
          price: 1.6,
          isSignature: true,
          image: {
            src: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=160&q=80",
            alt: "Croissant",
          },
        },
        {
          name: "Pain au chocolat",
          description: "Viennoiserie pur beurre, feuilletée à la main.",
          price: 1.8,
        },
        {
          name: "Pain aux raisins",
          description: "Pâte feuilletée, crème pâtissière, raisins de Corinthe.",
          price: 2.2,
        },
        {
          name: "Chausson aux pommes",
          description:
            "Feuilletage pur beurre, pommes du Limousin légèrement caramélisées.",
          price: 2.4,
        },
        {
          name: "Kouign-amann",
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
          name: "Café",
          description: "Espresso, torréfaction artisanale parisienne.",
          price: 1.8,
          badge: "Populaire",
        },
        {
          name: "Noisette",
          description: "Espresso, nuage de lait entier.",
          price: 2.2,
        },
        {
          name: "Café crème",
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
          name: "Thé vert menthe",
          description: "Thé vert bio infusé à la menthe fraîche.",
          price: 3.5,
        },
      ],
    },
    {
      id: "petit-dejeuner",
      label: "Petit-Déjeuner",
      items: [
        {
          name: "Tartine beurre-confiture",
          description:
            "Baguette tradition, beurre demi-sel, confiture maison du jour.",
          price: 4.5,
          image: {
            src: "https://images.unsplash.com/photo-1528207776546-32248a4f1ce4?auto=format&fit=crop&w=160&q=80",
            alt: "Tartine",
          },
        },
        {
          name: "Œufs brouillés, pain de campagne",
          description:
            "Œufs fermiers brouillés, pain de campagne toasté, ciboulette.",
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
      label: "Sandwiches",
      items: [
        {
          name: "Jambon-beurre",
          description:
            "Baguette tradition, jambon supérieur, beurre d'Isigny AOP.",
          price: 5.9,
          isSignature: true,
          image: {
            src: "https://images.unsplash.com/photo-1553909489-cd47ce260105?auto=format&fit=crop&w=160&q=80",
            alt: "Jambon-beurre",
          },
        },
        {
          name: "Poulet-crudités",
          description:
            "Poulet rôti, salade, tomate, mayonnaise maison, pain ciabatta.",
          price: 6.5,
        },
        {
          name: "Thon-crudités",
          description:
            "Thon à l'huile d'olive, œuf dur, salade, tomate, baguette.",
          price: 6.5,
        },
        {
          name: "Croque-monsieur",
          description:
            "Pain de mie, jambon blanc, emmental, béchamel, gratiné au four.",
          price: 8.9,
        },
      ],
    },
    {
      id: "salades",
      label: "Salades",
      items: [
        {
          name: "Salade de chèvre chaud",
          description:
            "Mesclun, toasts de chèvre, miel, noix, vinaigrette balsamique.",
          price: 11.5,
        },
        {
          name: "Salade niçoise",
          description:
            "Thon, œuf, haricots verts, olives, anchois, tomate, pomme de terre.",
          price: 12.0,
        },
      ],
    },
  ],
};

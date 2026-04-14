export type MenuItem = {
  name: string;
  description: string;
  price: number;
  image?: { src: string; alt: string };
  badge?: string;
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
  sections: MenuSection[];
};

export const cafeDesArts: StorefrontFixture = {
  slug: "cafe-des-arts",
  name: "Café des Arts",
  location: "Quartier Gauthier, Casablanca",
  sections: [
    {
      id: "boissons-chaudes",
      label: "Boissons Chaudes",
      items: [
        {
          name: "Nous Nous",
          description:
            "Half espresso, half textured milk. The Moroccan classic.",
          price: 15,
        },
        {
          name: "Café Crème",
          description:
            "Smooth espresso with carefully steamed milk and microfoam.",
          price: 18,
          image: {
            src: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&w=160&q=80",
            alt: "Café Crème",
          },
        },
        {
          name: "Thé à la Menthe",
          description:
            "Gunpowder green tea, fresh spearmint, heavily sweetened.",
          price: 12,
        },
      ],
    },
    {
      id: "petit-dejeuner",
      label: "Petit-Déjeuner",
      items: [
        {
          name: "Msemen au Miel",
          description:
            "Flaky, square semolina flatbread served hot with pure honey and butter.",
          price: 25,
          badge: "Popular",
          image: {
            src: "https://images.unsplash.com/photo-1528207776546-32248a4f1ce4?auto=format&fit=crop&w=160&q=80",
            alt: "Msemen",
          },
        },
        {
          name: "Œufs au Khlii",
          description:
            "Fried eggs prepared in a tajine with traditional preserved spiced meat.",
          price: 45,
        },
      ],
    },
    {
      id: "jus",
      label: "Jus & Smoothies",
      items: [
        {
          name: "Jus d'Orange Pressé",
          description: "Freshly squeezed local oranges, zero added sugar.",
          price: 22,
          image: {
            src: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=160&q=80",
            alt: "Orange Juice",
          },
        },
      ],
    },
    {
      id: "sandwiches",
      label: "Sandwiches",
      items: [
        {
          name: "Bocadillo Thon",
          description:
            "Crusty baguette filled with tuna, olives, boiled egg, potato, and harissa.",
          price: 35,
          image: {
            src: "https://images.unsplash.com/photo-1553909489-cd47ce260105?auto=format&fit=crop&w=160&q=80",
            alt: "Bocadillo",
          },
        },
      ],
    },
    {
      id: "salades",
      label: "Salades",
      items: [
        {
          name: "Salade Marocaine",
          description:
            "Finely diced tomatoes, cucumbers, and red onions with fresh parsley vinaigrette.",
          price: 30,
        },
      ],
    },
  ],
};

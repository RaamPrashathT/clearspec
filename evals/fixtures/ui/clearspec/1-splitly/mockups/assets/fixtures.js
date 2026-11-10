window.FIXTURES = {
  meta: { product: "Splitly", locale: "en-US", currency: "USD", today: "2026-11-03" },
  members: {
    m1: { name: "Ana Souza", initials: "AS" },
    m2: { name: "Raj Patel", initials: "RP" },
    m3: { name: "Mei Lin", initials: "ML" }
  },
  balances: {
    raj_to_ana: { amount: 42.5 },
    mei_to_ana: { amount: 0 }
  },
  expenses: {
    "e-4182": { title: "Internet, November", amount: 60, newAmount: 75, paidBy: "m3", date: "2026-11-01" }
  },
  stress: {
    members: { m1: { name: "Maximiliana Alexandra Montgomery-Okonkwo", initials: "MM" } },
    balances: { raj_to_ana: { amount: 128450.5 } }
  }
};

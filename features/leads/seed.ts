export type SampleLead = {
  id: string;
  name: string;
  company: string;
  email: string;
  status: "New" | "Contacted" | "Qualified" | "Unqualified";
  owner: string;
  source: string;
  updatedAt: string;
};

export const sampleLeads: SampleLead[] = [
  {
    id: "1",
    name: "Priya Shah",
    company: "Meridian Labs",
    email: "priya@meridianlabs.io",
    status: "Qualified",
    owner: "Nikhil K.",
    source: "Website",
    updatedAt: "Today",
  },
  {
    id: "2",
    name: "Owen Blake",
    company: "Northwind Health",
    email: "owen@northwind.health",
    status: "New",
    owner: "Asha R.",
    source: "Referral",
    updatedAt: "Yesterday",
  },
  {
    id: "3",
    name: "Sofia Alvarez",
    company: "BrightPath Retail",
    email: "sofia@brightpath.co",
    status: "Contacted",
    owner: "Nikhil K.",
    source: "LinkedIn",
    updatedAt: "2d ago",
  },
  {
    id: "4",
    name: "James Chen",
    company: "Orbit Systems",
    email: "james@orbitsys.com",
    status: "Qualified",
    owner: "Jordan L.",
    source: "Event",
    updatedAt: "3d ago",
  },
  {
    id: "5",
    name: "Amelia Frost",
    company: "Cedar Clinics",
    email: "amelia@cedar.clinic",
    status: "Contacted",
    owner: "Asha R.",
    source: "Website",
    updatedAt: "4d ago",
  },
  {
    id: "6",
    name: "Leo Park",
    company: "Helix Analytics",
    email: "leo@helix.ai",
    status: "New",
    owner: "Nikhil K.",
    source: "Partner",
    updatedAt: "5d ago",
  },
  {
    id: "7",
    name: "Nora Quinn",
    company: "Acme Freight",
    email: "nora@acmefreight.com",
    status: "Unqualified",
    owner: "Jordan L.",
    source: "Cold outreach",
    updatedAt: "1w ago",
  },
  {
    id: "8",
    name: "Marcus Lee",
    company: "Contoso Ops",
    email: "marcus@contoso.com",
    status: "Qualified",
    owner: "Nikhil K.",
    source: "Website",
    updatedAt: "1w ago",
  },
  {
    id: "9",
    name: "Elena Voss",
    company: "Lumen Media",
    email: "elena@lumen.media",
    status: "New",
    owner: "Asha R.",
    source: "Webinar",
    updatedAt: "1w ago",
  },
  {
    id: "10",
    name: "Theo Grant",
    company: "Riverbank Finance",
    email: "theo@riverbank.fi",
    status: "Contacted",
    owner: "Jordan L.",
    source: "Referral",
    updatedAt: "2w ago",
  },
];

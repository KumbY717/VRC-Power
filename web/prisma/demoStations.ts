// Demo stations for development (./vrc db). Positions are approximate places in Harare: set the exact spot of each
// real station in the admin dashboard (Stations -> Edit location), and take the demo ones out of service.
export type DemoStation = {
  id: string;
  code: string;
  name: string;
  venue: string;
  address: string;
  lat: number;
  lng: number;
  status: "online" | "offline";
  /** one entry per slot: charge %, or null for an empty slot */
  slots: (number | null)[];
};

export const DEMO_STATIONS: DemoStation[] = [
  { id: "sam-levy", code: "VRC-SL01", name: "Sam Levy Village Hub", venue: "Borrowdale", address: "Sam Levy's Village, Borrowdale", lat: -17.7582, lng: 31.0868, status: "online", slots: [72, 64, 70, 66, 71, 60, 73, null] },
  { id: "rainbow", code: "VRC-RT02", name: "Rainbow Towers Lobby", venue: "Rainbow Towers Hotel", address: "Samora Machel Ave, Harare", lat: -17.8186, lng: 31.0437, status: "online", slots: [95, 92, 94, 93, 91, 96, 90, 93] },
  { id: "hicc", code: "VRC-HC03", name: "HICC Main Stage", venue: "Harare Intl Conference Centre", address: "Samora Machel Ave, Harare", lat: -17.8183, lng: 31.0448, status: "online", slots: [38, 35, 36, 35, null, null, null, null] },
  { id: "kopje", code: "VRC-KC04", name: "Kopje Coffee", venue: "Kopje Plaza", address: "Kopje Plaza, Harare CBD", lat: -17.828, lng: 31.042, status: "online", slots: [80, 76, 82, 79, 75, 81, 77, null] },
  { id: "eastgate", code: "VRC-EG05", name: "Eastgate Court", venue: "Eastgate Mall", address: "Robert Mugabe Rd, Harare CBD", lat: -17.8312, lng: 31.0517, status: "online", slots: [78, 74, 77, 80, 73, 75, 79, null] },
  { id: "joina", code: "VRC-JC06", name: "Joina City Kiosk", venue: "Joina City Mall", address: "Jason Moyo Ave, Harare CBD", lat: -17.83, lng: 31.0494, status: "offline", slots: [null, null, null, null, null, null, null, null] },
];

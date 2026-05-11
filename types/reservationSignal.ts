export type ReservationSignalSource = "resy" | "opentable" | "tock" | "manual";

export type ReservationSignalStatus =
  | "hard_to_book"
  | "sold_out"
  | "limited_availability"
  | "new_drop"
  | "event";

export type TrendReservationSignal = {
  source: ReservationSignalSource;
  status?: ReservationSignalStatus;
  sourceUrl?: string;
  sourceNotes?: string;
  observedAt?: string;
};

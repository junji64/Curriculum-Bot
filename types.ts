export interface Professor {
  id: string;
  name: string;
}

export interface CoreArea {
  id: string;
  name: string;
  proposedBy: string; // Professor ID
  votes: number;
  votedBy: string[]; // Array of Professor IDs who voted
}

export interface Course {
  id: string;
  name: string;
  year: number;
  semester: number;
  proposedBy: string; // Professor ID
}

// Stores which professors have associated a course with a core area
export type AssociationMap = Record<string, Record<string, string[]>>; // Array of Professor IDs

// A simplified version for analysis, just checking if an association exists
export type BooleanAssociationMap = Record<string, Record<string, boolean>>;

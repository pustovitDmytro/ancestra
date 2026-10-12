export type PersonId = string;
export type LinkId = string;

export type Gender = 'male' | 'female';

export interface Person {
  id: PersonId;
  firstName: string;
  lastName: string;
  birthDate?: string;
  deathDate?: string;
  notes?: string;
  gender?: Gender;
  /** Data URL of a locally stored photo */
  photoDataUrl?: string;
}

export interface ParentChildLink {
  id: LinkId;
  parentId: PersonId;
  childId: PersonId;
}

export interface Partnership {
  id: LinkId;
  aId: PersonId;
  bId: PersonId;
}

/** A dated fact imported from GEDCOM (birth, marriage, burial, etc.) */
export interface FamilyEvent {
  id: string;
  /** GEDCOM event tag, e.g. BIRT, DEAT, MARR, BURI */
  type: string;
  date?: string;
  place?: string;
  /** EVEN type, occupation title, or other level-1 value */
  description?: string;
  personIds: PersonId[];
}

/** Normalized tree — persons by id; relationships in separate lists */
export interface TreeState {
  persons: Record<PersonId, Person>;
  parentChild: ParentChildLink[];
  partnerships: Partnership[];
  events: FamilyEvent[];
}

export const emptyTree = (): TreeState => ({
  persons: {},
  parentChild: [],
  partnerships: [],
  events: [],
});

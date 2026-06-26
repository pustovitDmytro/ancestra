export type PersonId = string;
export type LinkId = string;

export interface Person {
  id: PersonId;
  firstName: string;
  lastName: string;
  /** Biological sex used for pedigree styling and GEDCOM SEX export/import */
  sex?: 'M' | 'F' | 'U';
  birthDate?: string;
  deathDate?: string;
  notes?: string;
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

/** Normalized tree — persons by id; relationships in separate lists */
export interface TreeState {
  persons: Record<PersonId, Person>;
  parentChild: ParentChildLink[];
  partnerships: Partnership[];
}

export const emptyTree = (): TreeState => ({
  persons: {},
  parentChild: [],
  partnerships: [],
});

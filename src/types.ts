export type SectionType = 'projects' | 'achievements' | 'certificates' | 'custom';

export interface SectionItem {
  id: string;
  title: string;
  description?: string;
  link?: string;
  imageUrl?: string;
  date?: string;

  /* projects */
  slug?: string;
  tags?: string[];
  featured?: boolean;
  repoUrl?: string;
  liveUrl?: string;
  role?: string;
  status?: 'shipped' | 'wip';
  problem?: string;
  approach?: string;
  outcome?: string;
  gallery?: string[];

  /* certificates / achievements */
  issuer?: string;
  credentialId?: string;
  credentialUrl?: string;
  expires?: string;
}

export interface SkillGroup {
  id: string;
  label: string;
  items: string[];
}

export interface Section {
  id?: string;
  title: string;
  type: SectionType;
  items: SectionItem[];
  order: number;
  visible: boolean;
  updatedAt: string;
  ownerId: string;
}

export interface Interest {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface Profile {
  id?: string;
  name: string;
  subtitle: string;
  bio: string;
  skills: string[];
  /** Grouped skills. Falls back to a single group built from `skills`. */
  skillGroups?: SkillGroup[];
  interests?: Interest[];
  email: string;
  github: string;
  linkedin: string;
  twitter: string;
  location: string;
  educationInfo?: string;
  institution?: string;
  /** One line about what the work centres on. Replaces a hard-coded string. */
  focus?: string;
  resumeUrl?: string;
  ownerId: string;
  updatedAt: string;
}

export interface Message {
  id?: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  read: boolean;
}

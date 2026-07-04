export type SectionType = 'projects' | 'achievements' | 'certificates' | 'custom';

export interface SectionItem {
  id: string;
  title: string;
  description?: string;
  link?: string;
  imageUrl?: string;
  date?: string;
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
  interests?: Interest[];
  email: string;
  github: string;
  linkedin: string;
  twitter: string;
  location: string;
  educationInfo?: string;
  institution?: string;
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

export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
}

export enum StatusLocation {
  HOME = 'HOME',
  GREENSPACE = 'GREENSPACE',
  THIRD_PLACE = 'THIRD_PLACE',
}

export interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone?: string; // Optional since we don't store phone numbers in the database
}

/**
 * Helper function to get full name from firstName and lastName
 * Falls back to a cleaned email (without domain) or "Unknown" if no name is available
 */
export function getFullName(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  if (user.lastName) {
    return user.lastName;
  }
  // If no name, try to extract a readable part from email (before @)
  if (user.email) {
    const emailPart = user.email.split('@')[0];
    // Remove common prefixes like "test." and make it more readable
    const cleaned = emailPart.replace(/^test\./, '').replace(/[._]/g, ' ');
    return cleaned || 'Unknown';
  }
  return 'Unknown';
}

export interface Contact extends User {
  status?: ContactStatus;
  relationshipType?: 'outgoing' | 'incoming' | 'mutual';
  isPending?: boolean;
  pendingStatus?: any;
  friendStatus?: 'PENDING' | 'ACCEPTED' | 'MUTED' | 'BLOCKED'; // Friend relationship status
}

export interface ContactStatus {
  id: string;
  status: AvailabilityStatus;
  message: string;
  location: StatusLocation;
  startTime: string;
  endTime: string;
  sharedWith?: string[];
}

export interface CreateStatusInput {
  status: AvailabilityStatus;
  message: string;
  location: StatusLocation;
  startTime: string;
  endTime: string;
}


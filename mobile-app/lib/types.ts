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
  phone: string;
}

/**
 * Helper function to get full name from firstName and lastName
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
  return user.email || 'Unknown';
}

export interface Contact extends User {
  status?: ContactStatus;
}

export interface ContactStatus {
  id: string;
  status: AvailabilityStatus;
  message?: string;
  location?: StatusLocation;
  startTime: string;
  endTime: string;
}

export interface CreateStatusInput {
  status: AvailabilityStatus;
  message?: string;
  location?: StatusLocation;
  startTime: string;
  endTime: string;
}

